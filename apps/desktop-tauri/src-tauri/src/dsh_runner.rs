//! Owns the bundled `dsh web` child process: spawn, port health probe,
//! automatic crash restart, and clean teardown on app exit.

use std::net::TcpStream;
use std::path::{Path, PathBuf};
use std::process::Stdio;
use std::sync::atomic::{AtomicBool, AtomicU16, Ordering};
use std::sync::Arc;
use std::sync::Mutex as LaunchUrlMutex;
use std::time::Duration;

use serde::{Deserialize, Serialize};
// The WebView2 path is the only one that pre-installs a native cookie.
#[cfg(windows)]
use tauri::webview::{
    cookie::{time::Duration as CookieDuration, SameSite},
    Cookie,
};
#[cfg(not(windows))]
use tauri::webview::NewWindowFeatures;
use tauri::{AppHandle, Emitter, Manager, Url};
use tokio::io::{AsyncBufReadExt, AsyncRead, AsyncReadExt, AsyncSeekExt, AsyncWriteExt};
use tokio::process::{Child, Command};
use tokio::sync::Mutex;

use crate::INTERNAL_PORT;

const RESTART_LIMIT: u32 = 3;
const LOG_NAME: &str = "dsh-web.log";
/// Upper bound of the fallback port scan when `INTERNAL_PORT` is occupied.
const PORT_SCAN_LIMIT: u16 = 50;
/// Records the server this home last started, so a later shell can adopt it
/// instead of paying the whole `dsh web` boot again.
const SERVER_RECORD_NAME: &str = "desktop-server.json";
/// Loopback probe budget for the adopt check. A live server answers in
/// milliseconds; anything slower is treated as absent so the cold path never
/// waits on a dead record.
const ADOPT_PROBE_TIMEOUT: Duration = Duration::from_millis(500);

// EASEL-DIVERGENCE(desktop-startup-latency L2 Layer 1): replay list in
// docs/compose/specs/easel-standalone-client.md.
/// The live server a previous shell start left behind, named by the launch URL
/// it printed. The token is per process, so accepting it proves the server on
/// that port is the one this home started rather than a recycled port or a
/// foreign listener.
#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
struct ServerRecord {
    port: u16,
    url: String,
    pid: u32,
    /// Runtime closure the recorded server was started from; a shell may only
    /// adopt a server from its own build.
    bin: String,
    bin_len: u64,
    bin_modified_ms: u64,
}

/// Handle to the managed dsh child process. `child` is `None` while the
/// process is down and about to be (or already) restarted.
pub struct DshHandle {
    child: Arc<Mutex<Option<Child>>>,
    stopping: Arc<AtomicBool>,
    /// A restart asked for the current server's replacement: the supervisor
    /// must not adopt the very hub this flag is meant to retire.
    restarting: Arc<AtomicBool>,
    port: Arc<AtomicU16>,
    launch_url: Arc<LaunchUrlMutex<Option<String>>>,
    node_path: PathBuf,
    dsh_bin: PathBuf,
}

/// The authenticated Web origin handed to the desktop iframe.
#[derive(Clone, Serialize)]
pub struct DshEndpoint {
    pub url: Option<String>,
}

impl DshHandle {
    /// Resolves the bundled runtime and spawns the supervisor loop.
    pub fn spawn(app: &AppHandle) -> Result<Self, String> {
        let (node_path, dsh_bin) = resolve_runtime(app)?;
        let handle = Self {
            child: Arc::new(Mutex::new(None)),
            stopping: Arc::new(AtomicBool::new(false)),
            restarting: Arc::new(AtomicBool::new(false)),
            port: Arc::new(AtomicU16::new(INTERNAL_PORT)),
            launch_url: Arc::new(LaunchUrlMutex::new(None)),
            node_path,
            dsh_bin,
        };
        let loop_handle = Self {
            child: handle.child.clone(),
            stopping: handle.stopping.clone(),
            restarting: handle.restarting.clone(),
            port: handle.port.clone(),
            launch_url: handle.launch_url.clone(),
            node_path: handle.node_path.clone(),
            dsh_bin: handle.dsh_bin.clone(),
        };
        let app_owned = (*app).clone();
        tauri::async_runtime::spawn(async move { loop_handle.supervise(app_owned).await });
        Ok(handle)
    }

    /// Supervision loop: spawn, wait for ready or exit, then restart on
    /// unexpected exit (unless another process already took the port, which
    /// happens when the dsh-plugin market restarts the server itself).
    async fn supervise(&self, app: AppHandle) {
        let mut restarts = 0u32;
        loop {
            if self.stopping.load(Ordering::SeqCst) {
                return;
            }
            // Adopt the server an earlier shell start left running. Repeating
            // the `dsh web` boot is the whole of the wait the user sees, and
            // the adopted server already carries the profile and plugins.
            if let Some(port) = self.adopt_running_server(&app).await {
                wait_port_closed(port, self.stopping.clone()).await;
                // Forget only a hub that stopped serving. One still listening
                // belongs to no child of this shell, and its record is what the
                // next start adopts instead of booting a rival on another port.
                if !port_open(port) {
                    forget_server();
                }
                continue;
            }
            // No hub to adopt: every one of our servers still running is a
            // rival of the fresh one this shell is about to boot.
            sweep_rival_servers(None).await;
            let (child, port) = match self.spawn_child(app.clone()).await {
                Ok(owned) => owned,
                Err(err) => {
                    let _ = app.emit("dsh://failed", err);
                    return;
                }
            };
            *self.child.lock().await = Some(child);
            self.port.store(port, Ordering::SeqCst);
            *self.launch_url.lock().expect("launch-url mutex") = None;

            let ready = {
                let mut guard = self.child.lock().await;
                match guard.as_mut() {
                    Some(child) => {
                        wait_ready(port, child, self.stopping.clone(), &self.launch_url).await
                    }
                    None => false,
                }
            };
            if !ready {
                if self.stopping.load(Ordering::SeqCst) {
                    return;
                }
                // Process died before the port ever answered.
                let _ = app.emit("dsh://failed", "dsh exited during startup");
                self.child.lock().await.take();
                *self.launch_url.lock().expect("launch-url mutex") = None;
                tokio::time::sleep(Duration::from_secs(2)).await;
                continue;
            }
            let launch_url = self.launch_url.lock().expect("launch-url mutex").clone();
            if let Some(url) = launch_url.as_deref() {
                let pid = self.child.lock().await.as_ref().and_then(|child| child.id());
                if let Some(pid) = pid {
                    remember_server(port, url, pid, &self.dsh_bin);
                }
            }
            let _ = app.emit(
                "dsh://ready",
                DshEndpoint {
                    url: launch_url.clone(),
                },
            );
            reveal_main_window(&app);
            if let Some(url) = launch_url.as_deref() {
                navigate_ready(&app, url);
            }

            // Wait for the child to exit (or the stopping flag).
            loop {
                if self.stopping.load(Ordering::SeqCst) {
                    return;
                }
                let exited = {
                    let mut guard = self.child.lock().await;
                    match guard.as_mut() {
                        Some(child) => child.try_wait().ok().flatten().is_some(),
                        None => true,
                    }
                };
                if exited {
                    break;
                }
                tokio::time::sleep(Duration::from_millis(500)).await;
            }
            self.child.lock().await.take();
            *self.launch_url.lock().expect("launch-url mutex") = None;
            if self.stopping.load(Ordering::SeqCst) {
                return;
            }
            // A shell that already navigated to the dsh UI would otherwise sit
            // on a dead origin while the replacement boots; the shell page's
            // splash is the recovery surface here.
            #[cfg(not(windows))]
            return_to_shell_page(&app);

            // The plugin market restarts `dsh` as a detached process whose stdout
            // goes to its own log. Capture the launch URL from the bytes it adds;
            // a stale token in that log must never reach the iframe.
            if port_open(port) {
                let baseline = external_log_offset(port).await;
                let url = wait_external_launch_url(
                    port,
                    baseline,
                    self.stopping.clone(),
                    &self.launch_url,
                )
                .await;
                if self.stopping.load(Ordering::SeqCst) {
                    return;
                }
                let Some(url) = url else {
                    let _ = app.emit(
                        "dsh://failed",
                        "the plugin-restarted dsh did not print an authenticated URL",
                    );
                    wait_port_closed(port, self.stopping.clone()).await;
                    continue;
                };
                let _ = app.emit(
                    "dsh://ready",
                    DshEndpoint {
                        url: Some(url.clone()),
                    },
                );
                reveal_main_window(&app);
                navigate_ready(&app, &url);
                wait_port_closed(port, self.stopping.clone()).await;
                *self.launch_url.lock().expect("launch-url mutex") = None;
                continue;
            }
            if restarts >= RESTART_LIMIT {
                let _ = app.emit("dsh://failed", "dsh crashed repeatedly");
                return;
            }
            restarts += 1;
            let _ = app.emit("dsh://restarting", restarts);
            tokio::time::sleep(Duration::from_secs(2)).await;
        }
    }

