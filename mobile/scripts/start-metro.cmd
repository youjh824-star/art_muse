@echo off
cd /d "%~dp0\.."

echo.
echo [ArtLog] Metro (no adb)
echo.

set EXPO_OFFLINE=1
set EXPO_NO_METRO_LAZY=1
set EXPO_PUBLIC_WEB_APP_URL=http://127.0.0.1:5174
set REACT_NATIVE_PACKAGER_HOSTNAME=127.0.0.1

for /f "tokens=5" %%p in ('netstat -ano ^| findstr ":8081" ^| findstr "LISTENING"') do taskkill /F /PID %%p >nul 2>&1

echo Expo Go: exp://127.0.0.1:8081
echo Wait for "Android Bundled" before Reload
echo.

npx expo start --localhost --clear --port 8081
