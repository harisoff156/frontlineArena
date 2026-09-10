@echo off
REM ============================================================
REM  FRONTLINE ARENA - пуш проекта в GitHub (Windows)
REM  Использование:  push-to-github.bat ВАШ_ТОКЕН
REM
REM  Токен: GitHub -> Settings -> Developer settings ->
REM         Personal access tokens -> Fine-grained tokens ->
REM         Repository access: harisoff156/frontlineArena ->
REM         Permissions: Contents = Read and write
REM ============================================================
setlocal

set REPO=harisoff156/frontlineArena
set TOKEN=%1

if "%TOKEN%"=="" (
  echo.
  echo   ОШИБКА: не передан токен.
  echo   Запусти так:  push-to-github.bat ВАШ_ТОКЕН
  echo.
  pause
  exit /b 1
)

echo -^> Проверяю git...
if not exist .git (
  echo -^> Инициализирую репозиторий...
  git init -b main -q
  git add -A
  git -c user.name="Frontline Arena" -c user.email="dev@frontline-arena.local" commit -q -m "FRONTLINE ARENA - браузерный командный шутер"
)

echo -^> Подключаю remote...
git remote remove origin 2>nul
git remote add origin "https://%TOKEN%@github.com/%REPO%.git"

echo -^> Отправляю файлы в GitHub...
git push -u origin main --force
if errorlevel 1 (
  echo.
  echo   ПУШ НЕ УДАЛСЯ. Проверь, что токен имеет права Contents: Read and write.
  pause
  exit /b 1
)

git remote set-url origin "https://github.com/%REPO%.git"

echo.
echo   ГОТОВО! Код в репозитории: https://github.com/%REPO%
echo   Не забудь отозвать токен: GitHub -^> Settings -^> Developer settings -^> Tokens
echo.
pause
