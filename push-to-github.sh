#!/usr/bin/env bash
# ============================================================
#  FRONTLINE ARENA — пуш проекта в GitHub
#  Использование:  bash push-to-github.sh ВАШ_ТОКЕН
#
#  Токен: GitHub → Settings → Developer settings →
#         Personal access tokens → Fine-grained tokens →
#         Repository access: harisoff156/frontlineArena →
#         Permissions: Contents = Read and write
# ============================================================
set -e

REPO="harisoff156/frontlineArena"
TOKEN="$1"

if [ -z "$TOKEN" ]; then
  echo ""
  echo "  ОШИБКА: не передан токен."
  echo "  Запусти так:  bash push-to-github.sh ВАШ_ТОКЕН"
  echo ""
  exit 1
fi

echo "→ Проверяю git..."
if [ ! -d .git ]; then
  echo "→ Инициализирую репозиторий..."
  git init -b main -q
  git add -A
  git -c user.name="Frontline Arena" -c user.email="dev@frontline-arena.local" commit -q -m "FRONTLINE ARENA — браузерный командный шутер"
fi

echo "→ Подключаю remote https://github.com/$REPO.git ..."
git remote remove origin 2>/dev/null || true
git remote add origin "https://$TOKEN@github.com/$REPO.git"

echo "→ Отправляю файлы в GitHub..."
git push -u origin main --force

echo "→ Восстанавливаю remote без токена (чтобы он не хранился в .git/config)..."
git remote set-url origin "https://github.com/$REPO.git"

echo ""
echo "  ГОТОВО! Код в репозитории: https://github.com/$REPO"
echo ""
echo "  Не забудь отозвать токен после пуша:"
echo "  GitHub → Settings → Developer settings → Personal access tokens → Revoke"
echo ""
