//! The shell's app updater: a thin wrapper over `tauri-plugin-updater`'s Rust
//! API plus the seams around it.
//!
//! - Update source: the manifest endpoints come from `tauri.conf.json`
//!   (`plugins.updater.endpoints`). A data-home `update-source.json` of the
//!   form `{"endpoints": ["https://…"]}` replaces the list wholesale; a
//!   malformed file is a loud misconfiguration — recorded into
//!   `update-state.json`'s `lastError`, shown in the About section, and the
//!   deferred boot check skips that round.
//! - Deferred boot check: one GET, 30 seconds after launch, so the shell's
//!   first paint never waits on the network. Its failure is silent (recorded
//!   in state, never a dialog); the manual check in the About settings
//!   section reports errors next to the source URL.
//! - Reminder gate (stateless delay): a newer manifest version is reminder
//!   material only when `now >= pub_date + 24h`, keeping the reminder uniform
//!   for every user; `notedVersion` deduplicates the boot dialog per version.

use std::cmp::Ordering;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering as AtomicOrdering};
use std::sync::Arc;
use std::time::{Duration, SystemTime, UNIX_EPOCH};

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter, Manager, Url};
use tauri_plugin_updater::UpdaterExt;

/// Shell-owned update state, beside the data home's other shell records.
/// JSON keys are camelCase to match the JS-facing payload convention.
#[derive(Serialize, Deserialize, Default, Clone, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
struct UpdateState {
    /// Epoch ms of the last completed check.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    last_check_ms: Option<u64>,
    /// Outcome of that check: `up-to-date`, `available`, or `error`.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    last_check_status: Option<CheckStatus>,
    /// Manifest version that check found, with its release facts.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    latest: Option<LatestRelease>,
    /// Why the last check, source read, or install failed.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    last_error: Option<String>,
    /// Newest version a notice has already been raised for (boot dialog or
    /// manual check alike); reminder checks never re-raise it.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    noted_version: Option<String>,
}

/// The release a check found. `pub_date_ms` comes from the manifest's
/// `pub_date`; an absent date counts as long past its release.
#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct LatestRelease {
    pub version: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub notes: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub pub_date_ms: Option<i64>,
}

#[derive(Serialize, Deserialize, Clone, Copy, Debug, PartialEq)]
#[serde(rename_all = "kebab-case")]
pub enum CheckStatus {
    UpToDate,
    Available,
    Error,
}

/// Update source decision for one check: the config default or the override.
enum UpdateSource {
    Default,
    Override(Vec<Url>),
}

impl std::fmt::Debug for UpdateSource {
    fn fmt(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::Default => formatter.write_str("Default"),
            Self::Override(urls) => formatter.debug_list().entries(urls.iter().map(Url::as_str)).finish(),
        }
    }
}

/// Registrant-facing snapshot of the updater for the About section.
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateStateSnapshot {
    /// The shell's own version.
    pub version: String,
    /// Effective update-source endpoints (override file or config default).
    pub endpoints: Vec<String>,
    /// `default`, `override`, or `error` (loud misconfiguration).
    pub source: SourceState,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub last_check_ms: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub last_check_status: Option<CheckStatus>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub latest: Option<LatestRelease>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub last_error: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub noted_version: Option<String>,
}

#[derive(Serialize, Clone, Copy)]
#[serde(rename_all = "kebab-case")]
pub enum SourceState {
    Default,
    Override,
    Error,
}

/// Result of one manual or deferred check.
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CheckUpdateResult {
    pub status: CheckStatus,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub version: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub notes: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub pub_date_ms: Option<i64>,
    /// Diagnostic the About section renders beside the source URL.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub detail: Option<String>,
}

/// `easel_install_update`'s immediate answer; the download itself is a
/// background task reporting through `easel://update-progress`.
#[derive(Serialize)]
#[serde(rename_all = "kebab-case")]
pub enum InstallStart {
    Started,
    UpToDate,
}

