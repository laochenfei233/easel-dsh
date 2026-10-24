//! First-run wizard support: detect initialization, choose the default agent
//! preset (written into the web profile's `cordis.patch.yml` through the
//! official patch layer), and install plugins through the `dsh plugin` CLI
//! (with a local-copy path for plugins that ship inside the runtime bundle).

use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;

use serde::Serialize;
use serde_yaml::Value as Yaml;
use tauri::{AppHandle, Manager};

use crate::dsh_runner::resolve_runtime;

const PRESET_ROW_ID: &str = "agent-presets";
const STATE_FILE: &str = "desktop.json";

pub fn dsh_home() -> PathBuf {
    // EASEL-DIVERGENCE(easel-dsh-layout): installed builds resolve to
    // <install>\data\home; dev builds and pre-migration installs fall back to
    // the historical ~/.easel (layout::dsh_home owns that precedence).
    crate::layout::dsh_home()
}

fn profile_web_dir(home: &Path) -> PathBuf {
    home.join("profiles").join("web")
}

fn state_path(home: &Path) -> PathBuf {
    home.join(STATE_FILE)
}

#[derive(Serialize)]
pub struct FirstRunState {
    pub initialized: bool,
    pub preset: String,
}

fn read_state(home: &Path) -> (bool, String) {
    // The shell's own marker (written when the first-run wizard completes)
    // decides initialization. The profile patch and package.json are seeded
    // by ensure_default_plugins and the dsh process before the wizard runs,
    // so their existence must not suppress the wizard.
    let initialized = state_path(home).exists();
    let preset = fs::read_to_string(state_path(home))
        .ok()
        .and_then(|raw| serde_json::from_str::<serde_json::Value>(&raw).ok())
        .and_then(|v| v.get("preset").and_then(|p| p.as_str()).map(String::from))
        .unwrap_or_else(|| "standard".to_string());
    (initialized, preset)
}

#[tauri::command]
pub fn is_initialized() -> bool {
    read_state(&dsh_home()).0
}

#[tauri::command]
pub fn first_run_state() -> FirstRunState {
    let (initialized, preset) = read_state(&dsh_home());
    FirstRunState {
        initialized,
        preset,
    }
}

/// Writes the chosen preset into the profile patch (replacing the
/// `agent-presets` row's `config.default`) and records it in the shell state.
#[tauri::command]
pub fn set_preset(preset: String) -> Result<(), String> {
    let home = dsh_home();
    write_state(&home, &preset)?;
    write_preset_patch(&home, &preset)?;
    Ok(())
}

fn write_state(home: &Path, preset: &str) -> Result<(), String> {
    fs::create_dir_all(home).map_err(|e| e.to_string())?;
    let state = serde_json::json!({ "preset": preset });
    fs::write(
        state_path(home),
        serde_json::to_string_pretty(&state).unwrap(),
    )
    .map_err(|e| e.to_string())
}

/// Drop non-mapping rows from a profile patch. Early shell builds wrote
/// `- insert:` fragments that parsed as sequences; the loader rejects any
/// non-mapping overlay entry, so self-heal on read.
fn sanitize_rows(rows: Vec<Yaml>) -> Vec<Yaml> {
    rows.into_iter().filter(|row| row.is_mapping()).collect()
}

fn write_preset_patch(home: &Path, preset: &str) -> Result<(), String> {
    let patch_path = profile_web_dir(home).join("cordis.patch.yml");
    fs::create_dir_all(patch_path.parent().unwrap()).map_err(|e| e.to_string())?;

    let mut rows: Vec<Yaml> = if patch_path.exists() {
        fs::read_to_string(&patch_path)
            .ok()
            .and_then(|raw| serde_yaml::from_str(&raw).ok())
            .map(sanitize_rows)
            .unwrap_or_default()
    } else {
        Vec::new()
    };

    let mut found = false;
    for row in rows.iter_mut() {
        if row.get("id").and_then(Yaml::as_str) == Some(PRESET_ROW_ID) {
            if row.get_mut("config").is_none() {
                row["config"] = Yaml::Mapping(Default::default());
            }
            row["config"]["default"] = Yaml::String(preset.to_string());
            found = true;
            break;
        }
    }
    if !found {
        rows.push(
            serde_yaml::from_str(&format!(
                "id: {PRESET_ROW_ID}\nconfig:\n  default: {preset}\n"
            ))
            .map_err(|e| format!("build patch row: {e}"))?,
        );
    }

    fs::write(
        &patch_path,
        serde_yaml::to_string(&rows).map_err(|e| e.to_string())?,
    )
    .map_err(|e| e.to_string())
}

/// Installs one plugin. `spec` is either a package/Git spec passed to
/// `dsh plugin --profile web add <spec>`, or `local:<name>` for a plugin that
/// ships inside the bundled runtime (`runtime/plugins/<name>`) and is copied
/// into the profile with a patch `insert` row — the dsh-win-terminal-inspector
/// path, which has no npm distribution.
#[tauri::command]
pub async fn install_plugin(app: AppHandle, spec: String) -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(move || install_plugin_sync(&app, &spec))
        .await
        .map_err(|e| e.to_string())?
}