    /// Attach the supervisor to the server an earlier shell start left running,
    /// or report `None` to fall through to a cold spawn. The decision is one
    /// file read plus one loopback request, both blocking, so it runs on the
    /// blocking pool and leaves the async runtime free.
    async fn adopt_running_server(&self, app: &AppHandle) -> Option<u16> {
        // A restart asked for this hub's replacement; adopting it again would
        // answer the request with the hub it was meant to replace.
        if self.restarting.swap(false, Ordering::SeqCst) {
            return None;
        }
        let path = server_record_path();
        let bin = self.dsh_bin.clone();
        let record = tauri::async_runtime::spawn_blocking(move || adopt_decision(&path, &bin))
            .await
            .ok()
            .flatten()?;
        // The hub being adopted is the sole survivor: rivals left by dead
        // shells or parallel launches hold session writer locks the user sees
        // as "occupied by another dsh".
        sweep_rival_servers(Some(record.pid)).await;
        self.port.store(record.port, Ordering::SeqCst);
        *self.launch_url.lock().expect("launch-url mutex") = Some(record.url.clone());
        append_startup_log(&format!(
            "adopted running server on {} (pid {})",
            record.port, record.pid
        ));
        let _ = app.emit(
            "dsh://ready",
            DshEndpoint {
                url: Some(record.url.clone()),
            },
        );
        reveal_main_window(app);
        navigate_ready(app, &record.url);
        Some(record.port)
    }

    async fn spawn_child(&self, app: AppHandle) -> Result<(Child, u16), String> {
        append_startup_log("spawn_child: begin");
        self.ensure_home_node_modules()?;
        crate::setup::ensure_easel_bundle(&app)?;
        append_startup_log("spawn_child: easel bundle ready");
        crate::setup::ensure_default_plugins(&app)?;
        append_startup_log("spawn_child: default plugins ready");
        let port = match select_port() {
            Ok(port) => port,
            Err(err) => {
                append_startup_log(&format!("select_port failed: {err}"));
                return Err(err);
            }
        };
        let mut cmd = Command::new(&self.node_path);
        cmd.arg(&self.dsh_bin)
            .arg("web")
            .arg("--port")
            .arg(port.to_string())
            .arg("--no-open")
            .stdout(Stdio::piped())
            .stderr(Stdio::piped());
        // Run the CLI from its package root so relative config lookups work.
        let workdir = self
            .dsh_bin
            .parent()
            .and_then(|p| p.parent())
            .map(|p| p.to_path_buf());
        if let Some(root) = &workdir {
            cmd.current_dir(root);
        }
        // Put the bundled pnpm (runtime/node/node_modules/.bin) and the deploy
        // closure's bins first on PATH so `dsh plugin` works offline.
        let mut path_parts: Vec<String> = Vec::new();
        if let Some(node_dir) = self.node_path.parent() {
            path_parts.push(
                node_dir
                    .join("node_modules")
                    .join(".bin")
                    .to_string_lossy()
                    .into_owned(),
            );
        }
        if let Some(closure) = self.dsh_bin.parent().and_then(|p| p.parent()) {
            path_parts.push(
                closure
                    .join("node_modules")
                    .join(".bin")
                    .to_string_lossy()
                    .into_owned(),
            );
        }
        if let Ok(existing) = std::env::var("PATH") {
            // Split the inherited PATH back into its elements before joining:
            // join_paths rejects a single element containing the platform
            // separator (':' on POSIX, ';' on Windows), and the whole PATH
            // string always does.
            path_parts
                .extend(std::env::split_paths(&existing).map(|p| p.to_string_lossy().into_owned()));
        }
        // join_paths uses the platform separator (";" on Windows, ":" on
        // POSIX); a literal ";" join breaks every PATH lookup in the dsh web
        // process on mac/linux (osascript/npx/git all spawn with ENOENT).
        let path_value = std::env::join_paths(&path_parts).map_err(|e| e.to_string())?;
        cmd.env("PATH", &path_value);
        // EASEL-DIVERGENCE(easel-dsh-layout): point dsh at the installed data
        // home instead of relying on the ~/.easel default, which only stays
        // correct through the migration junction.
        cmd.env("DSH_HOME", crate::setup::dsh_home());
        cmd.env("EASEL_HOME", crate::setup::easel_home());
        no_window(&mut cmd);
        // Startup log in the dsh home (provably writable — the profile patch
        // was just written there), appended to at every failure point. The
        // app log dir can silently fail on a partially-installed bundle and
        // has swallowed every diagnostic in this chain before.
        append_startup_log(&format!(
            "spawn: node={} bin={} cwd={:?} PATH={}",
            self.node_path.display(),
            self.dsh_bin.display(),
            workdir,
            path_value.to_string_lossy(),
        ));
        // Diagnostics: record exactly what is about to be spawned.
        if let Ok(log_dir) = app.path().app_log_dir() {
            let _ = std::fs::create_dir_all(&log_dir);
            let _ = std::fs::write(
                log_dir.join("spawn-debug.log"),
                format!(
                    "node={}\nbin={}\ncwd={:?}\nPATH={}\n",
                    self.node_path.display(),
                    self.dsh_bin.display(),
                    workdir,
                    path_value.to_string_lossy(),
                ),
            );
        }
        *self.launch_url.lock().expect("launch-url mutex") = None;
        let spawn_result = cmd.spawn();
        let mut child = match spawn_result {
            Ok(child) => child,
            Err(e) => {
                // Persist the failure for diagnostics: the GUI error banner is
                // easy to miss while the app is starting.
                append_startup_log(&format!(
                    "spawn FAILED: {e}\nnode={}\nbin={}",
                    self.node_path.display(),
                    self.dsh_bin.display()
                ));
                if let Ok(log_dir) = app.path().app_log_dir() {
                    let _ = std::fs::create_dir_all(&log_dir);
                    let _ = std::fs::write(
                        log_dir.join("spawn-error.log"),
                        format!(
                            "spawn dsh failed: {e}\nnode={}\nbin={}\n",
                            self.node_path.display(),
                            self.dsh_bin.display()
                        ),
                    );
                }
                return Err(format!("spawn dsh failed: {e}"));
            }
        };
        forward_stdout(
            child.stdout.take(),
            app.path().app_log_dir().ok().map(|d| d.join(LOG_NAME)),
            port,
            self.launch_url.clone(),
        );
        forward_to_log(
            child.stderr.take(),
            app.path()
                .app_log_dir()
                .ok()
                .map(|d| d.join("dsh-web.err.log")),
        );
        Ok((child, port))
    }

