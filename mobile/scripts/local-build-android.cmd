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
where gh >nul 2>&1
if errorlevel 1 (
  echo WARNING: gh CLI not found, skipping GitHub upload.
  echo          Install from https://cli.github.com and run: gh auth login
  goto :end
)
gh auth status >nul 2>&1
if errorlevel 1 (
  echo WARNING: gh not logged in. Run: gh auth login
  goto :end
)

rem APK 파일명을 variant별로 고정 (랜딩페이지 링크와 일치)
set "RELEASE_APK_NAME=app-%VARIANT%.apk"
set "RELEASE_TAG=latest-release"
set "REPO=youjh824-star/art_muse"

rem 기존 latest-release 태그 삭제 후 재생성 (항상 최신 유지)
gh release delete %RELEASE_TAG% --repo %REPO% --yes >nul 2>&1
git tag -d %RELEASE_TAG% >nul 2>&1
git push origin :refs/tags/%RELEASE_TAG% >nul 2>&1

gh release create %RELEASE_TAG% "%APK_DEST%#%RELEASE_APK_NAME%" ^
  --repo %REPO% ^
  --title "최신 버전" ^
  --notes "자동 업로드 - %VARIANT% APK" ^
  --latest

if errorlevel 1 (
  echo WARNING: GitHub upload failed. APK is saved locally at %APK_DEST%
) else (
  echo GitHub Release upload complete!
  echo Download URL: https://github.com/%REPO%/releases/latest/download/%RELEASE_APK_NAME%
)
echo.

:end
