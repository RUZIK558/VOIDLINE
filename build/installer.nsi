; VOIDLINE per-user installer. Compiles natively on Linux/Windows.
; Uninstaller is written by NSIS on the destination PC, not executed during build.
!include "MUI2.nsh"
!include "LogicLib.nsh"
!include "x64.nsh"
!include "${PROJECT_DIR}/build/windows-files.nsh"
Name "VOIDLINE ${VERSION}"
InstallDir "$LOCALAPPDATA\Programs\VOIDLINE"
InstallDirRegKey HKCU "Software\VOIDLINE" "InstallLocation"
RequestExecutionLevel user
SetCompressor /SOLID lzma
SetOverwrite on
ShowInstDetails show
ShowUninstDetails show
BrandingText "VOIDLINE / Original tactical FPS"
!define MUI_ABORTWARNING
!define MUI_FINISHPAGE_RUN "$INSTDIR\VOIDLINE.exe"
!define MUI_FINISHPAGE_RUN_TEXT "Launch VOIDLINE"
!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_LICENSE "${PROJECT_DIR}/LICENSE"
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH
!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES
!insertmacro MUI_UNPAGE_FINISH
!insertmacro MUI_LANGUAGE "Russian"
!insertmacro MUI_LANGUAGE "English"

Function .onInit
 SetShellVarContext current
 SetRegView 64
 ${IfNot} ${RunningX64}
  MessageBox MB_ICONSTOP "VOIDLINE requires 64-bit Windows."
  Abort
 ${EndIf}
FunctionEnd

Function .onVerifyInstDir
 StrLen $0 $INSTDIR
 ${If} $0 < 8
  Abort
 ${EndIf}
 StrCmp $INSTDIR $PROFILE reject
 StrCmp $INSTDIR $DESKTOP reject
 StrCmp $INSTDIR $DOCUMENTS reject
 Return
 reject:
 Abort
FunctionEnd

Section "VOIDLINE" MainSection
 SetShellVarContext current
 SetRegView 64
 ClearErrors
 !insertmacro InstallVoidlineFiles
 ${If} ${Errors}
  MessageBox MB_ICONSTOP "Installation failed. Close VOIDLINE and try again."
  Abort
 ${EndIf}
 SetOutPath "$INSTDIR"
 FileOpen $0 "$INSTDIR\.voidline-install" w
 FileWrite $0 "${APP_ID}"
 FileClose $0
 WriteUninstaller "$INSTDIR\Uninstall-VOIDLINE.exe"
 CreateDirectory "$SMPROGRAMS\VOIDLINE"
 CreateShortCut "$SMPROGRAMS\VOIDLINE\VOIDLINE.lnk" "$INSTDIR\VOIDLINE.exe"
 CreateShortCut "$SMPROGRAMS\VOIDLINE\Uninstall.lnk" "$INSTDIR\Uninstall-VOIDLINE.exe"
 CreateShortCut "$DESKTOP\VOIDLINE.lnk" "$INSTDIR\VOIDLINE.exe"
 WriteRegStr HKCU "Software\VOIDLINE" "InstallLocation" "$INSTDIR"
 WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\VOIDLINE" "DisplayName" "VOIDLINE"
 WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\VOIDLINE" "DisplayVersion" "${VERSION}"
 WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\VOIDLINE" "Publisher" "VOIDLINE contributors"
 WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\VOIDLINE" "InstallLocation" "$INSTDIR"
 WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\VOIDLINE" "DisplayIcon" "$INSTDIR\VOIDLINE.exe"
 WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\VOIDLINE" "UninstallString" '$\"$INSTDIR\Uninstall-VOIDLINE.exe$\"'
 WriteRegDWORD HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\VOIDLINE" "NoModify" 1
 WriteRegDWORD HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\VOIDLINE" "NoRepair" 1
SectionEnd

Section "Uninstall"
 SetShellVarContext current
 SetRegView 64
 FileOpen $0 "$INSTDIR\.voidline-install" r
 IfErrors invalid
 FileRead $0 $1
 FileClose $0
 StrCmp $1 "${APP_ID}" valid invalid
 invalid:
 MessageBox MB_ICONSTOP "VOIDLINE install marker not found. No files have been removed."
 Abort
 valid:
 !insertmacro RemoveVoidlineFiles
 Delete "$DESKTOP\VOIDLINE.lnk"
 Delete "$SMPROGRAMS\VOIDLINE\VOIDLINE.lnk"
 Delete "$SMPROGRAMS\VOIDLINE\Uninstall.lnk"
 RMDir "$SMPROGRAMS\VOIDLINE"
 DeleteRegKey HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\VOIDLINE"
 DeleteRegKey HKCU "Software\VOIDLINE"
 Delete "$INSTDIR\.voidline-install"
 Delete "$INSTDIR\Uninstall-VOIDLINE.exe"
 RMDir "$INSTDIR"
 ; UserData, profiles, chat history and unrelated files are deliberately untouched.
SectionEnd
