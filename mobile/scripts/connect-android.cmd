@echo off
cd /d "%~dp0\.."

set "ADB=%LOCALAPPDATA%\Android\Sdk\platform-tools\adb.exe"

echo.
echo [ArtLog] Android USB
echo.

if not exist "%ADB%" (
  echo ERROR: adb not found - use: npm run dev:metro
  pause
  exit /b 1
)

echo [1/3] Port forward...
start /B "" "%ADB%" reverse tcp:8081 tcp:8081
start /B "" "%ADB%" reverse tcp:5174 tcp:5174
ping 127.0.0.1 -n 2 >nul

echo [2/3] Device (optional)...
start /B "" cmd /c ""%ADB%" devices"

echo [3/3] Start Metro...
echo Expo Go: exp://127.0.0.1:8081
echo Do NOT press [a]
echo Wait for "Android Bundled" before Reload
echo.

set EXPO_OFFLINE=1
set EXPO_NO_METRO_LAZY=1
set EXPO_PUBLIC_WEB_APP_URL=http://127.0.0.1:5174
set REACT_NATIVE_PACKAGER_HOSTNAME=127.0.0.1

for /f "tokens=5" %%p in ('netstat -ano ^| findstr ":8081" ^| findstr "LISTENING"') do taskkill /F /PID %%p >nul 2>&1

npx expo start --localhost --clear --port 8081