    /// Stop the dsh process for good (app exit, tray Quit, or explicit
    /// restart request).
    pub fn stop(&self) {
        self.stopping.store(true, Ordering::SeqCst);
        tauri::async_runtime::block_on(async {
            if let Some(mut child) = self.child.lock().await.take() {
                let _ = child.kill().await;
                let _ = child.wait().await;
                forget_server();
                return;
            }
            // An adopted hub is no longer this shell's child, so it is ended by
            // pid — and only a pid the record still proves: re-reading it
            // requires the process on that port to answer with the launch token
            // the recorded hub printed, which the pid of a replaced hub cannot.
            let path = server_record_path();
            let bin = self.dsh_bin.clone();
            let adopted =
                tauri::async_runtime::spawn_blocking(move || adopt_decision(&path, &bin)).await;
            if let Ok(Some(record)) = adopted {
                terminate_pid(record.pid);
                forget_server();
            }
        });
    }

    /// Graceful restart requested from the UI ("Restart service").
    pub fn request_restart(&self) {
        self.restarting.store(true, Ordering::SeqCst);
        let child = self.child.clone();
        let bin = self.dsh_bin.clone();
        tauri::async_runtime::spawn(async move {
            if let Some(mut child) = child.lock().await.take() {
                let _ = child.kill().await;
                let _ = child.wait().await;
                return;
            }
            // An adopted server is not this shell's child. Re-read and re-verify
            // its record before ending it by pid: the recorded pid belongs to a
            // serving process only while that server's own launch token still
            // authenticates, and a pid from a replaced server may have been
            // recycled by an unrelated process. A hub that cannot be verified is
            // left alone; the supervisor replaces it on another port instead.
            let path = server_record_path();
            let adopted =
                tauri::async_runtime::spawn_blocking(move || adopt_decision(&path, &bin)).await;
            if let Ok(Some(record)) = adopted {
                terminate_pid(record.pid);
            }
        });
    }

    pub fn port(&self) -> u16 {
        self.port.load(Ordering::SeqCst)
    }

    /// The web profile's loader resolves bundle rows (`@deepseek-ai/dsh-base`,
    /// `@deepseek-ai/dsh-web-app`) by walking node_modules upward from the
    /// profile directory. A normal npm install reaches them through the global
    /// node_modules chain; the bundled runtime has no such chain. Junction the
    /// closure's node_modules at `$DSH_HOME/node_modules` (a stop on that walk
    /// and outside the profile dir, so pnpm plugin management inside the
    /// profile never touches it). The junction target is the app's resource
    /// directory, so an app update replaces the closure in place and the
    /// junction keeps working.
    fn ensure_home_node_modules(&self) -> Result<(), String> {
        let home = crate::setup::dsh_home();
        let link = home.join("node_modules");
        let closure_root = self.dsh_bin.parent().and_then(|p| p.parent());
        let Some(closure_root) = closure_root else {
            return Err("cannot derive closure root from dsh bin path".into());
        };
        let target = closure_root.join("node_modules");
        if !target.exists() {
            return Err(format!("closure node_modules missing at {target:?}"));
        }
        if crate::layout::is_reparse_point(&link) {
            // A moved home carries the old junction; a dangling one makes
            // mklink fail with "already exists", so inspect and replace it.
            let current = std::fs::read_link(&link).ok();
            if current.as_deref() == Some(target.as_path()) {
                return Ok(());
            }
            crate::layout::remove_link(&link)?;
        } else if link.exists() {
            return Ok(());
        }
        std::fs::create_dir_all(&home).map_err(|e| e.to_string())?;
        crate::layout::create_link(&link, &target)?;
        Ok(())
    }
}

/// Where the adopted-server record lives: the fork's harness home, beside the
/// startup log, so a shell upgrade keeps the same home in view.
fn server_record_path() -> PathBuf {
    crate::setup::dsh_home().join(SERVER_RECORD_NAME)
}

/// Runtime identity of the CLI entry point: length and modification time. An
/// app update replaces the bundled closure, so a mismatch means the recorded
/// server predates this build and must not serve this shell.
fn runtime_identity(bin: &Path) -> Option<(u64, u64)> {
    let metadata = std::fs::metadata(bin).ok()?;
    let modified = metadata.modified().ok()?;
    let millis = modified.duration_since(std::time::UNIX_EPOCH).ok()?.as_millis() as u64;
    Some((metadata.len(), millis))
}

/// The launch URL's token when the URL is this profile's loopback launch URL
/// for `port`: `http://127.0.0.1:<port>/?token=<token>`.
fn launch_token(url: &str, port: u16) -> Option<String> {
    let rest = url.strip_prefix("http://127.0.0.1:")?;
    let (authority, query) = rest.split_once('/')?;
    if authority != port.to_string() {
        return None;
    }
    let token = query.strip_prefix("?token=")?;
    if token.is_empty() || token.contains('&') {
        return None;
    }
    Some(token.to_string())
}

/// Ask the recorded server to authenticate with its launch token. Only the
/// process that printed the URL accepts it, so a 303 to the root while holding
/// the cookie-minting token proves the recorded server is still the one this
/// home started. Every other answer — 401 for a foreign token, another status
/// for a foreign server, no answer at all — leaves the shell on the cold path.
fn probe_launch_url(port: u16, token: &str) -> bool {
    use std::io::{Read, Write};

    let address = std::net::SocketAddr::from(([127, 0, 0, 1], port));
    let Ok(mut stream) = std::net::TcpStream::connect_timeout(&address, ADOPT_PROBE_TIMEOUT) else {
        return false;
    };
    let _ = stream.set_read_timeout(Some(ADOPT_PROBE_TIMEOUT));
    let _ = stream.set_write_timeout(Some(ADOPT_PROBE_TIMEOUT));
    let request = format!(
        "GET /?token={token} HTTP/1.1\r\nHost: 127.0.0.1:{port}\r\nConnection: close\r\n\r\n"
    );
    if stream.write_all(request.as_bytes()).is_err() {
        return false;
    }
    let mut response = [0u8; 64];
    let read = match stream.read(&mut response) {
        Ok(read) => read,
        Err(_) => return false,
    };
    let status = String::from_utf8_lossy(&response[..read]);
    status.starts_with("HTTP/1.1 303") || status.starts_with("HTTP/1.0 303")
}

/// Read the record at `path` and report the server it names when that server
/// can still be adopted. Blocking (file read plus loopback request), so the
/// supervisor runs it on the blocking pool.
fn adopt_decision(path: &Path, bin: &Path) -> Option<ServerRecord> {
    let raw = std::fs::read(path).ok()?;
    let record: ServerRecord = serde_json::from_slice(&raw).ok()?;
    let Some(identity) = runtime_identity(bin) else {
        return None;
    };
    if record.bin != bin.to_string_lossy() || (record.bin_len, record.bin_modified_ms) != identity {
        return None;
    }
    let token = launch_token(&record.url, record.port)?;
    if !probe_launch_url(record.port, &token) {
        return None;
    }
    Some(record)
}

