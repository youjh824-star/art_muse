@echo off
cd /d "%~dp0.."

echo Adding firewall rules (Private + Public)...

netsh advfirewall firewall delete rule name="ArtLog Expo Metro" >nul 2>&1
netsh advfirewall firewall delete rule name="ArtLog Expo Metro Public" >nul 2>&1
netsh advfirewall firewall delete rule name="ArtLog Vite Dev" >nul 2>&1
netsh advfirewall firewall delete rule name="ArtLog Vite Dev Public" >nul 2>&1

netsh advfirewall firewall add rule name="ArtLog Expo Metro" dir=in action=allow protocol=TCP localport=8081-8082 profile=private
netsh advfirewall firewall add rule name="ArtLog Expo Metro Public" dir=in action=allow protocol=TCP localport=8081-8082 profile=public
netsh advfirewall firewall add rule name="ArtLog Vite Dev" dir=in action=allow protocol=TCP localport=5173-5174 profile=private
netsh advfirewall firewall add rule name="ArtLog Vite Dev Public" dir=in action=allow protocol=TCP localport=5173-5174 profile=public

where node >nul 2>&1
if %errorlevel%==0 (
  for /f "delims=" %%i in ('where node') do (
    netsh advfirewall firewall delete rule name="ArtLog Node.js" >nul 2>&1
    netsh advfirewall firewall add rule name="ArtLog Node.js" dir=in action=allow program="%%i" enable=yes profile=any
    goto :done
  )
)
:done
echo Done.

echo.
echo Tip: Set Wi-Fi network to Private in Windows Settings ^> Network.