#[derive(Serialize, Clone)]
struct ProgressPayload {
    phase: &'static str,
    #[serde(skip_serializing_if = "Option::is_none")]
    percent: Option<u8>,
    #[serde(skip_serializing_if = "Option::is_none")]
    version: Option<String>,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct AvailablePayload {
    version: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    notes: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub_date_ms: Option<i64>,
}

const STATE_FILE: &str = "update-state.json";
const SOURCE_FILE: &str = "update-source.json";
/// A reminder waits one day past the release's `pub_date`.
const NOTICE_DELAY_MS: i64 = 24 * 60 * 60 * 1000;
/// The deferred boot check waits this long after launch.
const BOOT_CHECK_DELAY: Duration = Duration::from_secs(30);
/// Event the shell page relays into the GUI: download progress and install phases.
const PROGRESS_EVENT: &str = "easel://update-progress";
/// Event that opens the update notice overlay.
const AVAILABLE_EVENT: &str = "easel://update-available";

fn state_path_at(home: &Path) -> PathBuf {
    home.join(STATE_FILE)
}

fn source_path_at(home: &Path) -> PathBuf {
    home.join(SOURCE_FILE)
}

fn read_state_at(home: &Path) -> UpdateState {
    // A missing or corrupt state file self-heals to the empty state: the file
    // is a cache of facts the next check rebuilds, never user configuration.
    std::fs::read_to_string(state_path_at(home))
        .ok()
        .and_then(|raw| serde_json::from_str(&raw).ok())
        .unwrap_or_default()
}

fn write_state_at(home: &Path, state: &UpdateState) -> Result<(), String> {
    let path = state_path_at(home);
    if let Some(dir) = path.parent() {
        std::fs::create_dir_all(dir).map_err(|e| e.to_string())?;
    }
    std::fs::write(&path, serde_json::to_vec_pretty(state).map_err(|e| e.to_string())?)
        .map_err(|e| e.to_string())
}

#[derive(Deserialize)]
struct SourceFile {
    endpoints: Vec<String>,
}

fn read_update_source_at(home: &Path) -> Result<UpdateSource, String> {
    let path = source_path_at(home);
    let raw = match std::fs::read_to_string(&path) {
        Ok(raw) => raw,
        Err(err) if err.kind() == std::io::ErrorKind::NotFound => return Ok(UpdateSource::Default),
        Err(err) => return Err(format!("读取 {SOURCE_FILE} 失败：{err}")),
    };
    let parsed: SourceFile = serde_json::from_str(&raw)
        .map_err(|e| format!("{SOURCE_FILE} 不是合法 JSON：{e}"))?;
    if parsed.endpoints.is_empty() {
        return Err(format!("{SOURCE_FILE} 的 endpoints 不能为空"));
    }
    let mut urls = Vec::new();
    for candidate in parsed.endpoints {
        let url = candidate
            .parse::<Url>()
            .map_err(|e| format!("{SOURCE_FILE} 的 endpoint「{candidate}」不是合法 URL：{e}"))?;
        if !matches!(url.scheme(), "http" | "https") {
            return Err(format!("{SOURCE_FILE} 的 endpoint「{candidate}」必须是 http(s) 地址"));
        }
        urls.push(url);
    }
    Ok(UpdateSource::Override(urls))
}

/// Strict semver-style ordering of `major.minor.patch[-pre][+build]` strings.
/// A release ranks above any prerelease; numeric prerelease tokens rank below
/// alphanumeric ones (semver rule 11); a prefix-equal longer prerelease wins.
fn semver_cmp(a: &str, b: &str) -> Ordering {
    let (a_core, a_pre) = split_version(a);
    let (b_core, b_pre) = split_version(b);
    let core = compare_numeric_core(a_core, b_core);
    if core != Ordering::Equal {
        return core;
    }
    compare_prerelease(a_pre, b_pre)
}

fn split_version(version: &str) -> (&str, Option<&str>) {
    let (core, _) = version.split_once('+').unwrap_or((version, ""));
    match core.split_once('-') {
        Some((core, pre)) => (core, Some(pre)),
        None => (core, None),
    }
}

fn compare_numeric_core(a: &str, b: &str) -> Ordering {
    let mut a_parts = a.split('.');
    let mut b_parts = b.split('.');
    loop {
        let (a_next, b_next) = (a_parts.next(), b_parts.next());
        if a_next.is_none() && b_next.is_none() {
            return Ordering::Equal;
        }
        let a_value = a_next.unwrap_or("").parse::<u64>().unwrap_or(0);
        let b_value = b_next.unwrap_or("").parse::<u64>().unwrap_or(0);
        if a_value != b_value {
            return a_value.cmp(&b_value);
        }
    }
}

fn compare_prerelease(a: Option<&str>, b: Option<&str>) -> Ordering {
    match (a, b) {
        (None, None) => Ordering::Equal,
        (None, Some(_)) => Ordering::Greater,
        (Some(_), None) => Ordering::Less,
        (Some(a), Some(b)) => {
            let mut a_tokens = a.split('.');
            let mut b_tokens = b.split('.');
            loop {
                match (a_tokens.next(), b_tokens.next()) {
                    (None, None) => return Ordering::Equal,
                    (None, Some(_)) => return Ordering::Less,
                    (Some(_), None) => return Ordering::Greater,
                    (Some(x), Some(y)) => {
                        let ord = match (x.parse::<u64>(), y.parse::<u64>()) {
                            (Ok(x_value), Ok(y_value)) => x_value.cmp(&y_value),
                            (Ok(_), Err(_)) => Ordering::Less,
                            (Err(_), Ok(_)) => Ordering::Greater,
                            (Err(_), Err(_)) => x.cmp(y),
                        };
                        if ord != Ordering::Equal {
                            return ord;
                        }
                    }
                }
            }
        }
    }
}

/// Whether the found release should raise the update notice now: strictly
/// newer than the running shell, past the release's one-day delay, and not
/// already noted. A missing `pub_date` counts as long past its release, so a
/// dateless manifest never suppresses a reminder.
fn reminder_due(current: &str, latest: &LatestRelease, noted: Option<&str>, now_ms: i64) -> bool {
    semver_cmp(&latest.version, current) == Ordering::Greater
        && now_ms >= latest.pub_date_ms.unwrap_or(0) + NOTICE_DELAY_MS
        && noted != Some(latest.version.as_str())
}

/// Downloaded/total as an integer percent, clamped to 100; `None` when the
/// total is unknown (or zero). The u64 overflow guard keeps huge totals sane.
fn percent_of(downloaded: u64, total: u64) -> Option<u8> {
    if total == 0 {
        return None;
    }
    let downloaded = downloaded.min(total);
    Some((downloaded * 100 / total).min(100) as u8)
}

fn now_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as u64
}

