//! Installed-layout paths and the one-time data relocation.
//!
//! Release builds keep the program in the install directory; user data lives
//! in `<Documents>/Easel-dsh` by default and can be moved from the settings
//! page. A bootstrap pointer records the chosen root outside the data tree:
//!
//!   <data_root>/workspace  EASEL_HOME (skills, projects, outputs, .env)
//!   <data_root>/home       DSH_HOME (profiles, sessions, credentials)
//!
//! Legacy layouts are migrated once: v2 kept data in `<install>/data`, and
//! pre-layout installs kept it in `%LOCALAPPDATA%\Easel` + `~/.easel` (or the
//! equivalent fallback on macOS/Linux). Those logical paths are kept as
//! junctions/symlinks so project files and session records that embed them
//! keep resolving; project files are never rewritten.

use std::fs;
use std::io::ErrorKind;
use std::path::{Path, PathBuf};

use crate::setup::copy_dir;

const LAYOUT_MARKER: &str = ".layout-v2.json";
/// Marks a directory as an Easel data root.
const DATA_MARKER: &str = ".easel-data.json";
/// Present in the destination while a cross-volume copy is in flight.
const DATA_MIGRATING: &str = ".easel-migrating";
/// Bootstrap pointer file, inside the per-user config directory.
const DATA_ROOT_CONFIG: &str = "data-root.json";
const DATA_ROOT_PENDING: &str = "data-root.pending.json";
const DATA_ROOT_RESULT: &str = "data-root.result.json";

/// `%LOCALAPPDATA%\Easel-dsh`, or `None` in a dev launch (the exe has no
/// bundled runtime beside it). Every path helper falls back to the pre-layout
/// defaults when this returns `None`, so `tauri dev` keeps using the
/// developer's scratch data.
#[cfg_attr(not(windows), allow(dead_code))]
pub(crate) fn install_root() -> Option<PathBuf> {
    install_root_from_exe(&std::env::current_exe().ok()?)
}

#[cfg_attr(not(windows), allow(dead_code))]
fn install_root_from_exe(exe: &Path) -> Option<PathBuf> {
    let dir = exe.parent()?;
    // Pre-alpha.32 split layout kept the program tree in `<root>\app`.
    if dir.file_name().and_then(|name| name.to_str()) == Some("app") {
        return dir.parent().map(Path::to_path_buf)
    }
    // Flat layout: the exe sits directly in the install root beside the
    // bundled runtime payload; `runtime\manifest.json` is the install marker.
    if dir.join("runtime").join("manifest.json").is_file() {
        return Some(dir.to_path_buf())
    }
    None
}

#[cfg(windows)]
fn is_installed() -> bool {
    std::env::current_exe()
        .ok()
        .and_then(|exe| install_root_from_exe(&exe))
        .is_some()
}

#[cfg(target_os = "macos")]
fn is_installed() -> bool {
    std::env::current_exe()
        .map(|exe| exe.to_string_lossy().contains(".app/Contents/MacOS"))
        .unwrap_or(false)
}

#[cfg(all(unix, not(target_os = "macos")))]
fn is_installed() -> bool {
    std::env::current_exe()
        .map(|exe| {
            let text = exe.to_string_lossy();
            !text.contains("/target/debug/") && !text.contains("/target/release/")
        })
        .unwrap_or(false)
}

// On Windows the flat install layout makes the install root itself the
// application directory a data root must never live inside; non-Windows
// platforms derive it from the bundle location below.

#[cfg(target_os = "macos")]
fn install_dir() -> Option<PathBuf> {
    let exe = std::env::current_exe().ok()?;
    exe.ancestors()
        .find(|path| path.extension().and_then(|ext| ext.to_str()) == Some("app"))
        .map(Path::to_path_buf)
        .or_else(|| exe.parent().map(Path::to_path_buf))
}

#[cfg(all(unix, not(target_os = "macos")))]
fn install_dir() -> Option<PathBuf> {
    std::env::current_exe()
        .ok()
        .and_then(|exe| exe.parent().map(Path::to_path_buf))
}

#[cfg(windows)]
fn install_guard() -> Option<PathBuf> {
    install_root()
}

#[cfg(not(windows))]
fn install_guard() -> Option<PathBuf> {
    install_dir()
}

/// The application directory a chosen data root must not live inside; exposed
/// to the host half so its validation can reject it before requesting a move.
pub(crate) fn install_dir_env() -> Option<PathBuf> {
    install_guard()
}

fn local_app_data() -> PathBuf {
    if let Ok(dir) = std::env::var("LOCALAPPDATA") {
        return PathBuf::from(dir);
    }
    user_home().join("AppData").join("Local")
}

fn user_home() -> PathBuf {
    PathBuf::from(
        std::env::var("USERPROFILE")
            .or_else(|_| std::env::var("HOME"))
            .unwrap_or_default(),
    )
}

fn legacy_workspace() -> PathBuf {
    local_app_data().join("Easel")
}

fn legacy_home() -> PathBuf {
    user_home().join(".easel")
}

fn env_path(name: &str) -> Option<PathBuf> {
    std::env::var_os(name)
        .filter(|value| !value.is_empty())
        .map(PathBuf::from)
}

fn default_root_for(documents: Option<PathBuf>, home: &Path) -> PathBuf {
    documents
        .unwrap_or_else(|| home.join("Documents"))
        .join("Easel-dsh")
}

/// Default data root: the OS Documents directory plus `Easel-dsh`.
pub(crate) fn default_data_root() -> PathBuf {
    if let Some(root) = env_path("EASEL_DATA_ROOT_DEFAULT") {
        return root;
    }
    default_root_for(dirs::document_dir(), &user_home())
}

/// Bootstrap pointer file; independent of the data root it points at.
pub(crate) fn data_root_config_path() -> PathBuf {
    if let Some(path) = env_path("EASEL_DATA_ROOT_CONFIG") {
        return path;
    }
    dirs::data_local_dir()
        .unwrap_or_else(|| user_home().join(".local").join("share"))
        .join("ai.easel.desktop")
        .join(DATA_ROOT_CONFIG)
}

#[derive(serde::Deserialize, serde::Serialize)]
struct DataRootPointer {
    version: u32,
    #[serde(rename = "dataRoot")]
    data_root: String,
    #[serde(rename = "previousRoot", default)]
    previous_root: Option<String>,
    #[serde(rename = "updatedAt", default)]
    updated_at: u64,
}

fn read_pointer_at(path: &Path) -> Option<DataRootPointer> {
    let raw = fs::read_to_string(path).ok()?;
    serde_json::from_str(&raw).ok()
}

enum PointerState {
    Missing,
    Available(PathBuf),
    /// The pointer exists but cannot be used; the message is user-facing.
    Unavailable(String),
}

