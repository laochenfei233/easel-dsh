; Bundled Easel installer/uninstaller hooks.
;
; Layout contract (easel-dsh-layout): the program lives in
; %LOCALAPPDATA%\Easel-dsh\app, user data in the sibling data\ directory.
; Pre-layout installs kept the program at %LOCALAPPDATA%\Easel-dsh and data in
; %LOCALAPPDATA%\Easel + %USERPROFILE%\.easel; both roots are still cleaned
; here during the one-time migration.
;
; The shell is tray-resident and spawns the dsh web server from its runtime
; directory. Tauri's CheckIfAppIsRunning only terminates the shell binary; a
; forced kill never runs RunEvent::Exit, so the node child keeps serving from
; the install directory and locks runtime\ against the next upgrade. Stop the
; shell first (its supervisor would otherwise respawn the child), then every
; process whose executable lives under runtime\. Matches are by executable
; path, never by image name, so other node applications are untouched.

!macro EASEL_STOP_RUNTIME
  InitPluginsDir
  FileOpen $0 "$PLUGINSDIR\stop-easel.ps1" w
  FileWrite $0 '$$roots = @($\"$INSTDIR$\")$\r$\n'
  FileWrite $0 '$$legacy = $\"$LOCALAPPDATA\Easel-dsh$\"$\r$\n'
  FileWrite $0 'if ($$legacy -ne $$INSTDIR) { $$roots += $$legacy }$\r$\n'
  FileWrite $0 'foreach ($$root in $$roots) {$\r$\n'
  FileWrite $0 '  $$shell = Join-Path $$root $\"dsh-desktop.exe$\"$\r$\n'
  FileWrite $0 '  $$runtime = (Join-Path $$root $\"runtime$\") + [IO.Path]::DirectorySeparatorChar$\r$\n'
  FileWrite $0 '  Get-CimInstance Win32_Process | Where-Object { $$_.ExecutablePath -eq $$shell } | ForEach-Object { Stop-Process -Id $$_.ProcessId -Force -ErrorAction SilentlyContinue }$\r$\n'
  FileWrite $0 '  Start-Sleep -Milliseconds 400$\r$\n'
  FileWrite $0 '  for ($$i = 0; $$i -lt 2; $$i++) {$\r$\n'
  FileWrite $0 '    Get-CimInstance Win32_Process | Where-Object { $$_.ExecutablePath -and $$_.ExecutablePath.StartsWith($$runtime, [StringComparison]::OrdinalIgnoreCase) } | ForEach-Object { Stop-Process -Id $$_.ProcessId -Force -ErrorAction SilentlyContinue }$\r$\n'
  FileWrite $0 '    Start-Sleep -Milliseconds 200$\r$\n'
  FileWrite $0 '  }$\r$\n'
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
  ; Remove the pre-layout program files from the parent directory. The new
  ; install root is ...\app; the stale root uninstaller must not survive,
  ; because its POSTUNINSTALL hook deletes the legacy %LOCALAPPDATA%\Easel
  ; path recursively, which after migration is a junction into data\.
  ${If} $INSTDIR != "$LOCALAPPDATA\Easel-dsh"
    Delete "$LOCALAPPDATA\Easel-dsh\dsh-desktop.exe"
    Delete "$LOCALAPPDATA\Easel-dsh\uninstall.exe"
    RMDir /r "$LOCALAPPDATA\Easel-dsh\runtime"
  ${EndIf}
!macroend

!macro NSIS_HOOK_POSTUNINSTALL
  ; A /UPDATE uninstall is the old uninstaller running as part of an upgrade:
  ; the data prompt must not appear, and user data must never be deleted.
  ${If} $UpdateMode <> 1
    MessageBox MB_YESNO|MB_ICONQUESTION|MB_DEFBUTTON2 "是否同时删除 Easel 数据目录？$\n$\n$LOCALAPPDATA\Easel-dsh\data$\n$\n其中包含工作区（outputs、项目）和 dsh home（会话、账号画像、凭据）。选择「否」保留数据。" IDNO easel_data_keep
      InitPluginsDir
      FileOpen $0 "$PLUGINSDIR\remove-easel-data.ps1" w
      FileWrite $0 '$$targets = @($\"$LOCALAPPDATA\Easel$\", $\"$USERPROFILE\.easel$\", $\"$LOCALAPPDATA\Easel-dsh\data$\")$\r$\n'
      FileWrite $0 'foreach ($$p in $$targets) {$\r$\n'
      FileWrite $0 '  try {$\r$\n'
      FileWrite $0 '    $$item = Get-Item -LiteralPath $$p -Force -ErrorAction Stop$\r$\n'
      FileWrite $0 '    if ($$item.Attributes -band [IO.FileAttributes]::ReparsePoint) { [IO.Directory]::Delete($$p, $$false) }$\r$\n'
      FileWrite $0 '    else { Remove-Item -LiteralPath $$p -Recurse -Force }$\r$\n'
      FileWrite $0 '  } catch { }$\r$\n'
      FileWrite $0 '}$\r$\n'
      FileClose $0
      nsExec::ExecToLog 'powershell -NoProfile -ExecutionPolicy Bypass -File "$PLUGINSDIR\remove-easel-data.ps1"'
      Pop $0
    easel_data_keep:
  ${EndIf}
!macroend
