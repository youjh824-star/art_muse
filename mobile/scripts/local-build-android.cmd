@echo off
setlocal EnableExtensions

cd /d "%~dp0\.."

set "VARIANT=%~1"
set "V2_FLAG=%~2"
if "%VARIANT%"=="" set "VARIANT=admin"
if /I "%VARIANT%"=="--clean" (
  set "CLEAN=1"
  set "VARIANT=%~2"
  set "V2_FLAG=%~3"
)
if "%VARIANT%"=="" set "VARIANT=admin"
if /I not "%VARIANT%"=="admin" if /I not "%VARIANT%"=="parent" (
  echo Usage: scripts\local-build-android.cmd [admin^|parent] [v2] [--clean]
  exit /b 1
)
if /I "%V2_FLAG%"=="v2" set "APP_V2=1"
if /I "%V2_FLAG%"=="--clean" set "CLEAN=1"
if /I "%~3"=="--clean" set "CLEAN=1"

rem Switching admin/parent requires regenerating android/
if not defined CLEAN (
  if exist "android\app\build.gradle" (
    findstr /C:"applicationId 'kr.artmuse.artlog.%VARIANT%'" android\app\build.gradle >nul
    if errorlevel 1 set "CLEAN=1"
  )
)

call "%~dp0setup-android-env.cmd"
if errorlevel 1 exit /b 1

set "JAVA_HOME=C:\Program Files\Android\Android Studio\jbr"
set "ANDROID_HOME=%LOCALAPPDATA%\Android\Sdk"
set "ANDROID_SDK_ROOT=%ANDROID_HOME%"
set "Path=%JAVA_HOME%\bin;%ANDROID_HOME%\platform-tools;%ANDROID_HOME%\emulator;%Path%"

echo.
echo [ArtLog] Local Android APK build ^(%VARIANT%^)
echo.

if defined APP_V2 (
  echo [1/4] Bundle embedded web ^(%VARIANT% v2^)...
  call npm.cmd run bundle:web:%VARIANT%:v2
) else (
  echo [1/4] Bundle embedded web ^(%VARIANT%^)...
  call npm.cmd run bundle:web:%VARIANT%
)
if errorlevel 1 (
  echo ERROR: web bundle failed
  exit /b 1
)

rem Always copy web bundle into android assets (even when skipping prebuild)
set "WEB_SRC=%~dp0\..\embedded-web-%VARIANT%"
set "WEB_DST=%~dp0\..\android\app\src\main\assets\web"
if exist "%WEB_DST%" rd /s /q "%WEB_DST%"
xcopy /E /I /Q "%WEB_SRC%" "%WEB_DST%" >nul
echo [1b/4] Web assets copied to android/app/src/main/assets/web

set "USE_EMBEDDED_WEB=1"
set "APP_VARIANT=%VARIANT%"
set "EXPO_NO_METRO_LAZY=1"
set "NODE_ENV=production"

echo.
echo [2/4] Generate native android project...
if "%CLEAN%"=="1" (
  call npx.cmd expo prebuild --platform android --clean
) else (
  if not exist "android\gradlew.bat" (
    echo android/ not found - running prebuild once...
    call npx.cmd expo prebuild --platform android
  ) else (
    echo Reusing android/ ^(skip prebuild; use --clean to regenerate^)
  )
)
if errorlevel 1 (
  echo ERROR: prebuild failed
  exit /b 1
)

echo.
echo [3/4] Build release APK ^(Gradle^)...
call "%~dp0\..\android\gradlew.bat" -p "%~dp0\..\android" assembleRelease
set "BUILD_CODE=%ERRORLEVEL%"

if not "%BUILD_CODE%"=="0" (
  echo ERROR: Gradle build failed
  exit /b %BUILD_CODE%
)

echo.
echo [4/4] Done.

set "APK_SRC=%~dp0\..\android\app\build\outputs\apk\release\app-release.apk"
set "APK_DEST=%USERPROFILE%\Desktop\app-%VARIANT%.apk"
copy /Y "%APK_SRC%" "%APK_DEST%" >nul
echo APK saved to: %APK_DEST%
echo.
echo Install on USB device:
echo   adb install -r "%APK_DEST%"
echo.

echo [5/4] Uploading APK to GitHub Releases...
rem Locate GitHub CLI (including winget path)
set "GH_EXE="
where gh >nul 2>&1 && set "GH_EXE=gh"
if not defined GH_EXE if exist "C:\Program Files\GitHub CLI\gh.exe" set "GH_EXE=C:\Program Files\GitHub CLI\gh.exe"
if not defined GH_EXE if exist "%LOCALAPPDATA%\Programs\GitHub CLI\gh.exe" set "GH_EXE=%LOCALAPPDATA%\Programs\GitHub CLI\gh.exe"
if not defined GH_EXE (
  echo WARNING: gh CLI not found, skipping GitHub upload.
  echo          Install from https://cli.github.com and run: gh auth login
  goto :end
)
"%GH_EXE%" auth status >nul 2>&1
if errorlevel 1 (
  echo WARNING: gh not logged in. Run: gh auth login
  goto :end
)

rem Keep stable APK asset name per variant (matches landing links)
set "RELEASE_APK_NAME=app-%VARIANT%.apk"
set "RELEASE_TAG=latest-release"
set "REPO=youjh824-star/art_muse"
set "CURRENT_LABEL="
set "RELEASE_VERSION=v1.0.0"

rem Read current asset label and bump patch version (v1.0.x)
for /f "usebackq delims=" %%V in (`powershell -NoProfile -Command "$j=& '%GH_EXE%' release view %RELEASE_TAG% --repo %REPO% --json assets 2>$null | ConvertFrom-Json; $a=$j.assets | Where-Object { $_.name -eq '%RELEASE_APK_NAME%' } | Select-Object -First 1; if($a){$a.label}"`) do set "CURRENT_LABEL=%%V"
if defined CURRENT_LABEL (
  for /f "usebackq delims=" %%V in (`powershell -NoProfile -Command "$label='%CURRENT_LABEL%'; if($label -match 'v1\.0\.(\d+)'){ 'v1.0.' + ([int]$Matches[1] + 1) } else { 'v1.0.0' }"`) do set "RELEASE_VERSION=%%V"
)
set "RELEASE_ASSET_LABEL=%RELEASE_VERSION%"
echo [Release] %RELEASE_APK_NAME% label: %RELEASE_ASSET_LABEL%

rem 릴리즈가 없으면 생성, 있으면 해당 APK만 덮어쓰기 (다른 variant APK 유지)
"%GH_EXE%" release view %RELEASE_TAG% --repo %REPO% >nul 2>&1
if errorlevel 1 (
  rem 릴리즈 없음 - 새로 생성
  "%GH_EXE%" release create %RELEASE_TAG% "%APK_DEST%#%RELEASE_ASSET_LABEL%" ^
    --repo %REPO% ^
    --title "최신 버전 (%RELEASE_VERSION%)" ^
    --notes "자동 업로드 - %RELEASE_APK_NAME% %RELEASE_VERSION%" ^
    --latest
) else (
  rem 릴리즈 있음 - 이 variant APK만 업데이트 (다른 APK 유지)
  "%GH_EXE%" release upload %RELEASE_TAG% "%APK_DEST%#%RELEASE_ASSET_LABEL%" --repo %REPO% --clobber
)

if errorlevel 1 (
  echo WARNING: GitHub upload failed. APK is saved locally at %APK_DEST%
) else (
  echo GitHub Release upload complete!
  echo Download URL: https://github.com/%REPO%/releases/latest/download/%RELEASE_APK_NAME%
)
echo.

:end
