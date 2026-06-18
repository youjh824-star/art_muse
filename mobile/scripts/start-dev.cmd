@echo off
cd /d "%~dp0.."

echo.
echo [ArtLog] Expo LAN (Wi-Fi)
echo.

for /f "tokens=5" %%p in ('netstat -ano ^| findstr ":8081" ^| findstr "LISTENING"') do (
  echo Stopping old Metro PID %%p ...
  taskkill /F /PID %%p >nul 2>&1
)

echo Starting Metro in new window...
start "ArtLog Metro" cmd /k "cd /d %cd% && set EXPO_OFFLINE=1 && set EXPO_NO_METRO_LAZY=1 && npx expo start --lan --clear --port 8081"

echo Waiting for Metro (10 sec)...
timeout /t 10 /nobreak >nul

echo Warming bundle cache (~30 sec first time)...
curl.exe -s -o NUL -w "Bundle HTTP %%{http_code}\n" "http://127.0.0.1:8081/index.bundle?platform=android&dev=true&minify=false"

echo.
echo === Phone ===
echo Expo Go URL: exp://10.192.15.253:8081
echo Bundle test: wait 30-60 sec if loading
echo.
echo USB failsafe: npm run mobile:usb
echo.