fn install_plugin_sync(app: &AppHandle, spec: &str) -> Result<String, String> {
    if let Some(name) = spec.strip_prefix("local:") {
        return install_local_plugin(app, name);
    }
    let home = dsh_home();
    let (node, dsh_bin) = resolve_runtime(app)?;
    let profile_dir = profile_web_dir(&home);
    fs::create_dir_all(&profile_dir).map_err(|e| e.to_string())?;

    let mut cmd = Command::new(&node);
    no_window(&mut cmd);
    let output = cmd
        .arg(&dsh_bin)
        .arg("plugin")
        .arg("--profile")
        .arg("web")
        .arg("add")
        .arg(spec)
        .current_dir(profile_dir)
        .output()
        .map_err(|e| format!("failed to run dsh plugin add: {e}"))?;
    let stdout = String::from_utf8_lossy(&output.stdout).into_owned();
    let stderr = String::from_utf8_lossy(&output.stderr).into_owned();
    if !output.status.success() {
        return Err(format!(
            "dsh plugin add failed ({})\n{stdout}\n{stderr}",
            output.status
        ));
    }
    Ok(stdout)
}

fn install_local_plugin(app: &AppHandle, name: &str) -> Result<String, String> {
    let runtime_plugins = runtime_plugins_dir(app)?;
    // The runtime plugin directory keeps the repo-style `dsh-` name prefix;
    // accept both the wizard's short id and the actual directory name.
    let src = ["dsh-", ""]
        .iter()
        .map(|prefix| runtime_plugins.join(format!("{prefix}{name}")))
        .find(|p| p.exists())
        .ok_or_else(|| format!("bundled plugin {name} not found in runtime"))?;
    let home = dsh_home();
    let dest = profile_web_dir(&home).join("plugins").join(name);
    fs::create_dir_all(dest.parent().unwrap()).map_err(|e| e.to_string())?;
    copy_dir(&src, &dest)?;

    // Append a patch `insert` row unless one with the same id already exists.
    let patch_path = profile_web_dir(&home).join("cordis.patch.yml");
    let mut rows: Vec<Yaml> = fs::read_to_string(&patch_path)
        .ok()
        .and_then(|raw| serde_yaml::from_str(&raw).ok())
        .unwrap_or_default();
    let exists = rows.iter().any(|row| {
        row.get("insert")
            .and_then(|ins| ins.as_sequence())
            .is_some_and(|seq| {
                seq.iter().any(|entry| {
                    entry.get("id").and_then(Yaml::as_str) == Some("win-terminal-inspector")
                })
            })
    });
    if !exists {
        rows.push(serde_yaml::from_str(
            "insert:\n  - id: win-terminal-inspector\n    name: ./plugins/dsh-win-terminal-inspector/index.js\n",
        ).map_err(|e| format!("build patch row: {e}"))?);
        fs::write(
            &patch_path,
            serde_yaml::to_string(&rows).map_err(|e| e.to_string())?,
        )
        .map_err(|e| e.to_string())?;
    }
    Ok(format!("installed {name}"))
}

/// Preinstalled default plugins (Windows terminal inspector only — older
/// builds also bundled a plugin market, now retired and healed away below).
/// The shell copies the inspector from the bundled runtime into the web
/// profile on first launch — the wizard no longer installs it. The copy AND
/// its patch row are gated on the plugin being present in the runtime:
/// mac/linux bundles do not ship it, and an entry the loader cannot resolve
/// crashes the hub on every startup.
pub(crate) fn ensure_default_plugins(app: &AppHandle) -> Result<(), String> {
    let home = dsh_home();
    let profile = profile_web_dir(&home);
    // The patch layer below writes into the profile directory. Windows used
    // to create it as a side effect of the win-terminal copy; POSIX never
    // did, so a fresh profile left the patch write failing with ENOENT and
    // the hub never spawning (blank shell window, no logs).
    fs::create_dir_all(&profile).map_err(|e| e.to_string())?;
    let runtime_plugins = match runtime_plugins_dir(app) {
        Ok(dir) => dir,
        Err(_) => return Ok(()), // dev without bundled plugins: nothing to preinstall
    };

    // dsh-win-terminal-inspector has no npm distribution; it ships as a local
    // copy inside the profile's plugins directory.
    let win_src = runtime_plugins.join("dsh-win-terminal-inspector");
    let win_present = win_src.exists();
    if win_present {
        let dest = profile.join("plugins").join("dsh-win-terminal-inspector");
        if !dest.exists() {
            fs::create_dir_all(dest.parent().unwrap()).map_err(|e| e.to_string())?;
            copy_dir(&win_src, &dest)?;
        }
    }

    let patch_path = profile.join("cordis.patch.yml");
    let mut rows: Vec<Yaml> = fs::read_to_string(&patch_path)
        .ok()
        .and_then(|raw| serde_yaml::from_str(&raw).ok())
        .map(sanitize_rows)
        .unwrap_or_default();
    // EASEL-DIVERGENCE: the plugin market is not part of Easel-dsh; older
    // shells preinstalled and registered it. Heal every trace on each start.
    heal_market_removal(&home, &profile, &mut rows);
    if win_present {
        if !has_patch_row(&rows, "win-terminal-inspector") {
            rows.push(serde_yaml::from_str(
                "insert:\n  - id: win-terminal-inspector\n    name: ./plugins/dsh-win-terminal-inspector/index.js\n",
            ).map_err(|e| format!("build patch row: {e}"))?);
        }
    } else {
        // Self-heal: older builds wrote the row unconditionally, and the
        // loader fails hard on the missing entry — drop it where the plugin
        // is not shipped.
        remove_patch_row(&mut rows, "win-terminal-inspector");
    }
    // MCP servers are per-instance config rows on the built-in mcp-client
    // bridge (already shipped in the runtime closure); a commented template
    // in the user patch layer makes local MCP support discoverable.
    let mut patch_text = serde_yaml::to_string(&rows).map_err(|e| e.to_string())?;
    if !patch_text.contains("dsh-mcp-client") {
        patch_text.push_str(MCP_TEMPLATE);
    }
    fs::write(&patch_path, patch_text).map_err(|e| e.to_string())?;
    Ok(())
}