/// Record the server this spawn produced, so the next shell start can adopt it.
/// A record that cannot be written costs nothing but the adoption, so failures
/// are dropped rather than raised at a point where the server is already up.
fn remember_server(port: u16, url: &str, pid: u32, bin: &Path) {
    let Some((bin_len, bin_modified_ms)) = runtime_identity(bin) else {
        return;
    };
    let record = ServerRecord {
        port,
        url: url.to_string(),
        pid,
        bin: bin.to_string_lossy().into_owned(),
        bin_len,
        bin_modified_ms,
    };
    let path = server_record_path();
    if let Some(dir) = path.parent() {
        let _ = std::fs::create_dir_all(dir);
    }
    if let Ok(bytes) = serde_json::to_vec(&record) {
        let _ = std::fs::write(&path, bytes);
    }
}

fn forget_server() {
    let _ = std::fs::remove_file(server_record_path());
}

/// End a hub by pid together with its process tree. Windows needs the tree:
/// the hub's own children hold the workspace open.
fn terminate_pid(pid: u32) {
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x0800_0000;
        let mut kill = std::process::Command::new("cmd");
        kill.creation_flags(CREATE_NO_WINDOW);
        let _ = kill
            .args(["/c", "taskkill", "/PID", &pid.to_string(), "/T", "/F"])
            .status();
    }
    #[cfg(not(windows))]
    {
        let _ = std::process::Command::new("kill")
            .arg(pid.to_string())
            .status();
    }
}

fn port_open(port: u16) -> bool {
    std::net::TcpStream::connect(("127.0.0.1", port)).is_ok()
}

/// Matches a process whose command line boots one of OUR `dsh web` servers:
/// the installed runtime (`...\Easel-dsh\runtime\...`, the mac app bundle
/// `/Applications/Easel-dsh.app/Contents/Resources/runtime/...`) or this
/// repo's worktree (`...\Easel\dsh\...`). Prism or stock-dsh installs boot
/// from different paths and must never match — the sweep must not kill
/// another product.
fn is_our_dsh_web_server(command_line: &str) -> bool {
    // 路径被引号包着（`..."bin.js" web --port...`），不能要求连续子串。
    // 分隔符归一成 `/`：Windows 命令行是反斜杠，macOS 是正斜杠，同一个规则两边都要命中。
    let line = command_line.to_lowercase().replace('\\', "/");
    line.contains("bin.js")
        && line.contains(" web --port")
        && (line.contains("easel-dsh/runtime")
            || line.contains("easel/dsh")
            || line.contains("easel-dsh.app/contents"))
}

/// Pure decision core of the sweep so the rules stay testable without
/// processes: kill every sampled pid that boots one of our dsh web servers,
/// except the kept survivor.
fn rival_pids(samples: &[(u32, String)], keep: Option<u32>) -> Vec<u32> {
    samples
        .iter()
        .filter(|(pid, line)| Some(*pid) != keep && is_our_dsh_web_server(line))
        .map(|(pid, _)| *pid)
        .collect()
}

/// Enumerate running node processes as (pid, command line) samples.
#[cfg(windows)]
fn list_process_samples() -> Vec<(u32, String)> {
    use std::os::windows::process::CommandExt;
    const CREATE_NO_WINDOW: u32 = 0x0800_0000;
    let output = std::process::Command::new("powershell")
        .creation_flags(CREATE_NO_WINDOW)
        .args([
            "-NoProfile",
            "-Command",
            "Get-CimInstance Win32_Process -Filter \"Name='node.exe'\" | Select-Object ProcessId,CommandLine | ConvertTo-Json -Compress",
        ])
        .output();
    let Ok(output) = output else {
        return Vec::new();
    };
    // One match renders as a bare object, several as an array — normalize.
    let Ok(value) = serde_json::from_slice::<serde_json::Value>(&output.stdout) else {
        return Vec::new();
    };
    let items: Vec<serde_json::Value> = match value {
        serde_json::Value::Array(items) => items,
        item @ serde_json::Value::Object(_) => vec![item],
        _ => return Vec::new(),
    };
    items
        .iter()
        .filter_map(|item| {
            let pid = item.get("ProcessId")?.as_u64()? as u32;
            let line = item.get("CommandLine")?.as_str()?.to_owned();
            Some((pid, line))
        })
        .collect()
}

#[cfg(not(windows))]
fn list_process_samples() -> Vec<(u32, String)> {
    // -ww disables the terminal-width command-line truncation that would cut
    // off the `web --port` tail the matcher needs. Failing ps is tolerated:
    // an empty sweep beats blocking adopt/spawn.
    let Ok(output) = std::process::Command::new("ps")
        .args(["-axo", "pid=,command=", "-ww"])
        .output()
    else {
        return Vec::new();
    };
    parse_ps_samples(&String::from_utf8_lossy(&output.stdout))
}

/// Parses `ps -axo pid=,command= -ww` lines: a pid, one space, then the
/// command (ps right-aligns the pid column, so leading spaces get trimmed).
#[cfg(not(windows))]
fn parse_ps_samples(stdout: &str) -> Vec<(u32, String)> {
    stdout
        .lines()
        .filter_map(|line| {
            let line = line.trim();
            let (pid, command) = line.split_once(' ')?;
            let pid = pid.trim().parse().ok()?;
            Some((pid, command.trim_start().to_owned()))
        })
        .collect()
}

/// One shell, one server: end every rival `dsh web` server of ours except
/// `keep`. Rivals are what a dead shell leaves behind (orphans whose server
/// outlived it) and what parallel launches boot beside the hub — the session
/// writer locks they hold are the "occupied by another dsh" users keep
/// hitting. Runs at every adopt/spawn decision, so a sweep also follows the
/// hub this shell supervised eventually dying.
async fn sweep_rival_servers(keep: Option<u32>) {
    if cfg!(debug_assertions) {
        // Dev shells must not kill the installed instance under comparison.
        return;
    }
    let killed = tauri::async_runtime::spawn_blocking(move || {
        let targets = rival_pids(&list_process_samples(), keep);
        for pid in &targets {
            terminate_pid(*pid);
        }
        targets
    })
    .await
    .unwrap_or_default();
    if !killed.is_empty() {
        append_startup_log(&format!("swept rival dsh web servers: {killed:?}"));
    }
}

/// Choose the port for the next `dsh web` spawn: the default `INTERNAL_PORT`
/// when it accepts a bind, otherwise the first free port in the scan range.
/// Selection runs on every spawn, so a restart returns to the default as soon
/// as the external occupier releases it. The probe listener is dropped before
/// the process binds, leaving a tiny bind race that the supervisor's
/// `wait_ready` restart path absorbs.
fn select_port() -> Result<u16, String> {
    if port_free(INTERNAL_PORT) {
        return Ok(INTERNAL_PORT);
    }
    let last = INTERNAL_PORT + PORT_SCAN_LIMIT;
    for port in (INTERNAL_PORT + 1)..=last {
        if port_free(port) {
            return Ok(port);
        }
    }
    Err(format!(
        "no free port in {}..={last} for the dsh web",
        INTERNAL_PORT + 1
    ))
}

/// A port is free when a loopback bind succeeds; the listener is dropped
/// immediately, leaving the port for the spawned process.
fn port_free(port: u16) -> bool {
    std::net::TcpListener::bind(("127.0.0.1", port)).is_ok()
}

async fn wait_ready(
    port: u16,
    child: &mut Child,
    stopping: Arc<AtomicBool>,
    launch_url: &Arc<LaunchUrlMutex<Option<String>>>,
) -> bool {
    let mut attempts = 0u32;
    while attempts < 120 {
        if stopping.load(Ordering::SeqCst) {
            return false;
        }
        let authenticated = launch_url.lock().expect("launch-url mutex").is_some();
        if authenticated && port_open(port) {
            return true;
        }
        if let Ok(Some(_)) = child.try_wait() {
            return false;
        }
        tokio::time::sleep(Duration::from_millis(500)).await;
        attempts += 1;
    }
    false
}

