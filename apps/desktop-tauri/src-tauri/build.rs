// The app manifest registers the commands declared in `generate_handler!` with
// the ACL so a remote webview (the WebKit app window) can be granted them.
// Defining it also routes local windows through the ACL, so every command the
// shell page invokes is granted in capabilities/default.json.
const COMMANDS: &[&str] = &[
    "is_initialized",
    "first_run_state",
    "set_preset",
    "install_plugin",
    "apply_first_run",
    "dsh_status",
    "authenticate_webview",
    "navigate_main",
    "restart_dsh",
    "open_ui",
    "easel_check_update",
    "easel_update_state",
    "easel_set_update_source",
    "easel_install_update",
];

fn main() {
    tauri_build::try_build(
        tauri_build::Attributes::new()
            .app_manifest(tauri_build::AppManifest::new().commands(COMMANDS)),
    )
    .expect("failed to run tauri-build")
}