/// Commented mcp-client template appended to the profile patch layer. MCP
/// servers are one config row per server (serverName/transport/command/args);
/// uncommenting and editing enables a server, hot-reloaded by the loader.
const MCP_TEMPLATE: &str = r#"
# MCP 服务器接入：内置 dsh-mcp-client，工具名形如 mcp__<server>__<tool>。
# 取消注释并填入你的服务器即启用（自动热重载）：
# - insert:
#     - id: mcp-my-server
#       name: '@deepseek-ai/dsh-mcp-client'
#       config:
#         serverName: my-server
#         transport: stdio
#         command: npx
#         args: ['-y', '@modelcontextprotocol/server-filesystem', '/path/to/dir']
"#;

/// EASEL-DIVERGENCE: uninstall the market older shells preinstalled — the
/// payload copy under `$DSH_HOME/profiles/node_modules`, the patch row in
/// either shape, and a bundle-list entry its self-update could have recorded.
/// Best-effort: the market is absent on fresh installs, and a locked payload
/// file must not fail startup — dropping the row already stops it loading.
fn heal_market_removal(home: &Path, profile: &Path, rows: &mut Vec<Yaml>) {
    let payload = home.join("profiles").join("node_modules").join("dsh-plugin");
    if payload.exists() {
        let _ = fs::remove_dir_all(&payload);
    }
    let _ = remove_bundle_listing(profile, "dsh-plugin");
    remove_patch_row(rows, "dsh-plugin");
}

/// Drop every patch row whose insert list contains `id`.
fn remove_patch_row(rows: &mut Vec<Yaml>, id: &str) {
    rows.retain(|row| {
        !row.get("insert")
            .and_then(|ins| ins.as_sequence())
            .is_some_and(|seq| {
                seq.iter()
                    .any(|e| e.get("id").and_then(Yaml::as_str) == Some(id))
            })
    });
}

/// Whether the row carrying `id` exists in either shape (plain or insert).
fn has_patch_row(rows: &[Yaml], id: &str) -> bool {
    rows.iter().any(|row| {
        row.get("insert")
            .and_then(|ins| ins.as_sequence())
            .is_some_and(|seq| {
                seq.iter()
                    .any(|e| e.get("id").and_then(Yaml::as_str) == Some(id))
            })
    })
}

// ---------------------------------------------------------------------------
// Bundled Easel integration.
//
// The runtime bundle ships the Easel project tree (runtime/easel: skills,
// plugin source, profile template) and the plugin payload
// (runtime/plugins/dsh-plugin-easel). The registration rows live in the
// profile's patch layer, written here — the plugin package no longer carries
// its own bundle patch, and the client half resolves through the same bare
// package name in the profile module fallback (the dsh-plugin precedent).
//
// The easel-skills row reuses the shipped `@deepseek-ai/dsh-skill-filesystem`
// provider a second time, pointed at Easel's own skill directory: frontmatter
// parsing, name validation, and invocation policy stay its job. Registered at
// the deployment level, its provider joins the skill registry's global layer,
// so every preset's agent reads the merged catalog and an Easel skill name
// never shadows a repository skill.
//
// The ui-plugin-manager disable row implements the frontend-replacement
// policy: the sidebar belongs to Easel's navigation, so dsh's own sidebar
// entry moves into Settings (whose "Built-in plugins" section is a separate
// package and keeps mounting). It disables a ROW, never dsh's source — see
// easel-dsh-frontend.md §2.6.2. Users re-enable it by editing the row to
// `disabled: false`, not by deleting it (the shell re-adds missing rows).