/// Serialize check outcomes for both call paths. `notify` raises the boot
/// dialog (the About section shows a manual check's result inline instead);
/// both set `notedVersion` when the reminder gate passes.
async fn run_check(app: &AppHandle, home: &Path, notify: bool) -> CheckUpdateResult {
    let _guard = CHECK_LOCK.lock().await;
    let mut state = read_state_at(home);
    let endpoints = match read_update_source_at(home) {
        Ok(UpdateSource::Override(urls)) => Some(urls),
        Ok(UpdateSource::Default) => None,
        Err(err) => {
            state.last_check_status = Some(CheckStatus::Error);
            state.last_error = Some(err.clone());
            state.last_check_ms = Some(now_ms());
            let _ = write_state_at(home, &state);
            return CheckUpdateResult {
                status: CheckStatus::Error,
                version: None,
                notes: None,
                pub_date_ms: None,
                detail: Some(err),
            };
        }
    };
    state.last_check_ms = Some(now_ms());
    state.last_error = None;
    check_with_endpoints(app, home, endpoints, notify, state).await
}

/// Serializes state writes between the deferred check, the manual check, and
/// install failures; the check is rare and a GET is seconds long.
static CHECK_LOCK: tauri::async_runtime::Mutex<()> = tauri::async_runtime::Mutex::const_new(());