fn pointer_state_at(path: &Path) -> PointerState {
    if !path.exists() {
        return PointerState::Missing;
    }
    let Some(pointer) = read_pointer_at(path) else {
        return PointerState::Unavailable(format!(
            "data-root pointer is unreadable: {}",
            path.display()
        ));
    };
    let root = PathBuf::from(pointer.data_root);
    if root.is_absolute() && root.is_dir() {
        PointerState::Available(root)
    } else {
        PointerState::Unavailable(format!(
            "data root is unavailable: {} (recorded in {})",
            root.display(),
            path.display()
        ))
    }
}

fn pointer_state() -> PointerState {
    pointer_state_at(&data_root_config_path())
}

fn pointer_unavailable() -> Option<String> {
    match pointer_state() {
        PointerState::Unavailable(message) => Some(message),
        _ => None,
    }
}

#[cfg(test)]
fn pointer_root_at(path: &Path) -> Option<PathBuf> {
    match pointer_state_at(path) {
        PointerState::Available(root) => Some(root),
        _ => None,
    }
}

fn write_pointer_at(path: &Path, root: &Path, previous: Option<&Path>) -> Result<(), String> {
    let pointer = DataRootPointer {
        version: 1,
        data_root: root.to_string_lossy().into_owned(),
        previous_root: previous.map(|path| path.to_string_lossy().into_owned()),
        updated_at: unix_now(),
    };
    write_json_atomic(
        path,
        &serde_json::to_value(pointer).map_err(|err| err.to_string())?,
    )
}

fn write_pointer(root: &Path, previous: Option<&Path>) -> Result<(), String> {
    write_pointer_at(&data_root_config_path(), root, previous)
}

fn unix_now() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|duration| duration.as_secs())
        .unwrap_or(0)
}

fn write_json_atomic(path: &Path, value: &serde_json::Value) -> Result<(), String> {
    let parent = path
        .parent()
        .ok_or_else(|| format!("no parent directory for {}", path.display()))?;
    fs::create_dir_all(parent).map_err(|err| format!("create {}: {err}", parent.display()))?;
    let tmp = path.with_extension("tmp");
    fs::write(
        &tmp,
        serde_json::to_string_pretty(value).map_err(|err| err.to_string())? + "\n",
    )
    .map_err(|err| format!("write {}: {err}", tmp.display()))?;
    fs::rename(&tmp, path).map_err(|err| format!("rename {}: {err}", path.display()))
}

/// Current data root: explicit env override, then the pointer, then the default.
pub(crate) fn data_root() -> PathBuf {
    if let Some(root) = env_path("EASEL_DATA_ROOT") {
        return root;
    }
    match pointer_state() {
        PointerState::Available(root) => root,
        _ => default_data_root(),
    }
}

/// Resolved data directory. Dev launches keep the legacy scratch paths; an
/// explicit `EASEL_DATA_ROOT` also opts a dev launch into the new layout.
pub(crate) fn data_dir() -> Option<PathBuf> {
    if env_path("EASEL_DATA_ROOT").is_some() {
        return Some(data_root());
    }
    if !is_installed() {
        return None;
    }
    Some(data_root())
}

fn marker_path(data: &Path) -> PathBuf {
    data.join(LAYOUT_MARKER)
}

fn marker_legacy_project_root(data: &Path) -> Option<PathBuf> {
    let raw = fs::read_to_string(marker_path(data)).ok()?;
    let value: serde_json::Value = serde_json::from_str(&raw).ok()?;
    value
        .get("legacyProjectRoot")
        .and_then(|value| value.as_str())
        .map(PathBuf::from)
}

/// Logical content root. Fresh installs use `<data_root>/workspace`; migrated
/// installs keep the legacy junction path so dsh's workspace records and
/// session grouping stay valid.
pub(crate) fn easel_home() -> PathBuf {
    if let Ok(home) = std::env::var("EASEL_HOME") {
        return PathBuf::from(home);
    }
    let Some(data) = data_dir() else {
        return legacy_workspace();
    };
    resolve_easel_home(&data, &legacy_workspace())
}

fn resolve_easel_home(data: &Path, legacy: &Path) -> PathBuf {
    let workspace = data.join("workspace");
    if workspace.exists() {
        if let Some(root) = marker_legacy_project_root(data) {
            // A real directory at the recorded path (or a live junction) keeps
            // the recorded project root. A dangling one — an interrupted
            // relocation — must not send dsh to a missing workspace.
            if root.exists() {
                return root;
            }
            return workspace;
        }
        // A crash between the move and the marker write leaves the junction in
        // place; keep the legacy logical path so workspaces do not split. A
        // dangling link (failed re-point) must fall back to the physical root.
        if is_reparse_point(legacy) && legacy.exists() {
            return legacy.to_path_buf();
        }
        return workspace;
    }
    if legacy.exists() {
        return legacy.to_path_buf();
    }
    workspace
}

/// Logical dsh home. The migration moves `~/.easel` to `<data_root>/home` and
/// leaves a junction/symlink at the old path for the CLI and old references.
pub(crate) fn dsh_home() -> PathBuf {
    if let Ok(home) = std::env::var("DSH_HOME") {
        return PathBuf::from(home);
    }
    let Some(data) = data_dir() else {
        return legacy_home();
    };
    resolve_dsh_home(&data, &legacy_home())
}

fn resolve_dsh_home(data: &Path, legacy: &Path) -> PathBuf {
    let home = data.join("home");
    if home.exists() {
        return home;
    }
    if legacy.exists() {
        return legacy.to_path_buf();
    }
    home
}

/// One-time, idempotent migration. Called before the shell reads any state or
/// spawns dsh. Failures are logged and leave the previous paths usable.
///
/// Windows v2 consolidated pre-layout data into `<install>/data`; every
/// platform then relocates the data root to the pointer/default root.
pub(crate) fn migrate() {
    if !is_installed() {
        return; // dev build or pre-layout install: nothing to do
    }
    if let Some(message) = pointer_unavailable() {
        // Never rebuild the default over a root that is merely unreachable
        // (unplugged drive, network share): that would orphan the real data
        // and make it unselectable later.
        let config = data_root_config_path();
        if let Some(parent) = config.parent() {
            log(parent, &message);
        }
        let _ = write_result_error(&message);
        return;
    }
    let target = data_root();
    if target.join(DATA_MIGRATING).exists() {
        let _ = fs::remove_dir_all(&target);
    }

    #[cfg(windows)]
    {
        if let Some(root) = install_root() {
            let legacy_data = root.join("data");
            let v2_done = marker_path(&legacy_data).exists()
                || marker_path(&target).exists()
                || looks_like_data(&target);
            if !v2_done {
                if let Err(err) = migrate_at(&root, &legacy_workspace(), &legacy_home()) {
                    log(&legacy_data, &format!("layout migration failed: {err}"));
                    return;
                }
            }
            // The pre-alpha.32 program tree (`<root>\app`) is removed by the
            // installer's POSTINSTALL hook, which owns the install directory;
            // startup never deletes program files.
        }
    }

    if let Err(err) = apply_pending_data_root() {
        log(&data_root(), &format!("pending data root failed: {err}"));
    }

    let target = data_root();
    if let Err(err) = migrate_to_root(&target) {
        log(&data_root(), &format!("data migration failed: {err}"));
        return;
    }
    if let Err(err) = ensure_links_at(&legacy_workspace(), &legacy_home(), &target) {
        log(&target, &format!("data links failed: {err}"));
    }
    if let Err(err) = ensure_pointer(&target) {
        log(&target, &format!("data pointer failed: {err}"));
    }
    if !target.join(DATA_MARKER).exists() {
        let _ = write_data_marker(&target, None);
    }
}