const EASEL_STAMP_FILE: &str = ".bundle-version";
const EASEL_PLUGIN_NAME: &str = "dsh-plugin-easel";

/// Content root of the bundled Easel integration. Installed builds keep it
/// under `<install>\data\workspace` (migrated installs keep the legacy path so
/// dsh workspace records stay valid); `EASEL_HOME` overrides for dev.
pub(crate) fn easel_home() -> PathBuf {
    crate::layout::easel_home()
}

fn runtime_easel_dir(app: &AppHandle) -> Option<PathBuf> {
    if let Ok(dir) = app.path().resource_dir() {
        let bundled = dir.join("runtime").join("easel");
        if bundled.exists() {
            return Some(bundled);
        }
    }
    // Dev launches have no bundled resources; EASEL_BUNDLE_DIR points at a
    // staged runtime/easel tree (mirrors DSH_DESKTOP_PLUGINS_DIR).
    std::env::var("EASEL_BUNDLE_DIR").map(PathBuf::from).ok()
}

/// Entry point on the spawn path. No-op wherever the bundle is absent (dev
/// without staging, non-Windows), otherwise deploy/sync/register.
pub(crate) fn ensure_easel_bundle(app: &AppHandle) -> Result<(), String> {
    let runtime_easel = match runtime_easel_dir(app) {
        Some(dir) => dir,
        None => return Ok(()),
    };
    let runtime_payload = match runtime_plugins_dir(app) {
        Ok(dir) => dir.join(EASEL_PLUGIN_NAME),
        Err(_) => return Ok(()),
    };
    let home = dsh_home();
    ensure_easel_bundle_at(&runtime_easel, &runtime_payload, &easel_home(), &home)
}

