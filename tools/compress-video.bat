@echo off
if "%~1"=="" (
  echo Drag a video file onto this .bat file to compress it.
  pause
  exit /b
)
python "%~dp0compress_video.py" %1
