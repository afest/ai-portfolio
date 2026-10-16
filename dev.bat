@echo off
rem Landing dev server: http://127.0.0.1:5186/ai-portfolio/ (browser opens itself)
cd /d "%~dp0"
call npm run dev -- --open
pause