/// Deploy the bundled Easel tree, refresh the profile payload, and write the
/// registration rows. Every step is idempotent and user data (outputs/, real
/// profiles, .env, existing patch rows' config) is never overwritten:
///
/// 1. stamp-gated sync of `skills/` + `dsh-plugin-easel/` into EASEL_HOME
///    (replaced) and `profiles/_template` + README + LICENSE (missing only);
/// 2. the profile payload in `$DSH_HOME/profiles/node_modules` is re-copied
///    on every start — the plugin has no market self-update, the shell is its
///    only update channel;
/// 3. patch rows are insert-if-absent by id across both row shapes: a plain
///    config-override row (pre-bundle installs) converts in place, keeping
///    its config, and the skills row's default root follows the converted
///    easel row's projectRoot so the two never fork.
pub(crate) fn ensure_easel_bundle_at(
    runtime_easel: &Path,
    runtime_payload: &Path,
    easel_root: &Path,
    home: &Path,
) -> Result<(), String> {
    if !runtime_payload.join("package.json").exists() || !runtime_easel.join("VERSION").exists() {
        return Ok(());
    }

    let version = fs::read_to_string(runtime_easel.join("VERSION"))
        .map_err(|e| format!("read easel VERSION: {e}"))?
        .trim()
        .to_string();
    let stamp = easel_root.join(EASEL_STAMP_FILE);
    let deployed = fs::read_to_string(&stamp)
        .unwrap_or_default()
        .trim()
        .to_string();
    if deployed != version {
        fs::create_dir_all(easel_root).map_err(|e| e.to_string())?;
        for dir in ["skills", EASEL_PLUGIN_NAME] {
            let dest = easel_root.join(dir);
            if dest.exists() {
                fs::remove_dir_all(&dest).map_err(|e| format!("clear easel {dir}: {e}"))?;
            }
            copy_dir(&runtime_easel.join(dir), &dest)?;
        }
        let template = easel_root.join("profiles").join("_template");
        if !template.exists() {
            copy_dir(&runtime_easel.join("profiles").join("_template"), &template)?;
        }
        for rel in ["README.md", "LICENSE"] {
            let dest = easel_root.join(rel);
            if !dest.exists() {
                fs::copy(runtime_easel.join(rel), &dest)
                    .map_err(|e| format!("copy easel {rel}: {e}"))?;
            }
        }
        fs::write(&stamp, &version).map_err(|e| e.to_string())?;
    }

    let payload_dest = home
        .join("profiles")
        .join("node_modules")
        .join(EASEL_PLUGIN_NAME);
    if payload_dest.exists() {
        fs::remove_dir_all(&payload_dest).map_err(|e| e.to_string())?;
    }
    fs::create_dir_all(payload_dest.parent().unwrap()).map_err(|e| e.to_string())?;
    copy_dir(runtime_payload, &payload_dest)?;

    let profile = profile_web_dir(home);
    fs::create_dir_all(&profile).map_err(|e| e.to_string())?;
    remove_bundle_listing(&profile, EASEL_PLUGIN_NAME)?;

    let patch_path = profile.join("cordis.patch.yml");
    let mut rows: Vec<Yaml> = fs::read_to_string(&patch_path)
        .ok()
        .and_then(|raw| serde_yaml::from_str(&raw).ok())
        .map(sanitize_rows)
        .unwrap_or_default();

    // Paths go through the YAML serializer so backslashes and non-ASCII are
    // quoted by it, never hand-escaped.
    let project_root = yaml_scalar(easel_root.to_string_lossy().as_ref())?;
    let converted_root = ensure_easel_row(
        &mut rows,
        "easel",
        &format!(
            "insert:\n  - id: easel\n    name: {EASEL_PLUGIN_NAME}\n    config:\n      projectRoot: {project_root}\n"
        ),
    )?;
    // Keep the skills root and the deployed projectRoot in one story: a
    // converted row pins its own root, fresh installs use EASEL_HOME.
    let root_dir = converted_root.unwrap_or_else(|| easel_root.to_string_lossy().into_owned());
    let skills_dir = yaml_scalar(
        &Path::new(&root_dir)
            .join("skills")
            .join("openclaw")
            .to_string_lossy(),
    )?;
    ensure_easel_row(
        &mut rows,
        "easel-skills",
        &format!(
            "insert:\n  - id: easel-skills\n    name: '@deepseek-ai/dsh-skill-filesystem'\n    config:\n      providerName: easel\n      includeDefaultRoots: false\n      customSkillDirs: [{skills_dir}]\n"
        ),
    )?;
    // Feature plugins split out of the core easel plugin: each mounts its own
    // routes into the core `easelApi` registry, so disabling one row turns one
    // feature off without touching the workbench. Both resolve through the core
    // package's exports map (dsh-plugin-easel/<name>).
    ensure_easel_row(
        &mut rows,
        "easel-automation",
        "insert:\n  - id: easel-automation\n    name: dsh-plugin-easel/automation\n",
    )?;
    ensure_easel_row(
        &mut rows,
        "easel-deconstruct",
        "insert:\n  - id: easel-deconstruct\n    name: dsh-plugin-easel/deconstruct\n",
    )?;
    // 隔空传送 (air transfer): the package ships inside the CLI deploy closure;
    // this row mounts its service, received projects land under the project
    // root's `projects` directory beside the 立项 workspaces, and pushed data
    // files (.env / profiles / skills / outputs) land on the data root itself.
    let handoff_dir = yaml_scalar(&Path::new(&root_dir).join("projects").to_string_lossy())?;
    let data_dir = yaml_scalar(&root_dir.to_string_lossy())?;
    ensure_easel_row(
        &mut rows,
        "easel-lan-handoff",
        &format!(
            "insert:\n  - id: easel-lan-handoff\n    name: '@easel-dsh/easel-air-transfer'\n    config:\n      handoffDirectory: {handoff_dir}\n      dataDirectory: {data_dir}\n"
        ),
    )?;
    // Installs that mounted handoff before `dataDirectory` existed keep their
    // old config verbatim; stamp the current data root so pushed data files
    // (.env / profiles / skills / outputs) have a home after the upgrade. The
    // row keeps its id across the package rename, but an insert row written by
    // an older shell still names the pre-rename package — rewrite it, or the
    // upgraded runtime resolves a package the closure no longer carries.
    if let Some(entry) = rows
        .iter_mut()
        .find(|row| row_has_id(row, "easel-lan-handoff"))
        .and_then(|row| row.get_mut("insert"))
        .and_then(|insert| insert.as_sequence_mut())
        .and_then(|sequence| sequence.first_mut())
    {
        if entry.get("config").and_then(|config| config.get("dataDirectory")).is_none() {
            entry["config"]["dataDirectory"] = Yaml::String(root_dir.clone());
        }
        if entry.get("name").and_then(Yaml::as_str) == Some("@deepseek-ai/dsh-lan-handoff") {
            entry["name"] = Yaml::String("@easel-dsh/easel-air-transfer".into());
        }
    }
    if !rows
        .iter()
        .any(|row| row_has_id(row, "ui-plugin-manager"))
    {
        rows.push(
            serde_yaml::from_str("- id: ui-plugin-manager\n  disabled: true\n")
                .map_err(|e| format!("build ui-plugin-manager row: {e}"))?,
        );
    }

    fs::write(
        &patch_path,
        serde_yaml::to_string(&rows).map_err(|e| e.to_string())?,
    )
    .map_err(|e| e.to_string())
}

/// Serialize a string as a YAML scalar (quoted when the value requires it).
fn yaml_scalar(value: &str) -> Result<String, String> {
    serde_yaml::to_string(value)
        .map(|text| text.trim().to_string())
        .map_err(|e| format!("yaml scalar: {e}"))
}

/// Whether the row carries `id` — either as a plain disable/config row or
/// inside its `insert` sequence.
fn row_has_id(row: &Yaml, id: &str) -> bool {
    if row.get("id").and_then(Yaml::as_str) == Some(id) {
        return true;
    }
    row.get("insert")
        .and_then(|ins| ins.as_sequence())
        .is_some_and(|seq| {
            seq.iter()
                .any(|entry| entry.get("id").and_then(Yaml::as_str) == Some(id))
        })
}

