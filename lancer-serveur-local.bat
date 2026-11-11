@echo off
cd /d "%~dp0"
echo Serveur local du site : http://localhost:8765
echo Laisse cette fenetre ouverte. Ferme-la pour arreter.
npx --yes http-server . -p 8765 -c-1 -a 127.0.0.1
pause