async fn check_with_endpoints(
    app: &AppHandle,
    home: &Path,
    endpoints: Option<Vec<Url>>,
    notify: bool,
    mut state: UpdateState,
) -> CheckUpdateResult {
    let current = app.package_info().version.to_string();
    let updater = match endpoints {
        Some(urls) => app.updater_builder().endpoints(urls),
        None => Ok(app.updater_builder()),
    }
    .and_then(|builder| builder.build())
    .map_err(|e| format!("更新器配置不可用：{e}"));
    let updater = match updater {
        Ok(updater) => updater,
        Err(err) => return record_error(home, &mut state, err),
    };
    match updater.check().await {
        Ok(None) => {
            state.last_check_status = Some(CheckStatus::UpToDate);
            state.latest = None;
            state.last_error = None;
            let _ = write_state_at(home, &state);
            CheckUpdateResult {
                status: CheckStatus::UpToDate,
                version: None,
                notes: None,
                pub_date_ms: None,
                detail: None,
            }
        }
        Ok(Some(update)) => {
            let latest = LatestRelease {
                version: update.version.clone(),
                notes: update.body.clone(),
                pub_date_ms: update.date.map(|date| date.unix_timestamp() * 1000),
            };
            let due = reminder_due(&current, &latest, state.noted_version.as_deref(), now_ms() as i64);
            if due {
                state.noted_version = Some(latest.version.clone());
            }
            state.last_check_status = Some(CheckStatus::Available);
            state.latest = Some(latest.clone());
            state.last_error = None;
            let _ = write_state_at(home, &state);
            if due && notify {
                let _ = app.emit(
                    AVAILABLE_EVENT,
                    AvailablePayload {
                        version: latest.version.clone(),
                        notes: latest.notes.clone(),
                        pub_date_ms: latest.pub_date_ms,
                    },
                );
            }
            CheckUpdateResult {
                status: CheckStatus::Available,
                version: Some(latest.version),
                notes: latest.notes,
                pub_date_ms: latest.pub_date_ms,
                detail: None,
            }
        }
        Err(err) => record_error(home, &mut state, format!("无法连接更新源：{err}")),
    }
}

fn record_error(home: &Path, state: &mut UpdateState, message: String) -> CheckUpdateResult {
    state.last_check_status = Some(CheckStatus::Error);
    state.last_error = Some(message.clone());
    let _ = write_state_at(home, state);
    CheckUpdateResult {
        status: CheckStatus::Error,
        version: None,
        notes: None,
        pub_date_ms: None,
        detail: Some(message),
    }
}

/// Shell-side updater init: record a loud misconfigured source into state
/// (the About section shows the reason before any check runs) and schedule
/// the deferred boot check.
pub fn init(app: &AppHandle) {
    let home = crate::setup::dsh_home();
    if let Err(err) = read_update_source_at(&home) {
        let mut state = read_state_at(&home);
        state.last_error = Some(err);
        let _ = write_state_at(&home, &state);
    }
    let handle = app.clone();
    tauri::async_runtime::spawn(async move {
        tokio::time::sleep(BOOT_CHECK_DELAY).await;
        // A misconfigured source file skips this round; its error is already
        // recorded for the About section to show.
        if read_update_source_at(&crate::setup::dsh_home()).is_err() {
            return;
        }
        run_check(&handle, &crate::setup::dsh_home(), true).await;
    });
}

#[tauri::command]
pub async fn easel_check_update(app: AppHandle) -> Result<CheckUpdateResult, String> {
    Ok(run_check(&app, &crate::setup::dsh_home(), false).await)
}

#[tauri::command]
pub fn easel_update_state(app: AppHandle) -> UpdateStateSnapshot {
    let state = read_state_at(&crate::setup::dsh_home());
    let defaults = app
        .config()
        .plugins
        .0
        .get("updater")
        .and_then(|updater| updater.get("endpoints"))
        .and_then(|endpoints| serde_json::from_value::<Vec<String>>(endpoints.clone()).ok())
        .unwrap_or_default();
    let (source, endpoints) = match read_update_source_at(&crate::setup::dsh_home()) {
        Ok(UpdateSource::Override(urls)) => (SourceState::Override, urls.into_iter().map(|url| url.to_string()).collect()),
        Ok(UpdateSource::Default) => (SourceState::Default, defaults),
        Err(_) => (SourceState::Error, Vec::new()),
    };
    UpdateStateSnapshot {
        version: app.package_info().version.to_string(),
        endpoints,
        source,
        last_check_ms: state.last_check_ms,
        last_check_status: state.last_check_status,
        latest: state.latest,
        last_error: state.last_error,
        noted_version: state.noted_version,
    }
}

/// One install chain at a time: a second 立即更新 while a download runs would
/// race two installers into the same install directory. The Started path
/// leaves the flag set until the download finishes (success exits the
/// process; failure clears it) or the shell restarts.
static INSTALL_RUNNING: AtomicBool = AtomicBool::new(false);