/// Insert the row unless an entry with the same id exists in any shape. A
/// plain (config-override) row predates the shell-owned insert row — the
/// bundle patch that provided its insert counterpart is gone, so convert in
/// place, keeping the user's config and `disabled` flag. Returns the plain
/// row's `projectRoot` when one was converted.
fn ensure_easel_row(
    rows: &mut Vec<Yaml>,
    id: &str,
    row_yaml: &str,
) -> Result<Option<String>, String> {
    let fresh: Yaml = serde_yaml::from_str(row_yaml).map_err(|e| format!("build {id} row: {e}"))?;
    let Some(index) = rows.iter().position(|row| row_has_id(row, id)) else {
        rows.push(fresh);
        return Ok(None);
    };
    if rows[index].get("insert").is_some() {
        return Ok(None); // shell-shaped or user-edited insert row: leave it
    }
    let mut converted = fresh;
    if let Some(entry) = converted
        .get_mut("insert")
        .and_then(|insert| insert.as_sequence_mut())
        .and_then(|seq| seq.first_mut())
    {
        if let Some(config) = rows[index].get("config").cloned() {
            entry["config"] = config;
        }
        if let Some(disabled) = rows[index].get("disabled").cloned() {
            entry["disabled"] = disabled;
        }
    }
    let project_root = rows[index]
        .get("config")
        .and_then(|config| config.get("projectRoot"))
        .and_then(Yaml::as_str)
        .map(String::from);
    rows[index] = converted;
    Ok(project_root)
}

/// Keep a name out of the profile's bundle list. A leftover row makes the
/// composer skip that bundle with a warning on every start (the easel plugin
/// no longer declares `dsh.bundle`; the retired market must not load at all).
/// Read-modify-write; fresh profiles have no package.json yet — nothing to
/// remove, and nothing to add either: the patch rows are the whole
/// registration.
fn remove_bundle_listing(profile: &Path, name: &str) -> Result<(), String> {
    let path = profile.join("package.json");
    let Ok(raw) = fs::read_to_string(&path) else {
        return Ok(());
    };
    let Ok(mut manifest) = serde_json::from_str::<serde_json::Value>(&raw) else {
        return Ok(());
    };
    let Some(bundles) = manifest
        .get_mut("dsh")
        .and_then(|dsh| dsh.get_mut("profile"))
        .and_then(|layer| layer.get_mut("bundles"))
        .and_then(|bundles| bundles.as_array_mut())
    else {
        return Ok(());
    };
    let before = bundles.len();
    bundles.retain(|row| row.as_str() != Some(name));
    if bundles.len() == before {
        return Ok(());
    }
    fs::write(
        &path,
        serde_json::to_string_pretty(&manifest).map_err(|e| e.to_string())? + "\n",
    )
    .map_err(|e| e.to_string())
}

#[cfg(test)]
mod easel_tests {
    use super::*;

    fn temp_dir(tag: &str) -> PathBuf {
        // The user temp dir is not always writable from sandboxed test runs;
        // cargo's own target/ is.
        let dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .join("target")
            .join("tmp")
            .join(format!("easel-setup-test-{tag}"));
        let _ = fs::remove_dir_all(&dir);
        dir
    }

    fn write(path: &Path, contents: &str) {
        fs::create_dir_all(path.parent().unwrap()).unwrap();
        fs::write(path, contents).unwrap();
    }

    /// A minimal bundled runtime: the runtime/easel content tree plus the
    /// plugin payload. Calling again with a different version restages it.
    fn stage_bundle(root: &Path, version: &str, skill: &str) -> (PathBuf, PathBuf) {
        let tree = root.join("runtime").join("easel");
        write(&tree.join("VERSION"), version);
        write(&tree.join("skills/openclaw/skill-a/SKILL.md"), skill);
        write(&tree.join("dsh-plugin-easel/index.js"), "// plugin source");
        write(&tree.join("profiles/_template/identity.md"), "template");
        write(&tree.join("README.md"), "readme");
        write(&tree.join("LICENSE"), "license");
        let payload = root.join("runtime").join("plugins").join("dsh-plugin-easel");
        write(&payload.join("package.json"), "{\"name\":\"dsh-plugin-easel\"}");
        write(&payload.join("index.js"), "// plugin");
        (tree, payload)
    }

    fn patch_text(home: &Path) -> String {
        fs::read_to_string(profile_web_dir(home).join("cordis.patch.yml")).unwrap()
    }