/// Apply a settings-page relocation request. The host half writes the pending
/// file and exits dsh; the supervisor calls this before the next spawn, so the
/// old server is never running while its files move.
pub(crate) fn apply_pending_data_root() -> Result<(), String> {
    if !is_installed() && env_path("EASEL_DATA_ROOT").is_none() {
        return Ok(()); // dev launch: never move the installed app's data
    }
    let config = data_root_config_path();
    let pending_path = config.with_file_name(DATA_ROOT_PENDING);
    let Some(target) = read_pending_at(&pending_path)? else {
        return Ok(());
    };
    if let Some(message) = pointer_unavailable() {
        // The recorded root is offline; applying the move would rewrite the
        // pointer and orphan the data on that root. Keep the request queued.
        let _ = write_result_error(&message);
        return Err(message);
    }
    let current = data_root();
    let result = (|| -> Result<(), String> {
        if is_reparse_point(&target) && same_path(&target, &current) {
            // Moving back to a previous root: the target is the old-root link.
            remove_link(&target)
                .map_err(|err| format!("remove old-root link {}: {err}", target.display()))?;
        }
        if same_path(&current, &target) {
            return Ok(());
        }
        validate_target_at(&current, &target, install_guard().as_deref())?;
        if looks_like_data(&current) {
            relocate_root(&current, &target, true)?;
        } else {
            migrate_to_root(&target)?;
        }
        // The data is at the target now; record it before link repair so a
        // link failure cannot send the next launch back to a missing root.
        write_pointer(&target, Some(&current))?;
        ensure_links_at(&legacy_workspace(), &legacy_home(), &target)?;
        write_data_marker(&target, Some(&current))?;
        Ok(())
    })();

    let _ = fs::remove_file(&pending_path);
    let result_path = config.with_file_name(DATA_ROOT_RESULT);
    let payload = match &result {
        Ok(()) => serde_json::json!({ "ok": true, "root": target }),
        Err(err) => serde_json::json!({ "ok": false, "target": target, "error": err }),
    };
    let _ = write_json_atomic(&result_path, &payload);
    result
}

fn migrate_to_root(target: &Path) -> Result<(), String> {
    if target.join(DATA_MIGRATING).exists() {
        // An interrupted cross-volume copy; the source is still intact.
        fs::remove_dir_all(target)
            .map_err(|err| format!("remove partial {}: {err}", target.display()))?;
    }
    if looks_like_data(target) {
        // The root already exists; only separate legacy roots (macOS/Linux)
        // may still need to join it.
        migrate_split_at(&legacy_workspace(), &legacy_home(), target)?;
        return Ok(());
    }

    #[cfg(windows)]
    {
        if let Some(root) = install_root() {
            let source = root.join("data");
            if looks_like_data(&source) {
                return relocate_root(&source, target, false);
            }
        }
        // v3 was a short-lived Windows-only WIP; keep one migration step for
        // machines that ran it.
        let v3 = user_home().join("Easel-dsh");
        if !same_path(&v3, target) && looks_like_data(&v3) {
            return relocate_root(&v3, target, true);
        }
    }

    migrate_split_at(&legacy_workspace(), &legacy_home(), target)?;
    fs::create_dir_all(target).map_err(|err| format!("create {}: {err}", target.display()))?;
    Ok(())
}

/// Move real legacy workspace/home directories into `target` and leave
/// symlinks at the old paths. Windows junctions are repointed by
/// `ensure_links_at` instead; target entries that already exist are left alone.
fn migrate_split_at(
    legacy_workspace: &Path,
    legacy_home: &Path,
    target: &Path,
) -> Result<(), String> {
    fs::create_dir_all(target).map_err(|err| format!("create {}: {err}", target.display()))?;
    for (legacy, sub) in [(legacy_workspace, "workspace"), (legacy_home, "home")] {
        let dest = target.join(sub);
        if dest.join(DATA_MIGRATING).exists() {
            fs::remove_dir_all(&dest)
                .map_err(|err| format!("remove partial {}: {err}", dest.display()))?;
        }
        // A crash between creating the destination and writing its marker
        // leaves an empty directory; retry from the still-intact legacy path.
        if dest.exists() && is_empty_dir(&dest) && legacy.is_dir() && !is_reparse_point(legacy) {
            fs::remove_dir(&dest)
                .map_err(|err| format!("remove empty {}: {err}", dest.display()))?;
        }
        if dest.exists() || is_reparse_point(legacy) || !legacy.is_dir() {
            continue;
        }
        let modules = legacy.join("node_modules");
        if is_reparse_point(&modules) {
            remove_link(&modules)?;
        }
        move_dir_verified(legacy, &dest)?;
        if let Some(parent) = legacy.parent() {
            let _ = fs::create_dir_all(parent);
        }
        if let Err(err) = create_link(legacy, &dest) {
            let _ = fs::rename(&dest, legacy);
            return Err(format!("link {}: {err}", legacy.display()));
        }
    }
    Ok(())
}

