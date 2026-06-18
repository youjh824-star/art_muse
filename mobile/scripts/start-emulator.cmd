@echo off
cd /d "%~dp0\.."

echo.
echo [ArtLog] Android Emulator
echo.
echo 1. Android Studio - Device Manager - Start emulator
echo 2. Wait for home screen, then press any key here
pause >nul

echo 3. Do NOT press [a] - open Expo Go manually on emulator
echo.

set EXPO_OFFLINE=1
set EXPO_PUBLIC_WEB_APP_URL=http://10.0.2.2:5174
set REACT_NATIVE_PACKAGER_HOSTNAME=127.0.0.1

for /f "tokens=5" %%p in ('netstat -ano ^| findstr ":8081" ^| findstr "LISTENING"') do taskkill /F /PID %%p >nul 2>&1

npx expo start --localhost --clear --port 8081
