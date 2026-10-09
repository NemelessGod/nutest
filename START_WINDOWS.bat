@echo off
setlocal
cd /d "%~dp0"
if errorlevel 1 goto directory_error

rem Refresh PATH for a standard Node.js installation in this window.
if exist "%ProgramFiles%\nodejs\node.exe" set "PATH=%ProgramFiles%\nodejs;%PATH%"
where node.exe >nul 2>nul
if errorlevel 1 goto missing_node
where npm.cmd >nul 2>nul
if errorlevel 1 goto missing_npm

node -e "const [major,minor]=process.versions.node.split('.').map(Number);process.exit(major>22||(major===22&&minor>=13)?0:1)" >nul 2>nul
if errorlevel 1 goto old_node
if not exist package.json goto directory_error
if exist node_modules goto launch

 echo Installing game dependencies...
call npm.cmd install
if errorlevel 1 goto install_error

:launch
echo.
echo NEON SERPENTS
echo PC browser: http://localhost:5173
echo Android on the same Wi-Fi: use your PC IPv4 address, port 5173.
echo Keep this window open. Press Ctrl+C to stop the game.
echo.
call npm.cmd run dev
set "GAME_EXIT=%errorlevel%"
if not "%GAME_EXIT%"=="0" echo The game stopped with an error. Read the messages above.
pause
exit /b %GAME_EXIT%

:missing_node
echo Node.js was not found.
goto node_help

:missing_npm
echo npm.cmd was not found. Reinstall Node.js with npm included.
goto node_help

:old_node
echo Node.js is too old. This game requires Node.js 22.13 or newer.
goto node_help

:node_help
echo Install Node.js 24 LTS from https://nodejs.org
echo Keep the npm and Add to PATH installer options enabled.
echo After installation, close this window and run START_WINDOWS.bat again.
pause
exit /b 1

:install_error
echo Dependency installation failed. Read the messages above.
echo Check your internet connection and retry START_WINDOWS.bat.
pause
exit /b 1

:directory_error
echo Extract the entire project first, then run START_WINDOWS.bat.
echo The launcher must be in the same folder as package.json.
pause
exit /b 1
