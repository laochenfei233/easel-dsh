; Bundled Easel installer/uninstaller hooks.
;
; Layout contract (easel-dsh-layout): the program lives directly in
; %LOCALAPPDATA%\Easel-dsh; user data lives in <Documents>\Easel-dsh by
; default (the settings page can move it), outside the install directory. The
; shell records the chosen root in %LOCALAPPDATA%\ai.easel.desktop\data-root.json.
; v2/v3 installs kept data in the sibling data\ directory and pre-alpha.32
; installs kept the program in app\; both are relocated/cleaned here.
; Pre-layout installs kept data in %LOCALAPPDATA%\Easel + %USERPROFILE%\.easel;
; the legacy roots and junctions are cleaned here.
;
; The shell is tray-resident and spawns the dsh web server from its runtime
; directory. Tauri's CheckIfAppIsRunning only terminates the shell binary; a
; forced kill never runs RunEvent::Exit, so the node child keeps serving from
; the install directory and locks runtime\ against the next upgrade. Stop the
; shell first (its supervisor would otherwise respawn the child), then every
; process whose executable lives under runtime\ — the flat root and the
; pre-alpha.32 app\ subtree alike. Matches are by executable path, never by
; image name, so other node applications are untouched.

!macro EASEL_STOP_RUNTIME
  InitPluginsDir
  FileOpen $0 "$PLUGINSDIR\stop-easel.ps1" w
  FileWrite $0 '$$dirs = @((Join-Path $$env:LOCALAPPDATA $\"Easel-dsh$\"), $\"$INSTDIR$\") | Select-Object -Unique$\r$\n'
  FileWrite $0 '$$shells = @()$\r$\n'
  FileWrite $0 '$$runtimes = @()$\r$\n'
  FileWrite $0 'foreach ($$d in $$dirs) {$\r$\n'
  FileWrite $0 '  $$shells += (Join-Path $$d $\"dsh-desktop.exe$\"), (Join-Path $$d $\"app\dsh-desktop.exe$\")$\r$\n'
  FileWrite $0 '  $$runtimes += (Join-Path $$d $\"runtime$\"), (Join-Path $$d $\"app\runtime$\")$\r$\n'
  FileWrite $0 '}$\r$\n'
  FileWrite $0 'foreach ($$s in $$shells) {$\r$\n'
  FileWrite $0 '  Get-CimInstance Win32_Process | Where-Object { $$_.ExecutablePath -and $$_.ExecutablePath -ieq $$s } | ForEach-Object { Stop-Process -Id $$_.ProcessId -Force -ErrorAction SilentlyContinue }$\r$\n'
  FileWrite $0 '}$\r$\n'
  FileWrite $0 'Start-Sleep -Milliseconds 400$\r$\n'
  FileWrite $0 'for ($$i = 0; $$i -lt 2; $$i++) {$\r$\n'
  FileWrite $0 '  foreach ($$r in $$runtimes) {$\r$\n'
  FileWrite $0 '    $$prefix = $$r + [IO.Path]::DirectorySeparatorChar$\r$\n'
  FileWrite $0 '    Get-CimInstance Win32_Process | Where-Object { $$_.ExecutablePath -and $$_.ExecutablePath.StartsWith($$prefix, [StringComparison]::OrdinalIgnoreCase) } | ForEach-Object { Stop-Process -Id $$_.ProcessId -Force -ErrorAction SilentlyContinue }$\r$\n'
  FileWrite $0 '  }$\r$\n'
  FileWrite $0 '  Start-Sleep -Milliseconds 200$\r$\n'
  FileWrite $0 '}$\r$\n'
  FileClose $0
  nsExec::ExecToLog 'powershell -NoProfile -ExecutionPolicy Bypass -File "$PLUGINSDIR\stop-easel.ps1"'
  Pop $0
  Sleep 500
!macroend

!macro NSIS_HOOK_PREINSTALL
  !insertmacro EASEL_STOP_RUNTIME
!macroend

!macro NSIS_HOOK_PREUNINSTALL
  !insertmacro EASEL_STOP_RUNTIME
!macroend

!macro NSIS_HOOK_POSTINSTALL
  ; Pre-alpha.32 installs kept the whole program tree in `<root>\app`; the
  ; flat layout installs beside it. Stop everything again before removing the
  ; nested tree: between PREINSTALL and now the user (or a tray shortcut) can
  ; have relaunched the old shell, and a locked exe would leave app\ behind.
  !insertmacro EASEL_STOP_RUNTIME
  ${If} ${FileExists} "$INSTDIR\app\*"
    RMDir /r "$INSTDIR\app"
    DetailPrint "removed the pre-alpha.32 nested program tree (app\)"
  ${EndIf}
!macroend