/// Move a whole data root. Same-volume rename is atomic; a cross-volume copy
/// stamps `.easel-migrating`, verifies the file count and byte total, then
/// removes the source. `leave_link` recreates the old root as a link so old
/// absolute project paths keep resolving.
fn relocate_root(source: &Path, target: &Path, leave_link: bool) -> Result<(), String> {
    if same_path(source, target) {
        return Ok(());
    }
    if !source.is_dir() {
        return Err(format!("source data root missing: {}", source.display()));
    }
    if is_reparse_point(source) {
        return Err(format!(
            "refusing to move a linked data root: {}",
            source.display()
        ));
    }
    if target.exists() {
        if target.join(DATA_MIGRATING).exists() {
            fs::remove_dir_all(target)
                .map_err(|err| format!("remove partial {}: {err}", target.display()))?;
        } else if looks_like_data(target) {
            return Ok(()); // already relocated
        } else if is_empty_dir(target) {
            fs::remove_dir(target).map_err(|err| format!("remove {}: {err}", target.display()))?;
        } else {
            return Err(format!("target directory not empty: {}", target.display()));
        }
    }

    // The home's node_modules junction points into app/runtime; copying it
    // would duplicate the closure, and the shell recreates it on next launch.
    let home_modules = source.join("home").join("node_modules");
    if is_reparse_point(&home_modules) {
        remove_link(&home_modules)?;
    }

    if let Some(parent) = target.parent() {
        fs::create_dir_all(parent).map_err(|err| format!("create {}: {err}", parent.display()))?;
    }
    if fs::rename(source, target).is_err() {
        ensure_free_space(source, target)?;
        fs::create_dir_all(target).map_err(|err| format!("create {}: {err}", target.display()))?;
        let marker = target.join(DATA_MIGRATING);
        fs::write(&marker, b"").map_err(|err| format!("write {}: {err}", marker.display()))?;
        copy_dir(source, target)?;
        let (source_files, source_bytes) = tree_stats(source)?;
        let (target_files, target_bytes) = tree_stats(target)?;
        if target_files != source_files.saturating_add(1) || target_bytes != source_bytes {
            return Err(format!(
                "copy verification failed: {source_files} files/{source_bytes} bytes -> {target_files} files/{target_bytes} bytes"
            ));
        }
        fs::remove_file(&marker).map_err(|err| format!("remove {}: {err}", marker.display()))?;
        // A locked source must not fail a completed move; the pointer is the
        // authority and the stale source can be removed manually.
        let _ = fs::remove_dir_all(source);
    }

    if leave_link && !source.exists() {
        let inside_install = install_guard()
            .map(|guard| is_within(source, &guard))
            .unwrap_or(false);
        if !inside_install {
            if let Some(parent) = source.parent() {
                let _ = fs::create_dir_all(parent);
            }
            let _ = create_link(source, target);
        }
    }
    Ok(())
}

fn ensure_links_at(
    legacy_workspace: &Path,
    legacy_home: &Path,
    target: &Path,
) -> Result<(), String> {
    for (legacy, sub) in [(legacy_workspace, "workspace"), (legacy_home, "home")] {
        if !is_reparse_point(legacy) {
            continue;
        }
        let dest = target.join(sub);
        if !dest.exists() {
            return Err(format!("link target missing: {}", dest.display()));
        }
        if fs::read_link(legacy)
            .map(|current| same_path(&current, &dest))
            .unwrap_or(false)
        {
            continue;
        }
        remove_link(legacy).map_err(|err| format!("remove link {}: {err}", legacy.display()))?;
        create_link(legacy, &dest).map_err(|err| {
            format!("link {} -> {}: {err}", legacy.display(), dest.display())
        })?;
    }
    Ok(())
}

fn validate_target_at(
    current: &Path,
    target: &Path,
    install: Option<&Path>,
) -> Result<(), String> {
    if !target.is_absolute() {
        return Err("data root must be an absolute path".into());
    }
    // Selecting an old-root link is a move back: the link resolves to the
    // current root, and apply_pending removes it before relocating.
    let target_links_to_current = target.exists()
        && is_reparse_point(target)
        && fs::canonicalize(target)
            .ok()
            .zip(fs::canonicalize(current).ok())
            .map(|(target, current)| target == current)
            .unwrap_or(false);
    if same_path(current, target) && !target_links_to_current {
        return Err("target is the current data root".into());
    }
    if is_within(target, current) || is_within(current, target) {
        return Err("target overlaps the current data root".into());
    }
    if let Some(install) = install {
        if same_path(target, install) || is_within(target, install) {
            return Err("target is inside the application directory".into());
        }
    }
    if target_links_to_current {
        return Ok(());
    }
    if target.exists() {
        if target.join(DATA_MIGRATING).exists() {
            // An interrupted copy; relocate_root discards it and retries.
        } else if target.join(DATA_MARKER).exists() || looks_like_data(target) {
            return Err("target already contains an Easel data root".into());
        } else if !is_empty_dir(target) {
            return Err("target directory is not empty".into());
        }
    }
    Ok(())
}

fn ensure_pointer(target: &Path) -> Result<(), String> {
    match pointer_state() {
        PointerState::Missing => write_pointer(target, None),
        // A present pointer is authoritative; an unavailable or malformed one
        // was already reported by migrate() and must not be overwritten.
        _ => Ok(()),
    }
}

fn write_result_error(message: &str) -> Result<(), String> {
    let path = data_root_config_path().with_file_name(DATA_ROOT_RESULT);
    write_json_atomic(&path, &serde_json::json!({ "ok": false, "error": message }))
}

/// Whether a settings-page relocation is queued; the supervisor uses it to
/// treat the host's exit as intentional rather than a crash.
pub(crate) fn has_pending_data_root() -> bool {
    read_pending_at(&data_root_config_path().with_file_name(DATA_ROOT_PENDING))
        .ok()
        .flatten()
        .is_some()
}

fn read_pending_at(path: &Path) -> Result<Option<PathBuf>, String> {
    let raw = match fs::read_to_string(path) {
        Ok(raw) => raw,
        Err(err) if err.kind() == ErrorKind::NotFound => return Ok(None),
        Err(err) => return Err(format!("read {}: {err}", path.display())),
    };
    let value: serde_json::Value =
        serde_json::from_str(&raw).map_err(|err| format!("parse {}: {err}", path.display()))?;
    let target = value
        .get("target")
        .and_then(|value| value.as_str())
        .ok_or_else(|| format!("{} has no target", path.display()))?;
    let target = PathBuf::from(target);
    if !target.is_absolute() {
        return Err(format!("{} target is not absolute", path.display()));
    }
    Ok(Some(target))
}

fn write_data_marker(dest: &Path, previous: Option<&Path>) -> Result<(), String> {
    let marker = serde_json::json!({
        "dataRoot": dest.to_string_lossy(),
        "previousRoot": previous.map(|path| path.to_string_lossy().into_owned()),
        "updatedAt": unix_now(),
    });
    write_json_atomic(&dest.join(DATA_MARKER), &marker)
}

fn looks_like_data(dir: &Path) -> bool {
    dir.join("workspace").is_dir()
        || dir.join("home").is_dir()
        || dir.join(DATA_MARKER).is_file()
        || dir.join(LAYOUT_MARKER).is_file()
}

