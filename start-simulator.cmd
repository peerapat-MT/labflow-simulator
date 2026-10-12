@echo off
cd /d "%~dp0"
echo LabFlow Simulator
echo Open http://127.0.0.1:4173 in your browser.
echo Keep this window open. Press Ctrl+C to stop.
node scripts\serve.mjs
pause