!macro NSIS_HOOK_POSTUNINSTALL
  ; A nested pre-alpha.32 program tree that an upgrade never cleaned up is
  ; program residue, not data: remove it unconditionally.
  ${If} ${FileExists} "$INSTDIR\app\*"
    RMDir /r "$INSTDIR\app"
  ${EndIf}
  ; A /UPDATE uninstall is the old uninstaller running as part of an upgrade:
  ; the data prompt must not appear, and user data must never be deleted.
  ${If} $UpdateMode <> 1
    MessageBox MB_YESNO|MB_ICONQUESTION|MB_DEFBUTTON2 "是否同时删除 Easel 数据目录？$\n$\n默认在「文档」下的 Easel-dsh；若已在设置里改过位置，按记录的位置删除。$\n$\n其中包含工作区（outputs、项目）和 dsh home（会话、账号画像、凭据）。选择「否」保留数据。" IDNO easel_data_keep
      InitPluginsDir
      FileOpen $0 "$PLUGINSDIR\remove-easel-data.ps1" w
      ; Links first: a junction must lose only its entry, never its target.
      ; The data root comes from the bootstrap pointer the settings page wrote;
      ; the Documents default and the v2/v3 legacy roots stay as fallbacks.
      ; Recursive deletion is limited to directories carrying an Easel marker,
      ; so a malformed pointer cannot turn this into a delete-anything tool.
      FileWrite $0 '$$links = @()$\r$\n'
      FileWrite $0 '$$links += (Join-Path $$env:LOCALAPPDATA $\"Easel$\")$\r$\n'
      FileWrite $0 '$$links += (Join-Path $$env:USERPROFILE $\".easel$\")$\r$\n'
      FileWrite $0 '$$config = Join-Path (Join-Path $$env:LOCALAPPDATA $\"ai.easel.desktop$\") $\"data-root.json$\"$\r$\n'
      FileWrite $0 '$$dataRoot = Join-Path ([Environment]::GetFolderPath($\"MyDocuments$\")) $\"Easel-dsh$\"$\r$\n'
      FileWrite $0 '$$previousRoot = $$null$\r$\n'
      FileWrite $0 'try { $$json = Get-Content -LiteralPath $$config -Raw -ErrorAction Stop | ConvertFrom-Json; if ($$json.dataRoot) { $$dataRoot = $$json.dataRoot }; if ($$json.previousRoot) { $$previousRoot = $$json.previousRoot } } catch { }$\r$\n'
      FileWrite $0 'if ($$dataRoot) { $$links += (Join-Path $$dataRoot $\"home\node_modules$\") }$\r$\n'
      FileWrite $0 '$$links += (Join-Path (Join-Path (Join-Path $$env:LOCALAPPDATA $\"Easel-dsh$\") $\"data$\") $\"home\node_modules$\")$\r$\n'
      FileWrite $0 'if ($$previousRoot) { $$links += $$previousRoot }$\r$\n'
      FileWrite $0 'function Test-EaselRoot([string] $$path) {$\r$\n'
      FileWrite $0 '  if (-not $$path -or -not [IO.Path]::IsPathRooted($$path)) { return $$false }$\r$\n'
      FileWrite $0 '  if ([IO.Path]::GetPathRoot($$path) -eq $$path) { return $$false }$\r$\n'
      FileWrite $0 '  if (-not (Test-Path -LiteralPath $$path)) { return $$false }$\r$\n'
      FileWrite $0 '  $$item = Get-Item -LiteralPath $$path -Force -ErrorAction SilentlyContinue$\r$\n'
      FileWrite $0 '  if (-not $$item -or ($$item.Attributes -band [IO.FileAttributes]::ReparsePoint)) { return $$false }$\r$\n'
      FileWrite $0 '  return (Test-Path -LiteralPath (Join-Path $$path $\".easel-data.json$\")) -or (Test-Path -LiteralPath (Join-Path $$path $\".layout-v2.json$\"))$\r$\n'
      FileWrite $0 '}$\r$\n'
      FileWrite $0 '$$targets = @()$\r$\n'
      FileWrite $0 'if (Test-EaselRoot $$dataRoot) { $$targets += $$dataRoot }$\r$\n'
      FileWrite $0 '$$legacyV2 = Join-Path (Join-Path $$env:LOCALAPPDATA $\"Easel-dsh$\") $\"data$\"$\r$\n'
      FileWrite $0 'if (Test-EaselRoot $$legacyV2) { $$targets += $$legacyV2 }$\r$\n'
      FileWrite $0 '$$legacyV3 = Join-Path $$env:USERPROFILE $\"Easel-dsh$\"$\r$\n'
      FileWrite $0 'if (Test-EaselRoot $$legacyV3) { $$targets += $$legacyV3 }$\r$\n'
      FileWrite $0 'foreach ($$p in ($$links + $$targets)) {$\r$\n'
      FileWrite $0 '  try {$\r$\n'
      FileWrite $0 '    $$item = Get-Item -LiteralPath $$p -Force -ErrorAction Stop$\r$\n'
      FileWrite $0 '    if ($$item.Attributes -band [IO.FileAttributes]::ReparsePoint) { [IO.Directory]::Delete($$p, $$false) }$\r$\n'
      FileWrite $0 '    elseif ($$targets -contains $$p) { Remove-Item -LiteralPath $$p -Recurse -Force }$\r$\n'
      FileWrite $0 '  } catch { }$\r$\n'
      FileWrite $0 '}$\r$\n'
      FileClose $0
      nsExec::ExecToLog 'powershell -NoProfile -ExecutionPolicy Bypass -File "$PLUGINSDIR\remove-easel-data.ps1"'
      Pop $0
    easel_data_keep:
  ${EndIf}
!macroend
