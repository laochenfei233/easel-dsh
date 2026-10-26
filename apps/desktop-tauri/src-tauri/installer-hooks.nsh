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
; Uninstalling keeps user data. Deletion runs only when the confirm page's
; stock "delete application data" checkbox is ticked, which silent and
; /UPDATE uninstalls never reach; the checkbox starts unchecked.
;
; The shell is tray-resident and spawns the dsh web server from its runtime
; directory. Tauri's CheckIfAppIsRunning only terminates the shell binary; a
; forced kill never runs RunEvent::Exit, so the node child keeps serving from
; the install directory and locks runtime\ against the next upgrade, and
; Windows keeps the shell's tray icon as a ghost entry until the user hovers
; it. The stop below therefore asks each running shell to exit through the
; `--quit` single-instance channel first (`app.exit` removes the tray icon),
; and only force-kills what is still alive after the grace period (an older
; shell that does not know the flag, or a hung one), then every process whose
; executable lives under runtime\ — the flat root and the pre-alpha.32 app\
; subtree alike. Matches are by executable path, never by image name, so other
; node applications are untouched.

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
  FileWrite $0 '  if (-not (Test-Path -LiteralPath $$s)) { continue }$\r$\n'
  FileWrite $0 '  $$running = @(Get-CimInstance Win32_Process | Where-Object { $$_.ExecutablePath -and $$_.ExecutablePath -ieq $$s })$\r$\n'
  FileWrite $0 '  if ($$running.Count -gt 0) {$\r$\n'
  FileWrite $0 '    try { Start-Process -FilePath $$s -ArgumentList $\"--quit$\" -WindowStyle Hidden -ErrorAction Stop } catch { }$\r$\n'
  FileWrite $0 '    for ($$i = 0; $$i -lt 16; $$i++) {$\r$\n'
  FileWrite $0 '      if (@(Get-CimInstance Win32_Process | Where-Object { $$_.ExecutablePath -and $$_.ExecutablePath -ieq $$s }).Count -eq 0) { break }$\r$\n'
  FileWrite $0 '      Start-Sleep -Milliseconds 250$\r$\n'
  FileWrite $0 '    }$\r$\n'
  FileWrite $0 '  }$\r$\n'
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
  ; Data is deleted only on explicit consent, and the stock section removes
  ; %LOCALAPPDATA%\ai.easel.desktop — the data-root pointer — before
  ; POSTUNINSTALL runs. Keep a copy now so a moved data root is still found.
  ${If} $UpdateMode <> 1
  ${AndIf} $DeleteAppDataCheckboxState = 1
    InitPluginsDir
    CopyFiles /SILENT "$LOCALAPPDATA\ai.easel.desktop\data-root.json" "$PLUGINSDIR\data-root.json"
  ${EndIf}
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
  ; Data survives unless the uninstaller's confirm-page checkbox was ticked.
  ; That page is skipped for /UPDATE (an upgrade must never delete data) and
  ; for passive runs, so an unattended or silent uninstall keeps everything.
  ; The checkbox is the stock Tauri one, created unchecked.
  ${If} $UpdateMode <> 1
  ${AndIf} $DeleteAppDataCheckboxState = 1
      InitPluginsDir
      FileOpen $0 "$PLUGINSDIR\remove-easel-data.ps1" w
      ; Links first: a junction must lose only its entry, never its target.
      ; The data root comes from the bootstrap pointer the settings page wrote
      ; (or the copy PREUNINSTALL kept), with the Documents default and the
      ; v2/v3 legacy roots as fallbacks. Recursive deletion is limited to
      ; directories carrying an Easel marker, so a malformed pointer cannot
      ; turn this into a delete-anything tool.
      FileWrite $0 '$$links = @()$\r$\n'
      FileWrite $0 '$$links += (Join-Path $$env:LOCALAPPDATA $\"Easel$\")$\r$\n'
      FileWrite $0 '$$links += (Join-Path $$env:USERPROFILE $\".easel$\")$\r$\n'
      FileWrite $0 '$$config = Join-Path (Join-Path $$env:LOCALAPPDATA $\"ai.easel.desktop$\") $\"data-root.json$\"$\r$\n'
      FileWrite $0 'if (-not (Test-Path -LiteralPath $$config)) { $$config = $\"$PLUGINSDIR\data-root.json$\" }$\r$\n'
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
      FileWrite $0 '  if ((Test-Path -LiteralPath (Join-Path $$path $\".easel-data.json$\")) -or (Test-Path -LiteralPath (Join-Path $$path $\".layout-v2.json$\"))) { return $$true }$\r$\n'
      FileWrite $0 '  return (Test-Path -LiteralPath (Join-Path $$path $\"home$\")) -and (Test-Path -LiteralPath (Join-Path $$path $\"workspace$\"))$\r$\n'
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
  ${EndIf}
!macroend
