# CF Telegram Bot — Cloudflare + Telegram + Admin UI

Telegram-бот для керування зонами **Cloudflare** (створення зони, NS, DNS CRUD) з **Express**-бекендом, **MongoDB** (whitelist користувачів) та **React (Vite + MUI)** адмінкою. Є endpoint **/notify** для прийому HTTP-подій і надсилання їх у Telegram.

---

## Зміст
- [Функціонал](#функціонал)
- [Архітектура та структури тек](#архітектура-та-структури-тек)
- [Вимоги](#вимоги)
- [Налаштування середовища (ENV)](#налаштування-середовища-env)
- [Локальний запуск](#локальний-запуск)
- [Команди бота](#команди-бота)
- [API бекенда](#api-бекенда)
- [Тестування (curl / Postman)](#тестування-curl--postman)
- [Деплой (Render / Vercel)](#деплой-render--vercel)
- [Безпека та поради](#безпека-та-поради)
- [Налагодження](#налагодження)
- [Ліцензія](#ліцензія)

---

## Функціонал
- **Доступ:** бот працює лише в чаті `ALLOWED_CHAT_ID`; у приваті — тільки для користувачів з **whitelist** (по `username` або `telegramId`).
- **Cloudflare:**
  - `/register <domain>` — створити зону та показати NS.
  - `/status <domain>` — статус зони; якщо *pending*, показати NS.
  - DNS CRUD: `/dns_list`, `/dns_add`, `/dns_update`, `/dns_delete`.
- **/notify:** приймає GET/POST і надсилає в Telegram інформацію про запит (метод, IP, headers, query, body).
- **Admin UI (React + Vite + MUI):** збереження Admin Token у `localStorage`, додавання/видалення користувачів, пошук, копіювання Telegram ID, світла/темна тема, компактні кнопки.

---

## Архітектура та структури тек
```
repo-root/
├─ backend/
│  ├─ src/
│  │  ├─ index.js         # bootstrap
│  │  ├─ server.js        # Express app (маршрути/мідлвари)
│  │  ├─ config.js        # ENV
│  │  ├─ db.js            # Mongo connect + graceful shutdown
│  │  ├─ logger.js
│  │  ├─ models/User.js
│  │  ├─ cf/cloudflare.js # клієнт Cloudflare API
│  │  └─ bot/
│  │     ├─ index.js      # ініціалізація бота
│  │     ├─ access.js     # allowed chat + whitelist
│  │     ├─ commands.js   # команди бота
│  │     └─ utils.js
│  ├─ package.json
│  └─ .env.example
└─ ui/
   ├─ src/
   │  ├─ api.js
   │  ├─ App.jsx
   │  ├─ main.jsx
   │  ├─ theme.js
   │  └─ components/...
   ├─ index.html
   ├─ package.json
   └─ .env.example
```

---

## Вимоги
- **Node.js** 20+
- **MongoDB** (Atlas або self-hosted)
- **Cloudflare** акаунт з правом створення зон:
  - Варіант A: **Global API Key** + Email + Account ID
  - Варіант B (рекомендовано): **API Token** з мінімальними правами (*Zone:Read*, *DNS:Edit*, дозвіл на `POST /zones`)

---

## Налаштування середовища (ENV)

### Backend — `backend/.env`
```dotenv
# Telegram
TELEGRAM_TOKEN=                # токен від @BotFather
ALLOWED_CHAT_ID=-100123...     # id групи/супергрупи; приват — за whitelist

# Cloudflare (обери ОДИН спосіб)
CF_EMAIL=you@example.com
CF_GLOBAL_API_KEY=...          # Global API Key
CLOUDFLARE_ACCOUNT_ID=...
# або токен:
# CLOUDFLARE_TOKEN=...

# Mongo
MONGODB_URI=mongodb+srv://user:pass@cluster/db
# MONGODB_DB=optional

# Express
PORT=3000
NOTIFY_SECRET=...              # X-Notify-Secret для /notify

# Admin API
ADMIN_TOKEN=...                # довгий випадковий токен для адмінки
```

### Frontend — `ui/.env`
```dotenv
# локально
VITE_API_BASE=http://localhost:3000
# продакшен
# VITE_API_BASE=https://<your-backend>.onrender.com
---

## Локальний запуск

### 1) Backend
```bash
cd backend
cp .env.example .env   # заповни значення
npm i
npm run dev
```
У логах очікуй: `MongoDB connected` та `Server on http://0.0.0.0:3000`.

### 2) Frontend
```bash
cd ui
cp .env.example .env   # встанови VITE_API_BASE
npm i
npm run dev
```
Відкрий `http://localhost:5173`, введи **Admin Token** → побачиш whitelist.

---

## Команди бота
- `/help` — список команд  
- `/whoami` — debug (chat_id/type, from_id/username)  
- `/myid` — ваш Telegram ID (щоб внести в whitelist)  
- `/status example.com` — статус зони; якщо pending — покаже NS  
- `/register example.com` — створити зону + вивести NS  
- `/dns_list example.com` — список DNS-записів  
- `/dns_add domain=ex.com type=A name=@ content=1.2.3.4 ttl=300 proxied=true`  
- `/dns_update domain=ex.com id=<recordId> content=1.2.3.5 ttl=120 proxied=false`  
- `/dns_delete domain=ex.com id=<recordId>`

---

## API бекенда

### Health
- `GET /` → `"Bot API active"`
- `GET /healthz` → `{ ok: true, ts }`

### Notify
- `ALL /notify`  
  Заголовок: `X-Notify-Secret: <NOTIFY_SECRET>` (якщо задано)  
  Відповідь: `{ ok: true }`  
  В Telegram надсилається повідомлення з `method`, `IP`, `headers`, `query`, `body`.

### Admin API (Bearer: `Authorization: Bearer <ADMIN_TOKEN>`)
- `GET /api/users` → `{ ok, items }`
- `POST /api/users` `{ username?, telegramId? }` → `{ ok, item }`
- `PATCH /api/users/:id` `{ username?, telegramId? }` → `{ ok, item }`
- `DELETE /api/users/:id` → `{ ok: true }`

---

## Тестування (curl / Postman)

```bash
# список користувачів
curl -H "Authorization: Bearer <ADMIN_TOKEN>" http://localhost:3000/api/users

# додати користувача
curl -X POST http://localhost:3000/api/users \
  -H "Authorization: Bearer <ADMIN_TOKEN>" -H "Content-Type: application/json" \
  -d '{"username":"tester"}'

# оновити користувача
curl -X PATCH http://localhost:3000/api/users/<_id> \
  -H "Authorization: Bearer <ADMIN_TOKEN>" -H "Content-Type: application/json" \
  -d '{"telegramId":123456789}'

# видалити користувача
curl -X DELETE http://localhost:3000/api/users/<_id> \
  -H "Authorization: Bearer <ADMIN_TOKEN)"

# notify (GET)
curl "http://localhost:3000/notify?foo=bar" -H "X-Notify-Secret: <NOTIFY_SECRET>"

# notify (POST)
curl -X POST "http://localhost:3000/notify" \
  -H "X-Notify-Secret: <NOTIFY_SECRET>" -H "Content-Type: application/json" \
  -d '{"event":"deploy","status":"ok"}'
```
## Деплой (Render / Vercel)

### Backend — Render (Web Service)
- **Root Directory:** `backend`
- **Install Command:** `npm ci` *(або `npm install`)*
- **Build Command:** *(порожньо)*
- **Start Command:** `npm start`
- **Environment Variables:** додай всі з `backend/.env` у Settings → Environment
- **Auto-deploy:** опційно “Only if changes in the Root Directory”
- **Polling конфлікти:** бот має бути запущений лише в одному місці (409 Conflict, якщо два polling).

### Frontend — Render (Static Site)
- **Root Directory:** `ui`
- **Install Command:** `npm ci`
- **Build Command:** `npm run build`
- **Publish Directory:** `dist`
- **Environment Variables:** `VITE_API_BASE=https://<your-backend>.onrender.com`
- **Redirects/Rewrites:** `/*` → `/index.html` (**Rewrite**)

### Frontend — Vercel (альтернатива)
- Framework: **Vite**
- Root Directory: `ui`
- Build: `npm run build`
- Output: `dist`
- ENV: `VITE_API_BASE=...` (Production/Preview)