fn tree_stats(path: &Path) -> Result<(u64, u64), String> {
    let mut files = 0u64;
    let mut bytes = 0u64;
    let mut stack = vec![path.to_path_buf()];
    while let Some(dir) = stack.pop() {
        for entry in fs::read_dir(&dir).map_err(|err| format!("read {}: {err}", dir.display()))? {
            let entry = entry.map_err(|err| err.to_string())?;
            let entry_path = entry.path();
            if is_reparse_point(&entry_path) {
                continue;
            }
            let meta = entry.metadata().map_err(|err| err.to_string())?;
            if meta.is_dir() {
                stack.push(entry_path);
            } else {
                files += 1;
                bytes += meta.len();
            }
        }
    }
    Ok((files, bytes))
}

fn is_empty_dir(path: &Path) -> bool {
    fs::read_dir(path)
        .map(|mut entries| entries.next().is_none())
        .unwrap_or(false)
}

fn same_path(a: &Path, b: &Path) -> bool {
    normalize(&canonical_for_compare(a)) == normalize(&canonical_for_compare(b))
}

/// Canonicalize the nearest existing ancestor and re-append the remainder, so
/// a not-yet-created target under a junction alias still compares by its real
/// location.
fn canonical_for_compare(path: &Path) -> PathBuf {
    if let Ok(canonical) = fs::canonicalize(path) {
        return canonical;
    }
    let mut tail: Vec<std::ffi::OsString> = Vec::new();
    let mut cursor = path;
    while let Some(parent) = cursor.parent() {
        if let Some(name) = cursor.file_name() {
            tail.push(name.to_os_string());
        }
        if let Ok(canonical) = fs::canonicalize(parent) {
            let mut out = canonical;
            for name in tail.iter().rev() {
                out.push(name);
            }
            return out;
        }
        cursor = parent;
    }
    path.to_path_buf()
}

fn is_within(child: &Path, parent: &Path) -> bool {
    let child = normalize(&canonical_for_compare(child));
    let parent = normalize(&canonical_for_compare(parent));
    let parent = parent.trim_end_matches('/');
    child.len() > parent.len() && child.starts_with(&format!("{parent}/"))
}

fn normalize(path: &Path) -> String {
    let text = path.to_string_lossy().replace('\\', "/");
    #[cfg(windows)]
    {
        text.to_lowercase()
    }
    #[cfg(not(windows))]
    {
        text
    }
}

fn migrate_at(root: &Path, legacy_workspace: &Path, legacy_home: &Path) -> Result<(), String> {
    let data = root.join("data");
    fs::create_dir_all(&data).map_err(|e| format!("create data dir: {e}"))?;
    let workspace = data.join("workspace");
    let home = data.join("home");
    let mut legacy_project_root: Option<PathBuf> = None;
    if workspace.exists()
        && is_empty_dir(&workspace)
        && legacy_workspace.is_dir()
        && !is_reparse_point(legacy_workspace)
    {
        fs::remove_dir(&workspace)
            .map_err(|err| format!("remove empty {}: {err}", workspace.display()))?;
    }
    for partial in [&workspace, &home] {
        if partial.join(DATA_MIGRATING).exists() {
            fs::remove_dir_all(partial)
                .map_err(|err| format!("remove partial {}: {err}", partial.display()))?;
        }
    }

    if workspace.exists() {
        if is_reparse_point(legacy_workspace) {
            legacy_project_root = Some(legacy_workspace.to_path_buf());
        }
        // Both real directories: leave them alone. Resolving a user-made
        // duplicate is a manual decision, not something a boot should guess.
    } else if legacy_workspace.exists() && !is_reparse_point(legacy_workspace) {
        move_dir_verified(legacy_workspace, &workspace)?;
        if let Err(err) = create_link(legacy_workspace, &workspace) {
            let _ = fs::rename(&workspace, legacy_workspace);
            return Err(format!("create workspace junction: {err}"));
        }
        legacy_project_root = Some(legacy_workspace.to_path_buf());
    }

    // The old node_modules junction points into the pre-layout runtime. Drop
    // it before moving the home; copying a home with a live junction would
    // duplicate the whole closure, and rename would carry the stale target.
    let legacy_modules = legacy_home.join("node_modules");
    if is_reparse_point(&legacy_modules) {
        let _ = remove_link(&legacy_modules);
    }
    if home.exists()
        && is_empty_dir(&home)
        && legacy_home.is_dir()
        && !is_reparse_point(legacy_home)
    {
        fs::remove_dir(&home).map_err(|err| format!("remove empty {}: {err}", home.display()))?;
    }
    if !home.exists() && legacy_home.exists() && !is_reparse_point(legacy_home) {
        move_dir_verified(legacy_home, &home)?;
        if let Err(err) = create_link(legacy_home, &home) {
            let _ = fs::rename(&home, legacy_home);
            return Err(format!("create home junction: {err}"));
        }
    }
    // A copied/recreated home must not carry a stale junction either.
    let home_modules = home.join("node_modules");
    if is_reparse_point(&home_modules) {
        let _ = remove_link(&home_modules);
    }

    let marker = serde_json::json!({
        "legacyProjectRoot": legacy_project_root
            .as_ref()
            .map(|path| path.to_string_lossy().into_owned()),
    });
    fs::write(
        marker_path(&data),
        serde_json::to_string_pretty(&marker).map_err(|e| e.to_string())? + "\n",
    )
    .map_err(|e| format!("write layout marker: {e}"))?;

    log(&data, "layout migration complete");
    Ok(())
}

/// Move a directory, using the same crash-safe staging as a data root when the
/// move has to copy across volumes. A destination carrying `.easel-migrating`
/// is incomplete and is discarded by the caller on the next launch.
fn move_dir_verified(src: &Path, dest: &Path) -> Result<(), String> {
    if let Some(parent) = dest.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    if fs::rename(src, dest).is_ok() {
        return Ok(());
    }
    ensure_free_space(src, dest)?;
    fs::create_dir_all(dest).map_err(|err| format!("create {}: {err}", dest.display()))?;
    let marker = dest.join(DATA_MIGRATING);
    fs::write(&marker, b"").map_err(|err| format!("write {}: {err}", marker.display()))?;
    copy_dir(src, dest).map_err(|e| format!("copy {}: {e}", src.display()))?;
    let (source_files, source_bytes) = tree_stats(src)?;
    let (target_files, target_bytes) = tree_stats(dest)?;
    if target_files != source_files.saturating_add(1) || target_bytes != source_bytes {
        return Err(format!(
            "copy verification failed: {} -> {}",
            src.display(),
            dest.display()
        ));
    }
    fs::remove_file(&marker).map_err(|err| format!("remove {}: {err}", marker.display()))?;
    fs::remove_dir_all(src).map_err(|e| format!("remove {}: {e}", src.display()))
}

