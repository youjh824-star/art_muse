@echo off
cd /d "%~dp0.."

echo Clearing Expo / Metro cache...
if exist .expo rmdir /s /q .expo
if exist node_modules\.cache rmdir /s /q node_modules\.cache

for /f "tokens=5" %%p in ('netstat -ano ^| findstr ":8081" ^| findstr "LISTENING"') do taskkill /F /PID %%p >nul 2>&1

echo Done.
echo.
echo USB:  npm run usb
echo Fast: npm run dev:metro   (skip adb if usb hangs)
