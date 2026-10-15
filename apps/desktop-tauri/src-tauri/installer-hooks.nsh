; Bundled Easel uninstall hook. The dsh installer deploys the Easel content
; tree (skills, plugin source, profile template) under %LOCALAPPDATA%\Easel
; on first launch; user data (outputs/, real profiles, .env) lives in the same
; directory. Ask once at uninstall; the default keeps everything. Machines
; that redirected EASEL_HOME keep that directory (the hook sees only the
; default path).

!macro NSIS_HOOK_POSTUNINSTALL
  MessageBox MB_YESNO|MB_ICONQUESTION|MB_DEFBUTTON2 "是否同时删除 Easel 内容目录？$\n$\n$LOCALAPPDATA\Easel$\n$\n选择「否」保留 Easel 技能与数据（outputs、账号画像）。" IDNO easel_data_keep
    RMDir /r "$LOCALAPPDATA\Easel"
  easel_data_keep:
!macroend