fn ensure_free_space(source: &Path, target: &Path) -> Result<(), String> {
    let (_, bytes) = tree_stats(source)?;
    let probe = target.parent().filter(|parent| parent.exists()).unwrap_or(target);
    let Some(free) = free_space_bytes(probe) else {
        return Ok(()); // the platform refused the query; do not block the move
    };
    let required = bytes.saturating_add(bytes / 20);
    if free < required {
        return Err(format!(
            "not enough free space at {}: need {} bytes, have {}",
            probe.display(),
            required,
            free
        ));
    }
    Ok(())
}

#[cfg(windows)]
fn free_space_bytes(path: &Path) -> Option<u64> {
    use std::os::windows::ffi::OsStrExt;
    use windows_sys::Win32::Storage::FileSystem::GetDiskFreeSpaceExW;
    let wide: Vec<u16> = path
        .as_os_str()
        .encode_wide()
        .chain(std::iter::once(0))
        .collect();
    let mut free: u64 = 0;
    let ok = unsafe {
        GetDiskFreeSpaceExW(wide.as_ptr(), &mut free, std::ptr::null_mut(), std::ptr::null_mut())
    };
    (ok != 0).then_some(free)
}

#[cfg(unix)]
fn free_space_bytes(path: &Path) -> Option<u64> {
    use std::ffi::CString;
    use std::os::unix::ffi::OsStrExt;
    let path = CString::new(path.as_os_str().as_bytes()).ok()?;
    let mut stat: libc::statvfs = unsafe { std::mem::zeroed() };
    let rc = unsafe { libc::statvfs(path.as_ptr(), &mut stat) };
    (rc == 0).then(|| stat.f_bavail as u64 * stat.f_frsize as u64)
}

fn log(data: &Path, message: &str) {
    let _ = fs::create_dir_all(data);
    if let Ok(mut file) = fs::OpenOptions::new()
        .create(true)
        .append(true)
        .open(data.join("layout-migration.log"))
    {
        use std::io::Write;
        let _ = writeln!(file, "{message}");
    }
}

#[cfg(windows)]
pub(crate) fn is_reparse_point(path: &Path) -> bool {
    use std::os::windows::fs::MetadataExt;
    fs::symlink_metadata(path)
        .map(|meta| meta.file_attributes() & 0x400 != 0)
        .unwrap_or(false)
}

#[cfg(not(windows))]
pub(crate) fn is_reparse_point(path: &Path) -> bool {
    fs::symlink_metadata(path)
        .map(|meta| meta.file_type().is_symlink())
        .unwrap_or(false)
}

pub(crate) fn create_link(link: &Path, target: &Path) -> Result<(), String> {
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x0800_0000;
        let mut cmd = std::process::Command::new("cmd");
        cmd.creation_flags(CREATE_NO_WINDOW);
        let status = cmd
            .args(["/c", "mklink", "/J"])
            .arg(link)
            .arg(target)
            .output()
            .map_err(|e| format!("mklink failed: {e}"))?;
        if !status.status.success() {
            return Err(format!(
                "mklink failed ({}) link={} target={} out={} err={}",
                status.status,
                link.display(),
                target.display(),
                String::from_utf8_lossy(&status.stdout).trim(),
                String::from_utf8_lossy(&status.stderr).trim()
            ));
        }
        Ok(())
    }
    #[cfg(not(windows))]
    {
        std::os::unix::fs::symlink(target, link).map_err(|e| e.to_string())
    }
}