/// Clears `INSTALL_RUNNING` when the install task leaves without success —
/// including a panic inside the download future.
struct InstallRunningGuard;
impl Drop for InstallRunningGuard {
    fn drop(&mut self) {
        INSTALL_RUNNING.store(false, AtomicOrdering::SeqCst);
    }
}

#[tauri::command]
pub async fn easel_install_update(app: AppHandle) -> Result<InstallStart, String> {
    if INSTALL_RUNNING.swap(true, AtomicOrdering::SeqCst) {
        return Err("已有一次更新安装在进行".into());
    }
    let outcome = install_update_inner(app).await;
    if !matches!(outcome, Ok(InstallStart::Started)) {
        INSTALL_RUNNING.store(false, AtomicOrdering::SeqCst);
    }
    outcome
}

async fn install_update_inner(app: AppHandle) -> Result<InstallStart, String> {
    // Stop the bundled dsh process first: the updater exits the shell process
    // (std::process::exit on Windows) without RunEvent::Exit, so the runtime
    // node would otherwise be orphaned behind the installer. The NSIS hook
    // remains the belt-and-braces path for orphans from older shells.
    let stopper = app.clone();
    tauri::async_runtime::spawn_blocking(move || {
        stopper
            .state::<crate::dsh_runner::DshHandle>()
            .stop();
    })
    .await
    .map_err(|e| format!("停止本地服务失败：{e}"))?;

    let updater = match read_update_source_at(&crate::setup::dsh_home()) {
        Ok(UpdateSource::Override(urls)) => app.updater_builder().endpoints(urls),
        Ok(UpdateSource::Default) => Ok(app.updater_builder()),
        Err(err) => return Err(err),
    }
    .and_then(|builder| builder.build())
    .map_err(|e| format!("更新器配置不可用：{e}"))?;
    let Some(update) = updater.check().await.map_err(|e| format!("检查更新失败：{e}"))? else {
        return Ok(InstallStart::UpToDate);
    };

    let version = update.version.clone();
    let emitter = app.clone();
    let progress_app = emitter.clone();
    let downloaded = Arc::new(AtomicU64::new(0));
    let total_len = Arc::new(AtomicU64::new(0));
    // u64::MAX differs from every key (None → 0, percent p → p + 1), so the
    // first chunk always emits and an unknown total announces exactly once.
    let last_percent_key = Arc::new(AtomicU64::new(u64::MAX));
    let closure_version = version.clone();
    let on_chunk = move |chunk: usize, total: Option<u64>| {
        let now = downloaded.fetch_add(chunk as u64, AtomicOrdering::SeqCst) + chunk as u64;
        if let Some(total) = total {
            total_len.store(total, AtomicOrdering::SeqCst);
        }
        let percent = percent_of(now, total_len.load(AtomicOrdering::SeqCst));
        // Only a change is worth an event: chunks arrive thousands of times.
        let key = percent.map_or(0, |p| u64::from(p) + 1);
        let previous = last_percent_key.swap(key, AtomicOrdering::SeqCst);
        if key == previous {
            return;
        }
        let _ = progress_app.emit(
            PROGRESS_EVENT,
            ProgressPayload {
                phase: "downloading",
                percent,
                version: Some(closure_version.clone()),
            },
        );
    };
    let finish_app = emitter.clone();
    let on_finish = move || {
        let _ = finish_app.emit(
            PROGRESS_EVENT,
            ProgressPayload {
                phase: "installing",
                percent: None,
                version: None,
            },
        );
    };
    let error_app = emitter.clone();
    let error_version = version.clone();
    tauri::async_runtime::spawn(async move {
        // Success exits the process before this drops; failure and panic
        // both release the install lock here.
        let _guard = InstallRunningGuard;
        match update.download_and_install(on_chunk, on_finish).await {
            Ok(()) => {
                // The installer has been launched; the plugin exits the
                // process itself on Windows — this exit is the fallback for
                // platforms or versions that do not.
                std::process::exit(0);
            }
            Err(err) => {
                let _guard = CHECK_LOCK.lock().await;
                let mut state = read_state_at(&crate::setup::dsh_home());
                state.last_error = Some(format!("安装更新失败：{err}"));
                let _ = write_state_at(&crate::setup::dsh_home(), &state);
                let _ = error_app.emit(
                    PROGRESS_EVENT,
                    ProgressPayload {
                        phase: "failed",
                        percent: None,
                        version: Some(error_version),
                    },
                );
            }
        }
    });
    Ok(InstallStart::Started)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    fn temp_dir(tag: &str) -> PathBuf {
        // CARGO_MANIFEST_DIR/target is the one location this test process
        // reliably writes (the machine's temp dir is not always writable).
        let dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .join("target")
            .join("tmp")
            .join(format!("app-update-test-{tag}"));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).unwrap();
        dir
    }

    #[test]
    fn semver_orders_releases_and_prereleases() {
        use Ordering::*;
        assert_eq!(semver_cmp("0.2.2", "0.2.1"), Greater);
        assert_eq!(semver_cmp("0.2.1-alpha.32", "0.2.1-alpha.33"), Less);
        assert_eq!(semver_cmp("0.2.1-alpha.32", "0.2.2"), Less);
        assert_eq!(semver_cmp("0.2.2", "0.2.1-alpha.32"), Greater);
        assert_eq!(semver_cmp("1.0.0", "1.0.0"), Equal);
        assert_eq!(semver_cmp("0.2.1-alpha.32", "0.2.1-alpha.32"), Equal);
        // semver rule 11: alpha < alpha.1 < beta < release.
        assert_eq!(semver_cmp("1.0.0-alpha", "1.0.0-alpha.1"), Less);
        assert_eq!(semver_cmp("1.0.0-alpha.1", "1.0.0-beta"), Less);
        assert_eq!(semver_cmp("1.0.0-beta", "1.0.0"), Less);
        // Build metadata never affects ordering.
        assert_eq!(semver_cmp("1.0.0+a", "1.0.0+b"), Equal);
    }

    #[test]
    fn reminder_gate_requires_newer_past_delay_unnoted() {
        let day_ago = (now_ms() as i64) - NOTICE_DELAY_MS - 1_000;
        let fresh = now_ms() as i64;
        let current = "0.2.1-alpha.32";
        let latest = |version: &str, pub_date_ms: Option<i64>| LatestRelease {
            version: version.to_string(),
            notes: None,
            pub_date_ms,
        };
        // Same version: never a reminder.
        assert!(!reminder_due(current, &latest(current, Some(day_ago)), None, now_ms() as i64));
        // Older manifest: never a reminder.
        assert!(!reminder_due(current, &latest("0.2.0", Some(day_ago)), None, now_ms() as i64));
        // Newer but inside the 24h window: no reminder.
        assert!(!reminder_due(current, &latest("0.2.2", Some(fresh)), None, now_ms() as i64));
        // Newer, past the window, unnoted: reminder.
        assert!(reminder_due(current, &latest("0.2.2", Some(day_ago)), None, now_ms() as i64));
        // Already noted: no reminder.
        assert!(!reminder_due(current, &latest("0.2.2", Some(day_ago)), Some("0.2.2"), now_ms() as i64));
        // Missing pub_date: treated as long past — reminder fires.
        assert!(reminder_due(current, &latest("0.2.2", None), None, now_ms() as i64));
    }

    #[test]
    fn state_file_roundtrip_self_heals_and_reads_default_on_garbage() {
        let home = temp_dir("state");
        // Missing file: the empty state.
        assert_eq!(read_state_at(&home), UpdateState::default());
        // Roundtrip keeps every field.
        let state = UpdateState {
            last_check_ms: Some(1234),
            last_check_status: Some(CheckStatus::Available),
            latest: Some(LatestRelease {
                version: "0.2.2".into(),
                notes: Some("notes".into()),
                pub_date_ms: Some(42),
            }),
            last_error: None,
            noted_version: Some("0.2.2".into()),
        };
        write_state_at(&home, &state).unwrap();
        assert_eq!(read_state_at(&home), state);
        // Bad JSON self-heals to the empty state.
        let _ = fs::write(state_path_at(&home), b"{ not json");
        assert_eq!(read_state_at(&home), UpdateState::default());
    }

    #[test]
    fn update_source_accepts_valid_override_and_rejects_bad_shapes() {
        let home = temp_dir("source");
        // Absent file: the config default.
        assert!(matches!(read_update_source_at(&home), Ok(UpdateSource::Default)));
        // Valid override.
        let _ = fs::write(
            source_path_at(&home),
            r#"{"endpoints": ["https://example.cn/updates/latest.json"]}"#,
        );
        match read_update_source_at(&home) {
            Ok(UpdateSource::Override(urls)) => {
                assert_eq!(urls.len(), 1);
                assert_eq!(urls[0].as_str(), "https://example.cn/updates/latest.json");
            }
            other => panic!("expected override, got {other:?}"),
        }
        // Empty list: loud.
        let _ = fs::write(source_path_at(&home), r#"{"endpoints": []}"#);
        assert!(read_update_source_at(&home).is_err());
        // Bad JSON: loud.
        let _ = fs::write(source_path_at(&home), "{ not json");
        assert!(read_update_source_at(&home).is_err());
        // Non-http scheme: loud.
        let _ = fs::write(source_path_at(&home), r#"{"endpoints": ["ftp://example.cn/x"]}"#);
        assert!(read_update_source_at(&home).is_err());
        // Non-URL garbage: loud.
        let _ = fs::write(source_path_at(&home), r#"{"endpoints": ["not a url"]}"#);
        assert!(read_update_source_at(&home).is_err());
    }

    #[test]
    fn percent_of_is_clamped_and_unknown_without_total() {
        assert_eq!(percent_of(50, 200), Some(25));
        assert_eq!(percent_of(200, 200), Some(100));
        assert_eq!(percent_of(300, 200), Some(100));
        assert_eq!(percent_of(50, 0), None);
    }

    #[test]
    fn payload_wire_keys_match_the_client_contract() {
        // The relayed payloads cross the host bridge as plain JSON keys the
        // client reads verbatim (hostUpdate.js); a rename-all slip surfaces
        // here instead of as a dead install button or an empty About row.
        assert_eq!(
            serde_json::to_value(InstallStart::Started).unwrap(),
            serde_json::json!("started"),
        );
        assert_eq!(
            serde_json::to_value(InstallStart::UpToDate).unwrap(),
            serde_json::json!("up-to-date"),
        );
        assert_eq!(
            serde_json::to_value(CheckStatus::Available).unwrap(),
            serde_json::json!("available"),
        );
        assert_eq!(
            serde_json::to_value(CheckUpdateResult {
                status: CheckStatus::Available,
                version: Some("0.3.0".into()),
                notes: Some("release notes".into()),
                pub_date_ms: Some(1_000),
                detail: None,
            })
            .unwrap(),
            serde_json::json!({
                "status": "available",
                "version": "0.3.0",
                "notes": "release notes",
                "pubDateMs": 1_000,
            }),
        );
        assert_eq!(
            serde_json::to_value(ProgressPayload {
                phase: "downloading",
                percent: Some(25),
                version: Some("0.3.0".into()),
            })
            .unwrap(),
            serde_json::json!({"phase": "downloading", "percent": 25, "version": "0.3.0"}),
        );
        assert_eq!(
            serde_json::to_value(AvailablePayload {
                version: "0.3.0".into(),
                notes: None,
                pub_date_ms: Some(1_000),
            })
            .unwrap(),
            serde_json::json!({"version": "0.3.0", "pubDateMs": 1_000}),
        );
        assert_eq!(
            serde_json::to_value(LatestRelease {
                version: "0.3.0".into(),
                notes: None,
                pub_date_ms: Some(1_000),
            })
            .unwrap(),
            serde_json::json!({"version": "0.3.0", "pubDateMs": 1_000}),
        );
        assert_eq!(
            serde_json::to_value(UpdateStateSnapshot {
                version: "0.2.1-alpha.32".into(),
                endpoints: vec!["https://example.invalid/latest.json".into()],
                source: SourceState::Default,
                last_check_ms: None,
                last_check_status: None,
                latest: None,
                last_error: None,
                noted_version: None,
            })
            .unwrap(),
            serde_json::json!({
                "version": "0.2.1-alpha.32",
                "endpoints": ["https://example.invalid/latest.json"],
                "source": "default",
            }),
        );
    }
}
