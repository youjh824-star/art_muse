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
echo APK:
dir /b /s "%~dp0\..\android\app\build\outputs\apk\release\*.apk" 2>nul
echo.
echo Install on USB device:
echo   adb install -r android\app\build\outputs\apk\release\app-release.apk
echo.