async fn wait_port_closed(port: u16, stopping: Arc<AtomicBool>) {
    loop {
        if stopping.load(Ordering::SeqCst) {
            return;
        }
        if !port_open(port) {
            return;
        }
        tokio::time::sleep(Duration::from_millis(500)).await;
    }
}

/// Extract the loopback launch URL printed by `dsh web`; it is the only
/// stdout value the desktop shell may trust.
fn launch_url_from_line(line: &str, port: u16) -> Option<String> {
    let candidate = line
        .split_whitespace()
        .find(|value| value.starts_with("http://") && value.contains("token="))?;
    let url = Url::parse(candidate).ok()?;
    if url.scheme() != "http"
        || url.host_str() != Some("127.0.0.1")
        || url.port() != Some(port)
        || url.query_pairs().filter(|(key, _)| key == "token").count() != 1
    {
        return None;
    }
    Some(candidate.to_owned())
}

/// Forward stdout while retaining the current process's launch URL.
fn forward_stdout<S>(
    stream: Option<S>,
    path: Option<PathBuf>,
    port: u16,
    launch_url: Arc<LaunchUrlMutex<Option<String>>>,
) where
    S: AsyncRead + Unpin + Send + 'static,
{
    let Some(stream) = stream else { return };
    let Some(path) = path else { return };
    if let Some(dir) = path.parent() {
        let _ = std::fs::create_dir_all(dir);
    }
    tauri::async_runtime::spawn(async move {
        let mut log = match tokio::fs::OpenOptions::new()
            .create(true)
            .append(true)
            .open(&path)
            .await
        {
            Ok(f) => f,
            Err(_) => return,
        };
        let mut lines = tokio::io::BufReader::new(stream).lines();
        while let Ok(Some(line)) = lines.next_line().await {
            if let Some(url) = launch_url_from_line(&line, port) {
                *launch_url.lock().expect("launch-url mutex") = Some(url);
            }
            let _ = log.write_all(format!("{line}\n").as_bytes()).await;
        }
    });
}

/// Byte offset of the plugin market's restart log, so its next process can add
/// a new URL without the reader accepting a token from an older process.
async fn external_log_offset(port: u16) -> u64 {
    let path = crate::setup::dsh_home()
        .join("logs")
        .join(format!("dsh-web-{port}.log"));
    tokio::fs::metadata(&path)
        .await
        .map(|metadata| metadata.len())
        .unwrap_or(0)
}

/// Read only the bytes added to the plugin restart log after `offset`.
async fn wait_external_launch_url(
    port: u16,
    offset: u64,
    stopping: Arc<AtomicBool>,
    launch_url: &Arc<LaunchUrlMutex<Option<String>>>,
) -> Option<String> {
    let path = crate::setup::dsh_home()
        .join("logs")
        .join(format!("dsh-web-{port}.log"));
    for _ in 0..120 {
        if stopping.load(Ordering::SeqCst) {
            return None;
        }
        if let Ok(mut file) = tokio::fs::OpenOptions::new().read(true).open(&path).await {
            if let Ok(metadata) = file.metadata().await {
                if metadata.len() > offset {
                    if file.seek(std::io::SeekFrom::Start(offset)).await.is_ok() {
                        let mut added = String::new();
                        if file.read_to_string(&mut added).await.is_ok() {
                            let url = added
                                .lines()
                                .rev()
                                .find_map(|line| launch_url_from_line(line, port));
                            if let Some(url) = url {
                                *launch_url.lock().expect("launch-url mutex") = Some(url.clone());
                                return Some(url);
                            }
                        }
                    }
                }
            }
        }
        tokio::time::sleep(Duration::from_millis(500)).await;
    }
    None
}

fn forward_to_log<S>(stream: Option<S>, path: Option<PathBuf>)
where
    S: AsyncRead + Unpin + Send + 'static,
{
    if stream.is_none() {
        return;
    }
    let Some(path) = path else { return };
    if let Some(dir) = path.parent() {
        let _ = std::fs::create_dir_all(dir);
    }
    let stream = stream.expect("checked above");
    tauri::async_runtime::spawn(async move {
        let mut log = match tokio::fs::OpenOptions::new()
            .create(true)
            .append(true)
            .open(&path)
            .await
        {
            Ok(f) => f,
            Err(_) => return,
        };
        let mut reader = tokio::io::BufReader::new(stream);
        let _ = tokio::io::copy(&mut reader, &mut log).await;
    });
}

/// Resolves the Node executable and the dsh CLI entry.
///
/// Production layout (bundled by `scripts/bundle-runtime.mjs`):
///   <resource>/runtime/node/<node>          node binary
///   <resource>/runtime/dsh/.../lib/bin.js   @deepseek-ai/dsh CLI
///
/// Dev fallback: `node` from PATH and `DSH_DESKTOP_DSH_BIN`, defaulting to
/// the repo's built `apps/cli/lib/bin.js` when present.
pub(crate) fn resolve_runtime(app: &AppHandle) -> Result<(PathBuf, PathBuf), String> {
    let resource_dir = app
        .path()
        .resource_dir()
        .map_err(|e| format!("resource dir unavailable: {e}"))?;
    let runtime_root = resource_dir.join("runtime");

    let node_exe = if cfg!(windows) { "node.exe" } else { "node" };
    let bundled_node = runtime_root.join("node").join(node_exe);
    // pnpm deploy lays the target package out at the closure root: lib/bin.js.
    let bundled_bin = runtime_root.join("dsh").join("lib").join("bin.js");

    if bundled_node.exists() && bundled_bin.exists() {
        return Ok((plain_path(&bundled_node), plain_path(&bundled_bin)));
    }

    // Dev fallback.
    let node = std::env::var("DSH_DESKTOP_NODE").unwrap_or_else(|_| "node".into());
    let dsh_bin = std::env::var("DSH_DESKTOP_DSH_BIN").unwrap_or_else(|_| {
        PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .join("..")
            .join("..")
            .join("cli")
            .join("lib")
            .join("bin.js")
            .to_string_lossy()
            .into_owned()
    });
    if !PathBuf::from(&dsh_bin).exists() {
        return Err(format!(
            "no bundled runtime found at {bundled_bin:?} and no built dsh CLI at {dsh_bin}"
        ));
    }
    Ok((
        plain_path(&PathBuf::from(node)),
        plain_path(&PathBuf::from(dsh_bin)),
    ))
}

/// The app is a GUI process (windows_subsystem = windows); spawned children
/// otherwise create a visible console window. Suppress it.
fn no_window(cmd: &mut tokio::process::Command) {
    #[cfg(windows)]
    {
        const CREATE_NO_WINDOW: u32 = 0x0800_0000;
        cmd.creation_flags(CREATE_NO_WINDOW);
    }
}

/// Append one line to `~/.dsh/desktop-startup.log`, which the shell can
/// write even when the app log dir is unavailable; never fails the caller.
fn append_startup_log(message: &str) {
    let startup_log = crate::setup::dsh_home().join("desktop-startup.log");
    let _ = std::fs::create_dir_all(&crate::setup::dsh_home());
    let _ = std::fs::OpenOptions::new()
        .create(true)
        .append(true)
        .open(&startup_log)
        .and_then(|mut file| {
            use std::io::Write;
            writeln!(file, "{message}")
        });
}

/// Windows verbatim paths (`\\?\C:\...`, produced by canonicalization inside
/// Tauri's resource_dir) crash node's main-script resolver with
/// `EISDIR ... lstat 'C:'`. Strip the prefix so node receives a normal path.
fn plain_path(p: &Path) -> PathBuf {
    let s = p.to_string_lossy();
    if let Some(rest) = s.strip_prefix(r"\\?\") {
        PathBuf::from(rest)
    } else {
        p.to_path_buf()
    }
}

