//! Installed-layout paths and the one-time legacy-data migration.
//!
//! Release builds live in `%LOCALAPPDATA%\Easel-dsh\app`; user data lives in
//! the sibling `data\` directory:
//!
//!   data\workspace  EASEL_HOME (skills, projects, outputs, .env)
//!   data\home       DSH_HOME (profiles, sessions, credentials)
//!
//! Pre-layout installs kept the program at `%LOCALAPPDATA%\Easel-dsh` and data
//! in `%LOCALAPPDATA%\Easel` + `~/.easel`. The migration moves that data and
//! leaves junctions at the legacy paths: agent-generated project files and
//! session caches contain absolute old paths, and dsh groups sessions by their
//! recorded directory. Migrated installs therefore keep the legacy workspace
//! path as the logical project root (recorded in the marker); the files live
//! under `data\workspace`.

use std::fs;
use std::path::{Path, PathBuf};

use crate::setup::copy_dir;

const LAYOUT_MARKER: &str = ".layout-v2.json";

/// `%LOCALAPPDATA%\Easel-dsh`, or `None` in a dev launch (the exe is not under
/// `app\`). Every path helper falls back to the pre-layout defaults when this
/// returns `None`, so `tauri dev` keeps using the developer's scratch data.
pub(crate) fn install_root() -> Option<PathBuf> {
    install_root_from_exe(&std::env::current_exe().ok()?)
}

fn install_root_from_exe(exe: &Path) -> Option<PathBuf> {
    let dir = exe.parent()?;
    if dir.file_name().and_then(|name| name.to_str()) == Some("app") {
        dir.parent().map(Path::to_path_buf)
    } else {
        None
    }
}

pub(crate) fn data_dir() -> Option<PathBuf> {
    install_root().map(|root| root.join("data"))
}

fn local_app_data() -> PathBuf {
    if let Ok(dir) = std::env::var("LOCALAPPDATA") {
        return PathBuf::from(dir);
    }
    let base = std::env::var("USERPROFILE")
        .or_else(|_| std::env::var("HOME"))
        .unwrap_or_default();
    PathBuf::from(base).join("AppData").join("Local")
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

/// Logical content root. Fresh installs use `data\workspace`; migrated
/// installs keep the legacy junction path so dsh's workspace records and
/// session grouping stay valid.
pub(crate) fn easel_home() -> PathBuf {
    if let Ok(home) = std::env::var("EASEL_HOME") {
        return PathBuf::from(home);
    }
    let Some(data) = data_dir() else {
        return legacy_workspace();
    };
    let legacy = legacy_workspace();
    resolve_easel_home(&data, &legacy)
}

fn resolve_easel_home(data: &Path, legacy: &Path) -> PathBuf {
    let workspace = data.join("workspace");
    if workspace.exists() {
        if let Some(root) = marker_legacy_project_root(data) {
            return root;
        }
        // A crash between the move and the marker write leaves the junction
        // in place; keep the legacy logical path so workspaces do not split.
        if is_reparse_point(legacy) {
            return legacy.to_path_buf();
        }
        return workspace;
    }
    if legacy.exists() {
        return legacy.to_path_buf();
    }
    workspace
}

/// Logical dsh home. The migration moves `~/.easel` to `data\home` and leaves
/// a junction at the old path for the CLI and old references.
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
/// spawns dsh. Failures are logged and leave the legacy paths usable.
pub(crate) fn migrate() {
    let Some(root) = install_root() else {
        return; // dev build or pre-layout install: nothing to do
    };
    let data = root.join("data");
    let _ = fs::create_dir_all(&data);
    if marker_path(&data).exists() {
        cleanup_legacy_app(&root);
        return;
    }
    if let Err(err) = migrate_at(&root, &legacy_workspace(), &legacy_home()) {
        log(&data, &format!("layout migration failed: {err}"));
    }
}

fn migrate_at(root: &Path, legacy_workspace: &Path, legacy_home: &Path) -> Result<(), String> {
    let data = root.join("data");
    fs::create_dir_all(&data).map_err(|e| format!("create data dir: {e}"))?;
    let workspace = data.join("workspace");
    let home = data.join("home");
    let mut legacy_project_root: Option<PathBuf> = None;

    if workspace.exists() {
        if is_reparse_point(legacy_workspace) {
            legacy_project_root = Some(legacy_workspace.to_path_buf());
        }
        // Both real directories: leave them alone. Resolving a user-made
        // duplicate is a manual decision, not something a boot should guess.
    } else if legacy_workspace.exists() && !is_reparse_point(legacy_workspace) {
        move_dir(legacy_workspace, &workspace)?;
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
    if !home.exists() && legacy_home.exists() && !is_reparse_point(legacy_home) {
        move_dir(legacy_home, &home)?;
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

    cleanup_legacy_app(root);
    log(&data, "layout migration complete");
    Ok(())
}

fn move_dir(src: &Path, dest: &Path) -> Result<(), String> {
    if let Some(parent) = dest.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    if fs::rename(src, dest).is_ok() {
        return Ok(());
    }
    copy_dir(src, dest).map_err(|e| format!("copy {}: {e}", src.display()))?;
    fs::remove_dir_all(src).map_err(|e| format!("remove {}: {e}", src.display()))
}

/// The pre-layout install put the exe, runtime and uninstaller directly in
/// root. `app` and `data` are the only entries allowed to stay. Removing the
/// old uninstaller matters: its POSTUNINSTALL hook recursively deletes the
/// legacy `%LOCALAPPDATA%\Easel`, which is now a junction into `data`.
fn cleanup_legacy_app(root: &Path) {
    for entry in ["runtime", "dsh-desktop.exe", "uninstall.exe"] {
        let path = root.join(entry);
        if path.is_dir() {
            let _ = fs::remove_dir_all(&path);
        } else if path.exists() {
            let _ = fs::remove_file(&path);
        }
    }
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
        for path in [root.join("legacy-easel"), root.join("legacy-home")] {
            if is_reparse_point(&path) {
                let _ = remove_link(&path);
            }
        }
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn install_root_requires_an_app_subdirectory() {
        assert_eq!(
            install_root_from_exe(Path::new("C:/x/Easel-dsh/app/dsh-desktop.exe")),
            Some(PathBuf::from("C:/x/Easel-dsh"))
        );
        assert_eq!(
            install_root_from_exe(Path::new("C:/x/Easel-dsh/dsh-desktop.exe")),
            None
        );
        assert_eq!(
            install_root_from_exe(Path::new("C:/x/target/debug/dsh-desktop.exe")),
            None
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
        // The pre-layout program files that cleanup must remove.
        write(
            &root.join("runtime").join("dsh").join("lib").join("bin.js"),
            "old",
        );
        write(&root.join("dsh-desktop.exe"), "old exe");
        write(&root.join("uninstall.exe"), "old uninstaller");
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
        assert!(!root.join("runtime").exists());
        assert!(!root.join("dsh-desktop.exe").exists());
        assert!(!root.join("uninstall.exe").exists());
        let marker = fs::read_to_string(data.join(".layout-v2.json")).unwrap();
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
}
