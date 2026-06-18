@echo off
setlocal EnableExtensions

set "STUDIO=C:\Program Files\Android\Android Studio"
set "JBR=%STUDIO%\jbr"
set "SDK=%LOCALAPPDATA%\Android\Sdk"

if not exist "%JBR%\bin\java.exe" (
  echo ERROR: JDK not found at %JBR%
  echo Install Android Studio first.
  exit /b 1
)

if not exist "%SDK%" (
  echo ERROR: Android SDK not found at %SDK%
  echo Open Android Studio - SDK Manager and install Android SDK.
  exit /b 1
)

set "JAVA_HOME=%JBR%"
set "ANDROID_HOME=%SDK%"
set "ANDROID_SDK_ROOT=%SDK%"
set "Path=%JAVA_HOME%\bin;%ANDROID_HOME%\platform-tools;%ANDROID_HOME%\emulator;%Path%"

echo.
echo [ArtLog] Android env set for THIS terminal session:
echo   JAVA_HOME=%JAVA_HOME%
echo   ANDROID_HOME=%ANDROID_HOME%
echo.

echo To persist for new terminals ^(run once in PowerShell or CMD as yourself^):
echo   setx JAVA_HOME "%JBR%"
echo   setx ANDROID_HOME "%SDK%"
echo   setx ANDROID_SDK_ROOT "%SDK%"
echo.
echo Then add to Windows PATH ^(Settings - System - About - Advanced system settings^):
echo   %%JAVA_HOME%%\bin
echo   %%ANDROID_HOME%%\platform-tools
echo   %%ANDROID_HOME%%\emulator
echo.

java -version 2>&1
adb version 2>&1