pub(crate) fn remove_link(link: &Path) -> Result<(), String> {
    #[cfg(windows)]
    {
        // RemoveDirectoryW deletes the junction entry without descending into
        // its target; std::fs::remove_dir is exactly that call.
        fs::remove_dir(link).map_err(|e| e.to_string())
    }
    #[cfg(not(windows))]
    {
        fs::remove_file(link).map_err(|e| e.to_string())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn temp_dir(tag: &str) -> PathBuf {
        let dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .join("target")
            .join("tmp")
            .join(format!("easel-layout-test-{tag}"));
        let _ = fs::remove_dir_all(&dir);
        dir
    }

    fn write(path: &Path, contents: &str) {
        fs::create_dir_all(path.parent().unwrap()).unwrap();
        fs::write(path, contents).unwrap();
    }

    fn remove_test_dir(root: &Path) {
        if is_reparse_point(root) {
            let _ = remove_link(root);
            return;
        }
        if let Ok(entries) = fs::read_dir(root) {
            for entry in entries.flatten() {
                let path = entry.path();
                if is_reparse_point(&path) {
                    let _ = remove_link(&path);
                }
            }
        }
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn install_root_accepts_the_legacy_app_layout_and_the_flat_marker() {
        // Pre-alpha.32 split layout: the exe sits one level under the root.
        assert_eq!(
            install_root_from_exe(Path::new("C:/x/Easel-dsh/app/dsh-desktop.exe")),
            Some(PathBuf::from("C:/x/Easel-dsh"))
        );
        // Flat layout without the bundled runtime marker: not an install.
        assert_eq!(
            install_root_from_exe(Path::new("C:/x/Easel-dsh/dsh-desktop.exe")),
            None
        );
        assert_eq!(
            install_root_from_exe(Path::new("C:/x/target/debug/dsh-desktop.exe")),
            None
        );
        // Flat layout with the bundled runtime marker: the exe's own
        // directory is the install root.
        let root = temp_dir("install-root-marker");
        let exe = root.join("dsh-desktop.exe");
        let manifest = root.join("runtime").join("manifest.json");
        fs::create_dir_all(manifest.parent().unwrap()).unwrap();
        fs::write(&manifest, "{}").unwrap();
        assert_eq!(install_root_from_exe(&exe), Some(root.clone()));
        remove_test_dir(&root);
    }

    #[test]
    fn default_root_uses_documents() {
        assert_eq!(
            default_root_for(
                Some(PathBuf::from("C:/Users/u/Documents")),
                Path::new("C:/Users/u")
            ),
            PathBuf::from("C:/Users/u/Documents/Easel-dsh")
        );
        assert_eq!(
            default_root_for(None, Path::new("C:/Users/u")),
            PathBuf::from("C:/Users/u/Documents/Easel-dsh")
        );
    }

    #[test]
    fn fresh_layout_resolves_to_data_paths() {
        let data = temp_dir("resolve-fresh").join("data");
        let legacy = data.join("legacy");
        assert_eq!(resolve_easel_home(&data, &legacy), data.join("workspace"));
        assert_eq!(resolve_dsh_home(&data, &legacy), data.join("home"));
    }

    #[test]
    fn pointer_roundtrip_prefers_existing_root() {
        let root = temp_dir("pointer");
        let file = root.join("config").join(DATA_ROOT_CONFIG);
        let target = root.join("Easel-dsh");
        fs::create_dir_all(&target).unwrap();

        write_pointer_at(&file, &target, None).unwrap();
        assert_eq!(pointer_root_at(&file), Some(target.clone()));
        let pointer = read_pointer_at(&file).unwrap();
        assert_eq!(pointer.version, 1);
        assert_eq!(PathBuf::from(pointer.data_root), target);

        fs::remove_dir_all(&target).unwrap();
        assert_eq!(pointer_root_at(&file), None, "missing root falls back");

        remove_test_dir(&root);
    }

    #[test]
    fn pending_file_roundtrip() {
        let root = temp_dir("pending");
        let file = root.join(DATA_ROOT_PENDING);
        let target = root.join("target");
        write_json_atomic(
            &file,
            &serde_json::json!({ "version": 1, "target": target, "requestedAt": 0 }),
        )
        .unwrap();
        assert_eq!(read_pending_at(&file).unwrap(), Some(target));

        remove_test_dir(&root);
    }

    #[test]
    fn validate_target_rejects_overlaps_and_existing_roots() {
        let root = temp_dir("validate");
        let current = root.join("current");
        fs::create_dir_all(&current).unwrap();
        let install = root.join("install");

        assert!(validate_target_at(&current, &current, None).is_err());
        assert!(validate_target_at(&current, &current.join("child"), None).is_err());
        assert!(validate_target_at(&current, &root, None).is_err());
        assert!(validate_target_at(&current, &install.join("data"), Some(&install)).is_err());

        let target = root.join("target");
        fs::create_dir_all(&target).unwrap();
        assert!(validate_target_at(&current, &target, None).is_ok());

        let existing = root.join("existing");
        write(&existing.join("workspace").join("idea.json"), "idea");
        assert!(validate_target_at(&current, &existing, None).is_err());

        remove_test_dir(&root);
    }

    #[test]
    fn relocate_root_moves_tree_and_leaves_a_link() {
        let root = temp_dir("relocate");
        let source = root.join("source-root");
        let target = root.join("Documents").join("Easel-dsh");
        write(
            &source.join("workspace").join("outputs").join("idea.json"),
            "idea",
        );
        write(
            &source
                .join("home")
                .join("profiles")
                .join("web")
                .join("cordis.patch.yml"),
            "patch",
        );

        relocate_root(&source, &target, true).unwrap();

        assert_eq!(
            fs::read_to_string(target.join("workspace").join("outputs").join("idea.json")).unwrap(),
            "idea"
        );
        assert_eq!(
            fs::read_to_string(
                target
                    .join("home")
                    .join("profiles")
                    .join("web")
                    .join("cordis.patch.yml")
            )
            .unwrap(),
            "patch"
        );
        assert!(is_reparse_point(&source));
        assert_eq!(
            fs::read_to_string(source.join("workspace").join("outputs").join("idea.json")).unwrap(),
            "idea"
        );

        remove_test_dir(&root);
    }

    #[test]
    fn relocate_root_refuses_a_non_empty_target() {
        let root = temp_dir("relocate-ambiguous");
        let source = root.join("source-root");
        let target = root.join("target");
        write(&source.join("workspace").join("idea.json"), "idea");
        write(&target.join("notes.txt"), "user");

        let error = relocate_root(&source, &target, false).unwrap_err();
        assert!(error.contains("not empty"));
        assert!(source.join("workspace").join("idea.json").exists());
        assert_eq!(fs::read_to_string(target.join("notes.txt")).unwrap(), "user");

        remove_test_dir(&root);
    }

    #[test]
    fn migrate_split_moves_legacy_paths_and_links() {
        let root = temp_dir("split");
        let legacy_workspace = root.join("legacy-easel");
        let legacy_home = root.join("legacy-home");
        let target = root.join("data-root");
        write(
            &legacy_workspace.join("outputs").join("idea.json"),
            "idea",
        );
        write(
            &legacy_home
                .join("profiles")
                .join("web")
                .join("cordis.patch.yml"),
            "patch",
        );

        migrate_split_at(&legacy_workspace, &legacy_home, &target).unwrap();

        assert!(target.join("workspace").join("outputs").join("idea.json").exists());
        assert!(target
            .join("home")
            .join("profiles")
            .join("web")
            .join("cordis.patch.yml")
            .exists());
        assert!(is_reparse_point(&legacy_workspace));
        assert!(is_reparse_point(&legacy_home));
        assert_eq!(
            fs::read_to_string(legacy_workspace.join("outputs").join("idea.json")).unwrap(),
            "idea"
        );

        remove_test_dir(&root);
    }

    #[test]
    fn pointer_to_missing_root_is_unavailable_and_kept() {
        let root = temp_dir("pointer-missing");
        let file = root.join("data-root.json");
        let missing = root.join("gone");
        write_pointer_at(&file, &missing, None).unwrap();

        match pointer_state_at(&file) {
            PointerState::Unavailable(message) => assert!(message.contains("gone")),
            _ => panic!("a missing root must be reported, not treated as missing pointer"),
        }
        assert!(fs::read_to_string(&file).unwrap().contains("gone"));

        remove_test_dir(&root);
    }

    #[test]
    fn move_back_accepts_the_old_root_link() {
        let root = temp_dir("move-back");
        let current = root.join("current");
        let old = root.join("old");
        write(&current.join("workspace").join("idea.json"), "idea");
        create_link(&old, &current).unwrap();

        assert!(validate_target_at(&current, &old, None).is_ok());
        remove_link(&old).unwrap();
        relocate_root(&current, &old, true).unwrap();
        assert_eq!(
            fs::read_to_string(old.join("workspace").join("idea.json")).unwrap(),
            "idea"
        );

        remove_test_dir(&root);
    }

    #[test]
    fn relocate_root_discards_an_interrupted_target() {
        let root = temp_dir("partial-target");
        let source = root.join("source-root");
        let target = root.join("target");
        write(&source.join("workspace").join("idea.json"), "idea");
        write(&target.join(DATA_MIGRATING), "");
        write(&target.join("workspace").join("stale.json"), "stale");

        relocate_root(&source, &target, false).unwrap();

        assert_eq!(
            fs::read_to_string(target.join("workspace").join("idea.json")).unwrap(),
            "idea"
        );
        assert!(!target.join("workspace").join("stale.json").exists());
        assert!(!target.join(DATA_MIGRATING).exists());

        remove_test_dir(&root);
    }

    #[test]
    fn split_move_discards_an_interrupted_workspace() {
        let root = temp_dir("split-partial");
        let legacy_workspace = root.join("legacy-easel");
        let legacy_home = root.join("legacy-home");
        let target = root.join("data-root");
        write(&legacy_workspace.join("outputs").join("idea.json"), "idea");
        write(
            &legacy_home.join("profiles").join("web").join("cordis.patch.yml"),
            "patch",
        );
        write(&target.join("workspace").join(DATA_MIGRATING), "");
        write(&target.join("workspace").join("stale.json"), "stale");

        migrate_split_at(&legacy_workspace, &legacy_home, &target).unwrap();

        assert!(target.join("workspace").join("outputs").join("idea.json").exists());
        assert!(!target.join("workspace").join("stale.json").exists());

        remove_test_dir(&root);
    }

    #[test]
    fn ensure_links_is_idempotent() {
        let root = temp_dir("links-idem");
        let legacy_workspace = root.join("legacy-easel");
        let legacy_home = root.join("legacy-home");
        let target = root.join("data-root");
        write(&legacy_workspace.join("outputs").join("idea.json"), "idea");
        write(&legacy_home.join("profiles").join("web").join("cordis.patch.yml"), "patch");

        migrate_split_at(&legacy_workspace, &legacy_home, &target).unwrap();
        ensure_links_at(&legacy_workspace, &legacy_home, &target).unwrap();
        ensure_links_at(&legacy_workspace, &legacy_home, &target).unwrap();

        assert_eq!(
            fs::read_to_string(legacy_workspace.join("outputs").join("idea.json")).unwrap(),
            "idea"
        );

        remove_test_dir(&root);
    }

    #[test]
    fn dangling_legacy_link_without_marker_falls_back() {
        let root = temp_dir("dangling-link");
        let data = root.join("data");
        let legacy = root.join("legacy-easel");
        let gone = root.join("gone");
        fs::create_dir_all(&gone).unwrap();
        create_link(&legacy, &gone).unwrap();
        fs::remove_dir_all(&gone).unwrap();
        write(&data.join("workspace").join("idea.json"), "idea");

        assert_eq!(resolve_easel_home(&data, &legacy), data.join("workspace"));

        remove_test_dir(&root);
    }

    #[test]
    fn migration_moves_data_leaves_junctions_and_marker() {
        let root = temp_dir("migrate");
        let legacy_workspace = root.join("legacy-easel");
        let legacy_home = root.join("legacy-home");
        write(
            &legacy_workspace.join("outputs").join("idea.json"),
            "idea",
        );
        write(
            &legacy_home
                .join("profiles")
                .join("web")
                .join("cordis.patch.yml"),
            "patch",
        );
        write(
            &legacy_home.join("sessions").join("s1").join("session.jsonl"),
            "{}",
        );
        // A stale node_modules junction must not be carried into data\home.
        // Join components separately: a literal "a/b" keeps forward slashes
        // on Windows, and mklink would read them as switches.
        let closure = root.join("old-runtime").join("dsh").join("node_modules");
        fs::create_dir_all(&closure).unwrap();
        create_link(&legacy_home.join("node_modules"), &closure).unwrap();
        // Program files are not the data migration's business anymore: the
        // installer owns the install tree, so `app\` and root-level program
        // entries must survive `migrate_at` untouched.
        write(
            &root.join("runtime").join("dsh").join("lib").join("bin.js"),
            "program",
        );
        write(&root.join("dsh-desktop.exe"), "program exe");
        write(&root.join("uninstall.exe"), "program uninstaller");
        fs::create_dir_all(root.join("app")).unwrap();

        migrate_at(&root, &legacy_workspace, &legacy_home).unwrap();

        let data = root.join("data");
        assert_eq!(
            fs::read_to_string(
                data.join("workspace")
                    .join("outputs")
                    .join("idea.json")
            )
            .unwrap(),
            "idea"
        );
        assert_eq!(
            fs::read_to_string(
                data.join("home")
                    .join("profiles")
                    .join("web")
                    .join("cordis.patch.yml")
            )
            .unwrap(),
            "patch"
        );
        assert_eq!(
            fs::read_to_string(
                data.join("home")
                    .join("sessions")
                    .join("s1")
                    .join("session.jsonl")
            )
            .unwrap(),
            "{}"
        );
        assert!(is_reparse_point(&legacy_workspace));
        assert!(is_reparse_point(&legacy_home));
        assert!(!data.join("home").join("node_modules").exists());
        assert_eq!(
            fs::read_to_string(root.join("runtime").join("dsh").join("lib").join("bin.js"))
                .unwrap(),
            "program"
        );
        assert!(root.join("dsh-desktop.exe").exists());
        assert!(root.join("uninstall.exe").exists());
        assert!(root.join("app").exists());
        let marker = fs::read_to_string(data.join(LAYOUT_MARKER)).unwrap();
        assert!(marker.contains("legacyProjectRoot"));
        assert_eq!(
            resolve_easel_home(&data, &legacy_workspace),
            legacy_workspace
        );

        remove_test_dir(&root);
    }

    #[test]
    fn migration_is_idempotent() {
        let root = temp_dir("migrate-idem");
        let legacy_workspace = root.join("legacy-easel");
        let legacy_home = root.join("legacy-home");
        write(
            &legacy_workspace.join("outputs").join("idea.json"),
            "idea",
        );
        write(
            &legacy_home
                .join("profiles")
                .join("web")
                .join("cordis.patch.yml"),
            "patch",
        );
        fs::create_dir_all(root.join("app")).unwrap();

        migrate_at(&root, &legacy_workspace, &legacy_home).unwrap();
        migrate_at(&root, &legacy_workspace, &legacy_home).unwrap();

        let data = root.join("data");
        assert_eq!(
            fs::read_to_string(
                data.join("workspace")
                    .join("outputs")
                    .join("idea.json")
            )
            .unwrap(),
            "idea"
        );
        assert_eq!(
            fs::read_to_string(
                data.join("home")
                    .join("profiles")
                    .join("web")
                    .join("cordis.patch.yml")
            )
            .unwrap(),
            "patch"
        );

        remove_test_dir(&root);
    }

    #[test]
    fn dangling_legacy_project_root_falls_back_to_workspace() {
        let root = temp_dir("dangling");
        let data = root.join("data");
        let legacy_workspace = root.join("legacy-easel");
        let target = root.join("moved-away");
        fs::create_dir_all(&target).unwrap();
        create_link(&legacy_workspace, &target).unwrap();
        fs::remove_dir_all(&target).unwrap();
        write(&data.join("workspace").join("idea.json"), "idea");
        let marker = serde_json::json!({ "legacyProjectRoot": legacy_workspace.to_string_lossy() });
        fs::write(data.join(LAYOUT_MARKER), marker.to_string()).unwrap();

        assert_eq!(
            resolve_easel_home(&data, &legacy_workspace),
            data.join("workspace")
        );

        remove_test_dir(&root);
    }
}
