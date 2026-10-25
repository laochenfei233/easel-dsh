//! DeepSeek Harness desktop shell.
//!
//! The shell embeds the dsh web UI (served by the bundled `dsh` process on the
//! loopback `INTERNAL_PORT`) inside a native window. It owns the dsh child
//! process lifecycle (spawn, health probe, crash restart), a tray icon that
//! keeps the app resident when the window closes, and the first-run wizard
//! that picks an agent preset and installs plugins.

mod app_update;
mod dsh_runner;
mod layout;
mod setup;
mod tray;

use tauri::webview::{NewWindowFeatures, NewWindowResponse};
use tauri::Manager;
use tauri_plugin_opener::OpenerExt;

use dsh_runner::DshHandle;

/// Default loopback port for the bundled `dsh web` process. When occupied, the
/// shell scans upward for a free port and delivers the authenticated launch
/// URL through `dsh://ready`. CLI users who run their own `dsh web` keep the
/// default 3080.
pub const INTERNAL_PORT: u16 = 3081;

/// The main window is declared in `tauri.conf.json` with `"create": false`
/// and built here instead: the `on_new_window` handler that routes popup
/// requests to the system browser is only reachable through the builder, and
/// the main window needs it as much as any window the app creates later.
fn build_main_window(app: &tauri::AppHandle) -> Result<(), String> {
    let window_config = app
        .config()
        .app
        .windows
        .iter()
        .find(|window| window.label == "main")
        .cloned()
        .ok_or_else(|| "No \"main\" window in the Tauri config".to_string())?;

    let handle = app.clone();
    let builder = tauri::WebviewWindowBuilder::from_config(app, &window_config)
        .map_err(|e| e.to_string())?
        .on_new_window(move |url, _features: NewWindowFeatures| {
            open_new_window_externally(&handle, &url)
        });
    // WebKit shells host the dsh UI in its own window, so top-level
    // navigations need the routing the shell page used to relay through the
    // iframe host bridge: the dsh origins stay in the window, everything else
    // opens in the system browser. WebView2 keeps the shell page + iframe
    // design and navigates nothing.
    #[cfg(not(windows))]
    let builder = {
        let handle = app.clone();
        builder.on_navigation(move |url| allow_app_navigation(&handle, url))
    };
    builder
        .build()
        .map_err(|e| e.to_string())?;
    // The window stays hidden here on purpose: a `show()` issued before the
    // event loop starts can be dropped, and showing early presents a blank
    // webview while dsh boots. dsh_runner reveals it on every `dsh://ready`.
    Ok(())
}


/// Schemes we hand to the OS opener. The URL comes from web content, so only
/// the well-known link schemes pass; anything else is refused outright.
fn is_externally_openable(url: &tauri::Url) -> bool {
    matches!(url.scheme(), "http" | "https" | "mailto" | "tel")
}

/// Top-level navigation policy for the WebKit windows that render the dsh UI:
/// the shell pages and the loopback dsh origins stay in the window, every
/// other web target opens in the system browser instead of hijacking the app
/// window (the shell page used to relay this through the iframe host bridge,
/// which is gone once the window hosts the dsh UI directly).
#[cfg(not(windows))]
pub(crate) fn allow_app_navigation(app: &tauri::AppHandle, url: &tauri::Url) -> bool {
    let local = matches!(url.scheme(), "tauri" | "about" | "data" | "blob" | "asset")
        || (matches!(url.scheme(), "http" | "https")
            && matches!(url.host_str(), Some("127.0.0.1") | Some("localhost")));
    if local {
        return true;
    }
    if is_externally_openable(url) {
        let _ = app.opener().open_url(url.as_str(), None::<&str>);
    }
    false
}

/// Send every popup request — `window.open` and `target="_blank"` alike, from
/// the shell or from inside the dsh iframe — to the user's browser and refuse
/// the popup itself.
///
/// Without a handler the platform webview drops these requests on the floor,
/// which is what made `target="_blank"` links dead in the app: WebView2 marks
/// the request handled with nothing to show, so the click does nothing at all.
pub(crate) fn open_new_window_externally(
    app: &tauri::AppHandle,
    url: &tauri::Url,
) -> NewWindowResponse<tauri::Wry> {
    let openable = is_externally_openable(url);
    if openable {
        let opened = app.opener().open_url(url.as_str(), None::<&str>).is_ok()
            || open_with_os(url.as_str()).is_ok();
        log_new_window(app, url, openable, opened);
    }
    NewWindowResponse::Deny
}

