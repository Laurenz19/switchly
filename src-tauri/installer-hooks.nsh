; Hooks for the NSIS installer (bundle.windows.nsis.installerHooks).
;
; Switchly configures git, so it needs Git for Windows. When Git is missing,
; offer to install it with winget, the package manager built into Windows 10
; and 11. If this is skipped or fails, Switchly's Requirements screen offers
; it again at first launch (the MSI, deployed by IT, doesn't ask).

!macro NSIS_HOOK_POSTINSTALL
  Push $0
  Push $1
  nsExec::ExecToStack 'cmd /c where git'
  Pop $0 ; exit code: 0 when git is on the PATH
  Pop $1
  ${If} $0 != 0
  ${AndIfNot} ${FileExists} "$PROGRAMFILES64\Git\cmd\git.exe"
    MessageBox MB_YESNO|MB_ICONQUESTION "Switchly needs Git for Windows, which isn't installed on this PC.$\r$\n$\r$\nInstall it now? The latest version is downloaded with winget, and Windows may ask for administrator permission." /SD IDNO IDNO switchly_skip_git
      DetailPrint "Installing Git for Windows with winget..."
      nsExec::ExecToLog 'winget install --id Git.Git --exact --silent --accept-package-agreements --accept-source-agreements'
      Pop $0
      ${If} $0 != 0
        MessageBox MB_OK|MB_ICONEXCLAMATION "Git couldn't be installed automatically (code $0).$\r$\n$\r$\nSwitchly will offer it again when it starts. You can also get it from https://git-scm.com/download/win" /SD IDOK
      ${EndIf}
    switchly_skip_git:
  ${EndIf}
  Pop $1
  Pop $0
!macroend