    #[test]
    fn fresh_install_deploys_and_registers() {
        let root = temp_dir("fresh");
        let (tree, payload) = stage_bundle(&root, "0.1.0", "v1");
        let home = root.join("home");
        let easel = root.join("easel-home");

        ensure_easel_bundle_at(&tree, &payload, &easel, &home).unwrap();

        assert_eq!(fs::read_to_string(easel.join(".bundle-version")).unwrap(), "0.1.0");
        assert_eq!(
            fs::read_to_string(easel.join("skills/openclaw/skill-a/SKILL.md")).unwrap(),
            "v1"
        );
        assert!(easel.join("README.md").exists());
        assert!(easel.join("LICENSE").exists());
        assert!(easel.join("profiles/_template/identity.md").exists());
        assert_eq!(
            fs::read_to_string(home.join("profiles/node_modules/dsh-plugin-easel/index.js"))
                .unwrap(),
            "// plugin"
        );
        let patch = patch_text(&home);
        assert!(patch.contains("id: easel"));
        assert!(patch.contains("id: easel-skills"));
        assert!(patch.contains("id: ui-plugin-manager"));
        assert!(patch.contains("disabled: true"));
        // The skills row must point inside the deployed root, not at it.
        assert!(patch.contains(
            easel.join("skills").join("openclaw").to_string_lossy().as_ref()
        ));
        assert!(patch.contains(easel.to_string_lossy().as_ref()));
    }

    #[test]
    fn rerun_is_idempotent_and_keeps_user_data() {
        let root = temp_dir("idem");
        let (tree, payload) = stage_bundle(&root, "0.1.0", "v1");
        let home = root.join("home");
        let easel = root.join("easel-home");
        ensure_easel_bundle_at(&tree, &payload, &easel, &home).unwrap();
        write(&easel.join("outputs/private.txt"), "keep me");
        write(&easel.join("skills/openclaw/skill-a/SKILL.md"), "user edit");
        // The payload copy is outside the stamp gate: even with the version
        // unchanged it must be restored from the runtime on every start.
        write(
            &home.join("profiles/node_modules/dsh-plugin-easel/index.js"),
            "// tampered",
        );
        let rows_before = patch_text(&home).matches("id: easel").count();

        ensure_easel_bundle_at(&tree, &payload, &easel, &home).unwrap();

        assert_eq!(
            fs::read_to_string(easel.join("outputs/private.txt")).unwrap(),
            "keep me"
        );
        // The stamp is unchanged, so the user's skill edit survives.
        assert_eq!(
            fs::read_to_string(easel.join("skills/openclaw/skill-a/SKILL.md")).unwrap(),
            "user edit"
        );
        assert_eq!(
            fs::read_to_string(home.join("profiles/node_modules/dsh-plugin-easel/index.js"))
                .unwrap(),
            "// plugin"
        );
        assert_eq!(patch_text(&home).matches("id: easel").count(), rows_before);
    }

    #[test]
    fn version_bump_resyncs_skills_but_keeps_user_data() {
        let root = temp_dir("bump");
        let (tree, payload) = stage_bundle(&root, "0.1.0", "v1");
        let home = root.join("home");
        let easel = root.join("easel-home");
        ensure_easel_bundle_at(&tree, &payload, &easel, &home).unwrap();
        write(&easel.join("outputs/private.txt"), "keep me");
        stage_bundle(&root, "0.2.0", "v2");

        ensure_easel_bundle_at(&tree, &payload, &easel, &home).unwrap();

        assert_eq!(
            fs::read_to_string(easel.join("skills/openclaw/skill-a/SKILL.md")).unwrap(),
            "v2"
        );
        assert_eq!(fs::read_to_string(easel.join(".bundle-version")).unwrap(), "0.2.0");
        assert_eq!(
            fs::read_to_string(easel.join("outputs/private.txt")).unwrap(),
            "keep me"
        );
    }

    #[test]
    fn plain_config_rows_convert_keeping_project_root() {
        let root = temp_dir("convert");
        let (tree, payload) = stage_bundle(&root, "0.1.0", "v1");
        let home = root.join("home");
        let easel = root.join("easel-home");
        write(
            &profile_web_dir(&home).join("cordis.patch.yml"),
            "- id: easel\n  config:\n    projectRoot: C:\\repo\n- id: ui-plugin-manager\n  disabled: true\n",
        );

        ensure_easel_bundle_at(&tree, &payload, &easel, &home).unwrap();

        let patch = patch_text(&home);
        // Converted to an insert row keeping the pinned root…
        assert!(patch.contains("name: dsh-plugin-easel"));
        assert!(patch.contains("C:\\repo"));
        // …and the skills root follows it, never EASEL_HOME.
        assert!(patch.contains("C:\\repo\\skills\\openclaw"));
        assert!(!patch.contains(&easel.to_string_lossy().as_ref()));
        // No duplicate disable row.
        assert_eq!(patch.matches("id: ui-plugin-manager").count(), 1);
    }

