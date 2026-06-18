@echo off
setlocal EnableExtensions

echo.
echo [ArtLog] Android build environment check
echo.

set "STUDIO=C:\Program Files\Android\Android Studio"
set "JBR=%STUDIO%\jbr"
set "SDK=%LOCALAPPDATA%\Android\Sdk"
set "ADB=%SDK%\platform-tools\adb.exe"

set "OK=1"

if exist "%STUDIO%" (
  echo [OK] Android Studio: %STUDIO%
) else (
  echo [MISSING] Android Studio not found at %STUDIO%
  echo         Install: https://developer.android.com/studio
  set "OK=0"
)

if exist "%JBR%\bin\java.exe" (
  echo [OK] JDK ^(Android Studio JBR^):
  "%JBR%\bin\java.exe" -version 2>&1
) else (
  echo [MISSING] JDK not found at %JBR%
  set "OK=0"
)

if exist "%SDK%" (
  echo [OK] Android SDK: %SDK%
) else (
  echo [MISSING] Android SDK not found at %SDK%
  echo         Open Android Studio - Settings - Languages and Frameworks - Android SDK
  set "OK=0"
)

if exist "%ADB%" (
  echo [OK] adb: %ADB%
) else (
  echo [MISSING] adb not found
  echo         Install "Android SDK Platform-Tools" in SDK Manager
  set "OK=0"
)

if defined ANDROID_HOME (
  echo [OK] ANDROID_HOME=%ANDROID_HOME%
) else (
  echo [WARN] ANDROID_HOME is not set ^(required for Gradle builds^)
  echo        Suggested: setx ANDROID_HOME "%SDK%"
)

if defined JAVA_HOME (
  echo [OK] JAVA_HOME=%JAVA_HOME%
) else (
  echo [WARN] JAVA_HOME is not set ^(required for Gradle builds^)
  echo        Suggested: setx JAVA_HOME "%JBR%"
)

where java >nul 2>&1
if errorlevel 1 (
  echo [WARN] java is not on PATH
) else (
  echo [OK] java on PATH
  java -version 2>&1
)

if exist "%SDK%\licenses\android-sdk-license" (
  echo [OK] SDK license accepted
) else (
  echo [WARN] SDK license may not be accepted
  echo        Run: "%SDK%\cmdline-tools\latest\bin\sdkmanager.bat" --licenses
)

echo.
echo SDK platforms:
if exist "%SDK%\platforms" dir /b "%SDK%\platforms" 2>nul

echo.
echo SDK build-tools:
if exist "%SDK%\build-tools" dir /b "%SDK%\build-tools" 2>nul

echo.
echo Connected devices:
if exist "%ADB%" (
  "%ADB%" devices
) else (
  echo   ^(adb missing^)
)

echo.
if "%OK%"=="1" (
  echo Result: core tools are installed.
  echo Next: run scripts\setup-android-env.cmd in this terminal, then scripts\local-build-android.cmd admin
) else (
  echo Result: install missing items above, then run this script again.
)
echo.
pause