/// OS-level fallback for the opener plugin: the shell runs without a console,
/// so an opener failure is invisible; `cmd start` / `open` / `xdg-open` are
/// the same calls the plugin wraps.
fn open_with_os(url: &str) -> std::io::Result<()> {
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x0800_0000;
        std::process::Command::new("cmd")
            .args(["/C", "start", "", url])
            .creation_flags(CREATE_NO_WINDOW)
            .status()
            .map(|_| ())
    }
    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg(url)
            .status()
            .map(|_| ())
    }
    #[cfg(not(any(windows, target_os = "macos")))]
    {
        std::process::Command::new("xdg-open")
            .arg(url)
            .status()
            .map(|_| ())
    }
}

/// Append one popup-routing record to the shell's debug log. The request is
/// denied by design, so this file is the only place a dead link leaves a trace.
fn log_new_window(app: &tauri::AppHandle, url: &tauri::Url, openable: bool, opened: bool) {
    if let Ok(log_dir) = app.path().app_log_dir() {
        let _ = std::fs::create_dir_all(&log_dir);
        if let Ok(mut file) = std::fs::OpenOptions::new()
            .create(true)
            .append(true)
            .open(log_dir.join("new-window.log"))
        {
            use std::io::Write;
            use std::time::{SystemTime, UNIX_EPOCH};
            let ts = SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap_or_default()
                .as_secs();
            let _ = writeln!(file, "{ts} {url} openable={openable} opened={opened}");
        }
    }
}

/// The app is a GUI process, so every console child (cmd.exe from pnpm's
/// .cmd shims, the market's netstat/taskkill probes, git, node-gyp, …) would
/// otherwise create its own visible console window — Node's windowsHide
/// defaults to false and CREATE_NO_WINDOW does not propagate. Giving the app
/// a hidden console makes every descendant attach to it instead.
#[cfg(windows)]
fn hide_child_consoles() {
    unsafe extern "system" {
        fn AllocConsole() -> i32;
        fn GetConsoleWindow() -> *mut core::ffi::c_void;
        fn ShowWindow(hwnd: *mut core::ffi::c_void, n_cmd_show: i32) -> i32;
    }
    unsafe {
        if AllocConsole() != 0 {
            ShowWindow(GetConsoleWindow(), 0); // SW_HIDE
        }
    }
}

#[cfg(not(windows))]
fn hide_child_consoles() {}

pub fn run() {
    hide_child_consoles();
    let builder = tauri::Builder::default();
    // Release only: a second launch of the installed shell must surface the
    // resident instance instead of stacking another tray-resident one (window
    // close only hides to tray) whose forced kill would leave a ghost tray
    // icon behind. The plugin's mutex keys on the shared `ai.easel.desktop`
    // identifier, so a dev build beside an installed shell would bounce off
    // it — dev builds stay multi-instance.
    #[cfg(not(debug_assertions))]
    let builder = builder.plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
        tray::show_main_window(app);
    }));
    builder
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .setup(|app| {
            // EASEL-DIVERGENCE(easel-dsh-layout): relocate user data before the
            // first-run state or the dsh home is read. Installed-only; this runs
            // after the single-instance guard so a second launch cannot migrate
            // under the resident server.
            layout::migrate();
            build_main_window(app.handle())?;
            let handle = DshHandle::spawn(app.handle())?;
            app.manage(handle);
            tray::build(app.handle())?;
            // EASEL-DIVERGENCE(easel-app-update): deferred boot check, 30s in.
            app_update::init(app.handle());
            Ok(())
        })
        .on_window_event(|window, event| {
            // Closing the window hides the app to the tray; the dsh process
            // keeps serving. Only the tray "Quit" action exits for real.
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close();
                let _ = window.hide();
            }
        })
        .invoke_handler(tauri::generate_handler![
            setup::is_initialized,
            setup::first_run_state,
            setup::set_preset,
            setup::install_plugin,
            setup::apply_first_run,
            dsh_runner::dsh_status,
            dsh_runner::authenticate_webview,
            dsh_runner::navigate_main,
            dsh_runner::restart_dsh,
            dsh_runner::open_ui,
            app_update::easel_check_update,
            app_update::easel_update_state,
            app_update::easel_set_update_source,
            app_update::easel_install_update,
        ])
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|app_handle, event| {
            if let tauri::RunEvent::Exit = event {
                if let Some(dsh) = app_handle.try_state::<DshHandle>() {
                    dsh.stop();
                }
            }
        });
}
