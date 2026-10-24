; Keep the program-local PDF library during both updates and uninstall.
; Preserve electron-builder's atomic move/restore behavior for installed binaries.
!macro customRemoveFiles
  SetOutPath $TEMP
  Push $R0
  Push $R1
  Push $R2
  Push $R6
  Push $R7
  ${if} ${isUpdated}
    CreateDirectory "$PLUGINSDIR\old-install"
  ${endif}
  FindFirst $R6 $R7 "$INSTDIR\*.*"
  lithub_remove_loop:
    StrCmp $R7 "" lithub_remove_done
    StrCmp $R7 "." lithub_remove_next
    StrCmp $R7 ".." lithub_remove_next
    StrCmp $R7 "pdfs" lithub_remove_next
    IfFileExists "$INSTDIR\$R7\*.*" lithub_remove_dir lithub_remove_file
  lithub_remove_dir:
    ${if} ${isUpdated}
      CreateDirectory "$PLUGINSDIR\old-install\$R7"
      Push "\$R7"
      Call un.atomicRMDir
      Pop $R0
      StrCmp $R0 "0" 0 lithub_remove_restore
    ${endif}
    RMDir /r "$INSTDIR\$R7"
    Goto lithub_remove_next
  lithub_remove_file:
    ${if} ${isUpdated}
      ClearErrors
      Rename "$INSTDIR\$R7" "$PLUGINSDIR\old-install\$R7"
      StrCmp $R7 "${UNINSTALL_FILENAME}" 0 +2
      ClearErrors
      IfErrors lithub_remove_restore
    ${else}
      Delete "$INSTDIR\$R7"
    ${endif}
  lithub_remove_next:
    FindNext $R6 $R7
    Goto lithub_remove_loop
  lithub_remove_restore:
    FindClose $R6
    Push ""
    Call un.restoreFiles
    Pop $R0
    Abort "Cannot replace application files. Your PDF library has been preserved."
  lithub_remove_done:
    FindClose $R6
    ; Non-recursive removal succeeds only if there is no preserved PDF library.
    RMDir "$INSTDIR"
  Pop $R7
  Pop $R6
  Pop $R2
  Pop $R1
  Pop $R0
!macroend