/// Cookie fields of the launch-token exchange response.
#[derive(Debug)]
struct AuthCookie {
    name: String,
    value: String,
    max_age: i64,
}

/// The URL the shell iframe should load: the clean origin on Windows, the
/// token URL on WebKit shells (see `authenticate_webview`).
#[derive(Serialize)]
pub struct WebviewSession {
    pub url: String,
}

/// Read the sole dsh browser-session cookie from the token-exchange response.
fn auth_cookie_from_response(response: &str) -> Option<AuthCookie> {
    let header_block = response.split("\r\n\r\n").next()?;
    let set_cookie = header_block.lines().find_map(|line| {
        let (name, value) = line.split_once(':')?;
        name.eq_ignore_ascii_case("set-cookie")
            .then(|| value.trim())
    })?;
    let (name, value) = set_cookie.split(';').next()?.split_once('=')?;
    let name = name.trim();
    if !name.starts_with("dsh-auth-") {
        return None;
    }
    let max_age = set_cookie
        .split(';')
        .find_map(|attribute| {
            let (key, value) = attribute.trim().split_once('=')?;
            key.eq_ignore_ascii_case("max-age")
                .then(|| value.trim().parse::<i64>().ok())
                .flatten()
        })
        .unwrap_or(30 * 24 * 60 * 60);
    Some(AuthCookie {
        name: name.to_owned(),
        value: value.trim().to_owned(),
        max_age,
    })
}

/// Exchange the launch token over loopback HTTP and report both URL forms the
/// shell may load: the clean origin for a cookie-carried session and the
/// original token URL for the WebKit in-iframe load. The exchange doubles as a
/// liveness probe, failing before the iframe can display the 401 body.
async fn launch_exchange(parsed: Url) -> Result<(AuthCookie, String, String), String> {
    let (cookie, clean_url, token_url) = tauri::async_runtime::spawn_blocking(move || {
        let token_url = parsed.to_string();
        let port = parsed.port().ok_or("invalid dsh web launch URL")?;
        let target = match parsed.query() {
            Some(query) => format!("{}?{query}", parsed.path()),
            None => parsed.path().to_owned(),
        };
        let mut stream = TcpStream::connect(("127.0.0.1", port))
            .map_err(|e| format!("launch-token exchange failed: {e}"))?;
        stream
            .set_read_timeout(Some(Duration::from_secs(10)))
            .map_err(|e| format!("launch-token exchange failed: {e}"))?;
        use std::io::Write;
        stream
            .write_all(
                format!(
                    "GET {target} HTTP/1.1\r\nHost: 127.0.0.1:{port}\r\nConnection: close\r\n\r\n"
                )
                .as_bytes(),
            )
            .map_err(|e| format!("launch-token exchange failed: {e}"))?;
        let mut response = String::new();
        std::io::Read::read_to_string(&mut stream, &mut response)
            .map_err(|e| format!("launch-token exchange failed: {e}"))?;
        let cookie = auth_cookie_from_response(&response)
            .ok_or_else(|| "launch-token response contained no dsh browser cookie".to_owned())?;
        let mut clean = parsed;
        clean.set_query(None);
        clean.set_fragment(None);
        Ok::<_, String>((cookie, clean.to_string(), token_url))
    })
    .await
    .map_err(|e| format!("launch-token exchange task failed: {e}"))??;
    Ok((cookie, clean_url, token_url))
}

/// Load the launch-token URL into the shell webview.
///
/// Chromium WebView2 (Windows): the shell installs the exchanged cookie into
/// the native cookie store (`SameSite=None; Secure`) and returns the clean URL
/// for the iframe, because a `SameSite=Strict` cookie minted inside the
/// embedded cross-origin iframe is not sent to the loopback server.
///
/// WebKit shells (macOS/Linux): the session load no longer goes through this
/// command — an iframe (or any third-party-context navigation) can never
/// carry the exchange cookie there, so the window itself navigates top-level
/// via `navigate_main` instead. This command's WebKit branch survives only as
/// the validated probe that hands back the token URL unchanged.
#[tauri::command]
pub async fn authenticate_webview(app: AppHandle, url: String) -> Result<WebviewSession, String> {
    let parsed = url
        .parse::<Url>()
        .ok()
        .filter(|parsed| {
            parsed.scheme() == "http"
                && parsed.host_str() == Some("127.0.0.1")
                && parsed.port().is_some()
        })
        .ok_or("invalid dsh web launch URL")?;
    // Each platform consumes a subset (Windows: {cookie, clean_url}; WebKit:
    // {token_url}); the statement allow keeps the other target's fields
    // warning-free.
    #[allow(unused_variables)]
    let (cookie, clean_url, token_url) = launch_exchange(parsed).await?;
    let _ = &app;
    #[cfg(windows)]
    {
        let cookie = Cookie::build((cookie.name, cookie.value))
            .domain("127.0.0.1")
            .path("/")
            .http_only(true)
            .same_site(SameSite::None)
            .secure(true)
            .max_age(CookieDuration::seconds(cookie.max_age))
            .build();
        let window = app
            .get_webview_window("main")
            .ok_or("main webview unavailable")?;
        window
            .set_cookie(cookie)
            .map_err(|e| format!("browser-cookie installation failed: {e}"))?;
        Ok(WebviewSession { url: clean_url })
    }
    #[cfg(not(windows))]
    {
        Ok(WebviewSession { url: token_url })
    }
}

/// Label of the window that hosts the dsh UI on WebKit shells. The shell page
/// stays loaded in `main` (hidden) as the wizard/error surface, so a crashed
/// server can bring the splash back without recreating anything.
#[cfg(not(windows))]
const APP_WINDOW: &str = "app";

/// Navigate the main window to the launch URL, top-level, the way a user
/// opening the printed URL in a browser would. Windows only: WebView2 keeps
/// the shell page + pre-installed cookie iframe design.
pub(crate) fn navigate_main_window(app: &AppHandle, url: &str) -> Result<(), String> {
    let window = app
        .get_webview_window("main")
        .ok_or("main webview unavailable")?;
    let parsed = url
        .parse::<Url>()
        .map_err(|e| format!("invalid dsh web launch URL: {e}"))?;
    if let Ok(current) = window.url() {
        if same_origin(&current, &parsed) {
            return Ok(());
        }
    }
    window
        .navigate(parsed)
        .map_err(|e| format!("navigate to the dsh web URL failed: {e}"))
}

fn same_origin(a: &Url, b: &Url) -> bool {
    a.scheme() == b.scheme() && a.host_str() == b.host_str() && a.port() == b.port()
}

