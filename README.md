# FRONTLINE ARENA

Командный браузерный шутер: 5 карт, 20 видов оружия, 4 режима, рейтинг, кооператив с ИИ-отрядом, глобальный лидерборд.

- **Стек:** Next.js 16 (App Router) + React 19 + TypeScript + Canvas 2D движок + PostgreSQL (Drizzle ORM)
- **Игра работает полностью на клиенте** — матчи симулируются в браузере, сервер нужен только для раздачи страниц и лидерборда.

---

## 1. Быстрый деплой в интернет (рекомендуется, ~15 минут, бесплатно)

### Шаг 1. Залейте код на GitHub
```bash
git init && git add -A && git commit -m "frontline arena"
git remote add origin https://github.com/ВАШ_ЛОГИН/frontline-arena.git
git push -u origin main
```

### Шаг 2. Бесплатная PostgreSQL (для мирового лидерборда)
1. Зарегистрируйтесь на **https://neon.tech** (или supabase.com).
2. Создайте проект → скопируйте строку подключения вида
   `postgresql://user:pass@ep-xxxx.eu-central-1.aws.neon.tech/dbname?sslmode=require`
3. Создайте таблицу лидерборда — в SQL-редакторе Neon выполните:
```sql
CREATE TABLE IF NOT EXISTS leaderboard (
  id serial PRIMARY KEY,
  name text NOT NULL,
  mode text NOT NULL,
  map text NOT NULL,
  kills integer NOT NULL,
  score integer NOT NULL,
  rating integer NOT NULL DEFAULT 1000,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS leaderboard_score_idx ON leaderboard (score);
```

### Шаг 3. Деплой на Vercel
1. **https://vercel.com** → Sign up через GitHub → **Add New Project** → импортируйте репозиторий.
2. В настройках проекта добавьте переменные окружения (**Environment Variables**):
   - `DATABASE_URL` = строка подключения из шага 2
   - `DATABASE_SSL` = `true`
3. Нажмите **Deploy**. Через ~2 минуты получите публичный URL `https://your-game.vercel.app`.
4. Свой домен: Vercel → Project → Settings → Domains (бесплатный `*.vercel.app` тоже работает).

> Каждый `git push` в main будет автоматически передеплоивать игру.

---

## 2. Деплой на свой VPS (Docker, для любого хостинга: Timeweb, Selectel, Hetzner...)

В репозитории уже есть `Dockerfile` и `docker-compose.yml` (приложение + PostgreSQL в одном стеке).

```bash
# на сервере (Ubuntu, установлен docker + docker compose plugin)
git clone https://github.com/ВАШ_ЛОГИН/frontline-arena.git
cd frontline-arena
docker compose up -d --build

# создать таблицу лидерборда
docker compose exec db psql -U postgres -d frontline -c \
"CREATE TABLE IF NOT EXISTS leaderboard (id serial PRIMARY KEY, name text NOT NULL, mode text NOT NULL, map text NOT NULL, kills integer NOT NULL, score integer NOT NULL, rating integer NOT NULL DEFAULT 1000, created_at timestamptz NOT NULL DEFAULT now()); CREATE INDEX IF NOT EXISTS leaderboard_score_idx ON leaderboard (score);"
```

Игра будет на `http://IP_СЕРВЕРА:3000`. Для домена и HTTPS поставьте перед ней **nginx + certbot** или **Caddy** (две строчки конфига).

Вариант без Docker:
```bash
npm ci && npm run build
DATABASE_URL="postgresql://..." npx drizzle-kit push   # создать таблицы
npm run start   # слушает :3000, держите через pm2:  pm2 start npm -- start
```

---

## 3. Как сделать игру людей друг против друга (реальный мультиплеер)

Сейчас каждый игрок играет **локально в своём браузере против умных ИИ-ботов** (в т.ч. кооператив с отрядом-ИИ). Чтобы реальные люди оказались в одном матче, нужен сетевой слой:

**Архитектура:**
1. **Авторитетный игровой сервер** на Node.js с WebSocket (Socket.IO / `ws`) — тот же TypeScript-класс `Game` из `src/game/engine.ts` можно запускать «без головы» (без canvas) на сервере с тиком 30–60 Гц.
2. **Комнаты/лобби**: код комнаты из 4–6 символов, команды, выбор карты/режима хостом.
3. **Протокол**: клиент шлёт только ввод (движение, прицел, выстрелы) ~30 раз/сек → сервер симулирует мир → рассылает снапшоты состояния 20–30 раз/сек.
4. **Клиент**: интерполяция чужих бойцов (буфер ~100 мс), предикция своего движения + реконсиляция по снапшотам сервера.
5. **Античит**: сервер сам проверяет попадания, урон и скорость — клиенту не доверяем.

**Куда это деплоить:** Vercel (serverless) не держит WebSocket-соединения — игровой сервер поднимается отдельно на VPS / Render / Fly.io; сайт с игрой может остаться на Vercel и подключаться к `wss://game.вашдомен.ru`.

**Простая альтернатива:** модель «хост-игрок» через WebRTC — один из игроков раздаёт мир остальным, сервер не нужен, но античита нет.

---

## Локальная разработка

```bash
npm ci
npm run dev        # http://localhost:3000
npx drizzle-kit push   # применить схему БД (требует DATABASE_URL)
```

| Команда | Назначение |
|---|---|
| `npm run build` | продакшн-сборка |
| `npm run start` | запуск продакшн-сервера |
| `npx drizzle-kit push` | миграция схемы в Postgres |

Переменные окружения: `DATABASE_URL` (обязательная), `DATABASE_SSL=true` (для управляемых БД с SSL).
