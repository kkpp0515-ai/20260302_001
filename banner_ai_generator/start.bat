@echo off
echo Ad Banner AI Generator を起動します...
echo.

pip install -r requirements.txt --quiet

echo.
echo サーバーを起動中... http://localhost:5050 を開いてください
echo 終了するには Ctrl+C を押してください
echo.
python app.py
pause
