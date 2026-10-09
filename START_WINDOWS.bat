@echo off
chcp 65001 >nul
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Установите Node.js 24 LTS: https://nodejs.org
  pause
  exit /b 1
)
if not exist node_modules (
  call npm install
  if errorlevel 1 (
    pause
    exit /b 1
  )
)
echo.
echo NEON SERPENTS
 echo Браузер на ПК: http://localhost:5173
 echo Телефон в Wi-Fi: http://IP-ВАШЕГО-ПК:5173
 echo Для остановки нажмите Ctrl+C.
call npm run dev
pause