/// Open the dsh UI in its own window on WebKit shells, or navigate the window
/// that already hosts it.
///
/// WebKit anchors SameSite decisions to the CURRENT document: a navigation
/// started from the `tauri://localhost` shell page counts as cross-site, so
/// the server's `HttpOnly; SameSite=Strict` exchange cookie is neither stored
/// nor sent and every launch lands on the 401 body. A window created directly
/// against the launch URL has no document to anchor to — the first load
/// behaves exactly like a browser tab opening the printed URL: the 303 mints
/// the cookie first-party, the redirect carries it, and everything after that
/// is the app document's own same-origin traffic. Later readiness (a restarted
/// server on another port) navigates the existing app window, which is a
/// same-site navigation from the app document and keeps working.
#[cfg(not(windows))]
pub(crate) fn open_app_window(app: &AppHandle, url: &str) -> Result<(), String> {
    let parsed = url
        .parse::<Url>()
        .map_err(|e| format!("invalid dsh web launch URL: {e}"))?;
    if let Some(window) = app.get_webview_window(APP_WINDOW) {
        let navigated = window.url().ok().map(|current| !same_origin(&current, &parsed)).unwrap_or(true);
        if navigated {
            window
                .navigate(parsed)
                .map_err(|e| format!("navigate the app window failed: {e}"))?;
        }
        show_window(&window);
        if let Some(main) = app.get_webview_window("main") {
            let _ = main.hide();
        }
        append_startup_log(&format!(
            "app window {} {}",
            APP_WINDOW,
            if navigated { "navigated" } else { "reused" }
        ));
        return Ok(());
    }
    // Window creation must run on the main thread; the supervisor runs on the
    // async runtime.
    let handle = app.clone();
    app.run_on_main_thread(move || {
        let built = tauri::WebviewWindowBuilder::new(
            &handle,
            APP_WINDOW,
            tauri::WebviewUrl::External(parsed),
        )
        .title("Easel-dsh")
        .inner_size(1280.0, 820.0)
        .min_inner_size(800.0, 600.0)
        .on_new_window({
            let handle = handle.clone();
            move |url, _features: NewWindowFeatures| {
                crate::open_new_window_externally(&handle, &url)
            }
        })
        .on_navigation({
            let handle = handle.clone();
            move |url| crate::allow_app_navigation(&handle, url)
        })
        .build();
        match built {
            Ok(window) => {
                show_window(&window);
                if let Some(main) = handle.get_webview_window("main") {
                    let _ = main.hide();
                }
                append_startup_log(&format!("app window {APP_WINDOW} created"));
            }
            Err(err) => append_startup_log(&format!("open app window failed: {err}")),
        }
    })
    .map_err(|e| format!("open app window dispatch failed: {e}"))
}

/// The UI-facing entry point of the window above: the shell page calls it
/// once a `ready` arrives (including the wizard-completion reload, which races
/// the supervisor's own call — the window lookup deduplicates).
#[tauri::command]
pub fn navigate_main(app: AppHandle, url: String) -> Result<(), String> {
    #[cfg(not(windows))]
    {
        return open_app_window(&app, &url);
    }
    #[cfg(windows)]
    {
        navigate_main_window(&app, &url)
    }
}

/// Open the app window on every readiness, unless the first-run wizard still
/// owns the window: its completion flow reloads the shell page, whose status
/// polling reaches `navigate_main` on its own. WebView2 keeps the shell page +
/// iframe design and never navigates here.
fn navigate_ready(app: &AppHandle, url: &str) {
    if !crate::setup::is_initialized() {
        return;
    }
    #[cfg(not(windows))]
    if let Err(err) = open_app_window(app, url) {
        append_startup_log(&format!("open app window for the dsh web: {err}"));
    }
    #[cfg(windows)]
    let _ = (app, url);
}

/// Close the app window and bring the shell page back when the served UI just
/// died, so the splash/banner surface takes over while the supervisor boots a
/// replacement; the next readiness opens a fresh app window.
#[cfg(not(windows))]
fn return_to_shell_page(app: &AppHandle) {
    if let Some(window) = app.get_webview_window(APP_WINDOW) {
        let _ = window.close();
    }
    if let Some(main) = app.get_webview_window("main") {
        let _ = main.show();
        let _ = main.set_focus();
    }
}

/// Show and focus one window; shared by the tray, `open_ui`, and readiness.
fn show_window(window: &tauri::WebviewWindow) {
    let _ = window.show();
    let _ = window.unminimize();
    let _ = window.set_focus();
}

/// Bring the visible UI forward: the app window when the app hosts it, the
/// shell page otherwise.
pub(crate) fn show_ui_window(app: &AppHandle) {
    #[cfg(not(windows))]
    if let Some(window) = app.get_webview_window(APP_WINDOW) {
        show_window(&window);
        return;
    }
    if let Some(window) = app.get_webview_window("main") {
        show_window(&window);
    }
}
#[derive(Serialize)]
pub struct DshStatus {
    pub running: bool,
    pub port: u16,
    pub url: Option<String>,
}

#[tauri::command]
pub fn dsh_status(state: tauri::State<'_, DshHandle>) -> DshStatus {
    DshStatus {
        running: port_open(state.port()),
        port: state.port(),
        url: state.launch_url.lock().expect("launch-url mutex").clone(),
    }
}

#[tauri::command]
pub fn restart_dsh(state: tauri::State<'_, DshHandle>) {
    state.request_restart();
}

/// Reveal the shell window once the dsh UI is actually reachable. The main
/// window is built before the event loop starts, where a queued `show()` can
/// be dropped on some WebView2/Windows combinations, and revealing it earlier
/// would present a blank webview while dsh boots. Called at every
/// `dsh://ready`; showing an already-visible window is a no-op.
fn reveal_main_window(app: &AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.unminimize();
        let _ = window.set_focus();
    }
}

#[tauri::command]
pub fn open_ui(app: AppHandle) -> Result<(), String> {
    show_ui_window(&app);
    Ok(())
}

#[cfg(test)]
mod adopt_tests {
    // EASEL-DIVERGENCE(desktop-startup-latency L2 Layer 1): decision-contract tests.
    use super::{adopt_decision, launch_token, runtime_identity, ServerRecord};
    use std::path::PathBuf;

    fn temp_dir(name: &str) -> PathBuf {
        // OUT_DIR (target/…/build) is the one location this test process is
        // guaranteed to write: the machine's %TEMP% is not, under restricted
        // tokens and redirected shells alike.
        let unique = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let dir = PathBuf::from(env!("OUT_DIR")).join(format!("adopt-{name}-{unique}"));
        std::fs::create_dir_all(&dir).unwrap();
        dir
    }

    #[test]
    fn launch_token_accepts_only_the_matching_loopback_url() {
        assert_eq!(launch_token("http://127.0.0.1:3081/?token=abc", 3081).as_deref(), Some("abc"));
        assert_eq!(launch_token("http://127.0.0.1:3082/?token=abc", 3081), None);
        assert_eq!(launch_token("http://localhost:3081/?token=abc", 3081), None);
        assert_eq!(launch_token("http://127.0.0.1:3081/?token=", 3081), None);
        assert_eq!(launch_token("http://127.0.0.1:3081/?token=a&b", 3081), None);
    }

    fn write_record(dir: &std::path::Path, bin: &std::path::Path, port: u16, url: &str) -> PathBuf {
        let metadata = std::fs::metadata(bin).unwrap();
        let record = ServerRecord {
            port,
            url: url.to_string(),
            pid: 4242,
            bin: bin.to_string_lossy().into_owned(),
            bin_len: metadata.len(),
            bin_modified_ms: metadata
                .modified()
                .unwrap()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_millis() as u64,
        };
        let path = dir.join("desktop-server.json");
        std::fs::write(&path, serde_json::to_vec(&record).unwrap()).unwrap();
        path
    }

    #[test]
    fn adopt_decision_rejects_a_record_from_another_runtime() {
        let dir = temp_dir("identity");
        let real_bin = dir.join("bin.js");
        std::fs::write(&real_bin, b"export {}").unwrap();
        let fake_bin = dir.join("other.js");
        std::fs::write(&fake_bin, b"export {}").unwrap();
        let path = write_record(&dir, &real_bin, 3081, "http://127.0.0.1:3081/?token=abc");
        assert_eq!(adopt_decision(&path, &fake_bin), None);
        let identity = runtime_identity(&real_bin).unwrap();
        std::fs::write(&real_bin, b"export {};").unwrap();
        // A changed closure (different length) invalidates the same-path record.
        if runtime_identity(&real_bin) != Some(identity) {
            assert_eq!(adopt_decision(&path, &real_bin), None);
        }
    }