    #[test]
    fn existing_insert_rows_are_left_alone() {
        let root = temp_dir("keep");
        let (tree, payload) = stage_bundle(&root, "0.1.0", "v1");
        let home = root.join("home");
        let easel = root.join("easel-home");
        write(
            &profile_web_dir(&home).join("cordis.patch.yml"),
            "- insert:\n    - id: easel\n      name: dsh-plugin-easel\n      disabled: true\n      config:\n        projectRoot: C:\\repo\n",
        );

        ensure_easel_bundle_at(&tree, &payload, &easel, &home).unwrap();

        let patch = patch_text(&home);
        assert!(patch.contains("disabled: true"));
        assert!(patch.contains("C:\\repo"));
        // The user's easel row plus the fresh rows this shell maintains, one each.
        for id in ["easel", "easel-skills", "easel-automation", "easel-deconstruct"] {
            assert_eq!(patch.matches(&format!("- id: {id}\n")).count(), 1, "row {id}");
        }
    }

    #[test]
    fn leftover_bundle_row_is_removed_and_fresh_profiles_untouched() {
        let root = temp_dir("bundles");
        let (tree, payload) = stage_bundle(&root, "0.1.0", "v1");
        let home = root.join("home");
        let easel = root.join("easel-home");
        write(
            &profile_web_dir(&home).join("package.json"),
            "{\"name\":\"p\",\"dsh\":{\"profile\":{\"bundles\":[\"@deepseek-ai/dsh-base\",\"dsh-plugin-easel\"]}}}",
        );

        ensure_easel_bundle_at(&tree, &payload, &easel, &home).unwrap();

        let manifest: serde_json::Value = serde_json::from_str(
            &fs::read_to_string(profile_web_dir(&home).join("package.json")).unwrap(),
        )
        .unwrap();
        let bundles = manifest["dsh"]["profile"]["bundles"].as_array().unwrap();
        assert_eq!(bundles.len(), 1);
        assert_eq!(bundles[0], "@deepseek-ai/dsh-base");
    }

    #[test]
    fn market_removal_heals_payload_row_and_bundle_listing() {
        let root = temp_dir("market");
        let home = root.join("home");
        let profile = profile_web_dir(&home);
        // An install from when the shell preinstalled the market: its payload
        // copy, its patch row (the insert shape an older shell wrote), and its
        // self-update's bundle-list entry.
        write(
            &profile.join("cordis.patch.yml"),
            "- insert:\n    - id: dsh-plugin\n      name: dsh-plugin\n- insert:\n    - id: keep-me\n      name: some-plugin\n",
        );
        write(
            &profile.join("package.json"),
            "{\"name\":\"p\",\"dsh\":{\"profile\":{\"bundles\":[\"dsh-plugin\",\"@deepseek-ai/dsh-base\"]}}}",
        );
        write(&home.join("profiles/node_modules/dsh-plugin/index.js"), "// market");

        let mut rows: Vec<Yaml> = serde_yaml::from_str(&patch_text(&home)).unwrap();
        heal_market_removal(&home, &profile, &mut rows);

        assert!(!home.join("profiles/node_modules/dsh-plugin").exists());
        let manifest: serde_json::Value = serde_json::from_str(
            &fs::read_to_string(profile.join("package.json")).unwrap(),
        )
        .unwrap();
        let bundles = manifest["dsh"]["profile"]["bundles"].as_array().unwrap();
        assert_eq!(bundles.len(), 1);
        assert_eq!(bundles[0], "@deepseek-ai/dsh-base");
        let written = serde_yaml::to_string(&rows).unwrap();
        assert!(!written.contains("dsh-plugin"));
        assert!(written.contains("keep-me"));
    }
}

/// The app is a GUI process; spawned children would flash a console window.
fn no_window(cmd: &mut std::process::Command) {
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x0800_0000;
        cmd.creation_flags(CREATE_NO_WINDOW);
    }
}

fn runtime_plugins_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let resource_dir = app
        .path()
        .resource_dir()
        .map_err(|e| format!("resource dir unavailable: {e}"))?;
    let bundled = resource_dir.join("runtime").join("plugins");
    if bundled.exists() {
        return Ok(bundled);
    }
    std::env::var("DSH_DESKTOP_PLUGINS_DIR")
        .map(PathBuf::from)
        .map_err(|_| "no bundled plugins dir; set DSH_DESKTOP_PLUGINS_DIR in dev".to_string())
}

pub(crate) fn copy_dir(src: &Path, dest: &Path) -> Result<(), String> {
    fs::create_dir_all(dest).map_err(|e| e.to_string())?;
    for entry in fs::read_dir(src).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        let target = dest.join(entry.file_name());
        if entry.file_type().map_err(|e| e.to_string())?.is_dir() {
            copy_dir(&entry.path(), &target)?;
        } else {
            fs::copy(entry.path(), &target).map_err(|e| e.to_string())?;
        }
    }
    Ok(())
}

/// Runs the full first-run flow: set the preset, then install every selected
/// plugin in order. The frontend calls this after the user confirms the
/// wizard; each step's output streams back via the individual commands.
#[tauri::command]
pub async fn apply_first_run(
    app: AppHandle,
    preset: String,
    plugins: Vec<String>,
) -> Result<(), String> {
    set_preset(preset)?;
    for spec in plugins {
        install_plugin(app.clone(), spec).await?;
    }
    Ok(())
}