    #[test]
    fn adopt_decision_requires_a_live_token_annotated_url() {
        let dir = temp_dir("dead");
        let bin = dir.join("bin.js");
        std::fs::write(&bin, b"export {}").unwrap();
        // Port 1 on loopback is never answering within the probe budget.
        let path = write_record(&dir, &bin, 1, "http://127.0.0.1:1/?token=abc");
        assert_eq!(adopt_decision(&path, &bin), None);
    }

    #[test]
    fn adopt_decision_rejects_a_malformed_record() {
        let dir = temp_dir("malformed");
        let bin = dir.join("bin.js");
        std::fs::write(&bin, b"export {}").unwrap();
        let path = dir.join("desktop-server.json");
        std::fs::write(&path, b"{ not json").unwrap();
        assert_eq!(adopt_decision(&path, &bin), None);
        assert_eq!(adopt_decision(&dir.join("missing.json"), &bin), None);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rival_sweep_kills_orphans_and_rivals_but_spares_the_kept_hub() {
        let hub = r#"C:\Users\chenfei\AppData\Local\EASEL-DSH\runtime\dsh\lib\bin.js" web --port 3082 --no-open"#.to_string();
        let orphan = r#"C:\Users\chenfei\AppData\Local\easel-dsh\runtime\dsh\lib\bin.js" web --port 3081 --no-open"#.to_string();
        let dev = r#"C:\Users\chenfei\Documents\GitHub\Easel\dsh\cli\lib\bin.js" web --port 3083 --no-open"#.to_string();
        // 另一个产品（prism）的 dsh web：路径不同，绝不能被误杀。
        let prism = r#"C:\Users\chenfei\Documents\GitHub\prism-agent\dsh\cli\lib\bin.js" web --port 3099 --no-open"#.to_string();
        let unrelated = r#"C:\Tools\something\server.js" --port 7000"#.to_string();
        let samples = vec![
            (34096, hub),
            (40456, orphan),
            (21944, dev),
            (111, prism),
            (222, unrelated),
        ];
        // 收养 3082 时：装机的孤儿（大小写不敏感命中）与源码树的开发实例都清，
        // prism 与无关进程不动。
        assert_eq!(rival_pids(&samples, Some(34096)), vec![40456, 21944]);
        // 冷启（无正主）：我们家的 dsh web 全清，仍不碰别家。
        assert_eq!(rival_pids(&samples, None), vec![34096, 40456, 21944]);
        // keep 指向不存在的 pid（记录被复用污染）：只是少豁免一项，其余照清。
        assert_eq!(rival_pids(&samples, Some(999)), vec![34096, 40456, 21944]);
    }

    #[test]
    fn rival_sweep_matches_mac_install_and_dev_paths_via_separator_normalization() {
        // mac 装机 = .app bundle（resources 在 Contents/Resources/runtime），
        // 开发树 = 仓库路径，`ps -axo` 输出的就是正斜杠。
        let installed = "/Applications/Easel-dsh.app/Contents/Resources/runtime/dsh/lib/bin.js web --port 3081 --no-open".to_string();
        let dev = "/Users/fei/Documents/GitHub/Easel/dsh/cli/lib/bin.js web --port 3083 --no-open".to_string();
        // 正斜杠写法的别家产品，同样不许误杀。
        let prism = "/Users/fei/Documents/GitHub/prism-agent/dsh/cli/lib/bin.js web --port 3099 --no-open".to_string();
        let samples = vec![(40456, installed), (21944, dev), (111, prism)];
        assert_eq!(rival_pids(&samples, None), vec![40456, 21944]);
    }

    #[cfg(not(windows))]
    #[test]
    fn ps_sample_parser_accepts_ps_output() {
        let samples = parse_ps_samples(
            "  40456 /usr/local/bin/node /Users/fei/.dsh/easel-dsh/runtime/dsh/lib/bin.js web --port 3081\n  1 /sbin/launchd\n",
        );
        assert_eq!(
            samples,
            vec![
                (
                    40456u32,
                    "/usr/local/bin/node /Users/fei/.dsh/easel-dsh/runtime/dsh/lib/bin.js web --port 3081".to_string()
                ),
                (1u32, "/sbin/launchd".to_string()),
            ]
        );
    }

    #[test]
    fn launch_url_parser_accepts_only_the_current_loopback_token() {
        let good = launch_url_from_line(
            "dsh web: http://127.0.0.1:3081/?token=abc (LAN: http://192.0.2.1:3081/?token=abc)",
            3081,
        );
        assert_eq!(good.as_deref(), Some("http://127.0.0.1:3081/?token=abc"),);
        assert_eq!(
            launch_url_from_line("dsh web: http://127.0.0.1:3081/", 3081),
            None
        );
        assert_eq!(
            launch_url_from_line("dsh web: http://127.0.0.1:3082/?token=abc", 3081),
            None
        );
        assert_eq!(
            launch_url_from_line("dsh web: http://127.0.0.1:3081/?token=abc&token=def", 3081),
            None
        );
    }
    #[test]
    fn auth_cookie_parser_accepts_only_dsh_session_cookies() {
        let cookie = auth_cookie_from_response(
            "HTTP/1.1 200 OK\r\nSet-Cookie: dsh-auth-abc123=tok; Max-Age=604800; Path=/\r\n\r\nbody",
        )
        .unwrap();
        assert_eq!(cookie.name, "dsh-auth-abc123");
        assert_eq!(cookie.value, "tok");
        assert_eq!(cookie.max_age, 604800);

        // Only dsh-auth-* cookies may reach the WebView store.
        assert!(auth_cookie_from_response(
            "HTTP/1.1 200 OK\r\nSet-Cookie: other=tok; Max-Age=60\r\n\r\n",
        )
        .is_none());

        // A malformed Max-Age falls back to the session default rather than
        // installing an immediately expired cookie.
        let cookie = auth_cookie_from_response(
            "HTTP/1.1 200 OK\r\nSet-Cookie: dsh-auth-abc123=tok; Max-Age=soon\r\n\r\n",
        )
        .unwrap();
        assert_eq!(cookie.max_age, 30 * 24 * 60 * 60);
    }

    #[test]
    fn select_port_returns_default_when_free() {
        if port_free(INTERNAL_PORT) {
            assert_eq!(select_port().unwrap(), INTERNAL_PORT);
        }
    }

    #[test]
    fn select_port_skips_occupied_ports() {
        // When both the default and the first fallback are occupied, the scan
        // must move past them and return a port that is actually bindable.
        let default = std::net::TcpListener::bind(("127.0.0.1", INTERNAL_PORT));
        let next = std::net::TcpListener::bind(("127.0.0.1", INTERNAL_PORT + 1));
        let (Ok(default), Ok(next)) = (default, next) else {
            return;
        };
        let port = select_port().unwrap();
        assert_ne!(port, INTERNAL_PORT);
        assert_ne!(port, INTERNAL_PORT + 1);
        assert!(port_free(port));
        drop(default);
        drop(next);
    }

    #[test]
    fn join_paths_accepts_split_inherited_path() {
        // Regression for the hub-never-spawned bug: the spawn PATH builder
        // must split the inherited PATH into elements before joining. POSIX
        // join_paths rejects an element containing ':' — and the whole PATH
        // string always does — which silently killed the hub spawn on
        // mac/linux while Windows (no ';' check) kept working.
        let Ok(existing) = std::env::var("PATH") else {
            return;
        };
        #[cfg(not(windows))]
        assert!(std::env::join_paths([&existing]).is_err());
        let elements: Vec<_> = std::env::split_paths(&existing).collect();
        assert!(std::env::join_paths(elements).is_ok());
    }
}
