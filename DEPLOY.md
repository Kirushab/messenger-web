# Деплой messenger-web

Проект уже сконфигурирован под 4 способа развёртывания. Выбери любой.

## 1. Netlify (самый простой — drag & drop)

**Вариант А: через сайт** (30 секунд)
1. `npm run build` локально
2. Перетащи папку `dist/` в [app.netlify.com/drop](https://app.netlify.com/drop)
3. Готово — сайт работает

**Вариант Б: через Git** (автодеплой при push)
1. Залей репо на GitHub
2. На netlify.com → "Add new site" → "Import from Git" → выбери репо
3. Настройки билда подставятся автоматически из `netlify.toml`:
   - Build command: `npm run build`
   - Publish: `dist`
4. Deploy

Файл `netlify.toml` уже в проекте — он настраивает SPA-fallback и память для билда.

---

## 2. Vercel

1. Залей репо на GitHub
2. На [vercel.com](https://vercel.com) → "Add New" → "Project" → выбери репо
3. Framework: Vite определится автоматически
4. Deploy

Конфиг `vercel.json` уже есть — он настраивает SPA-fallback, security headers и no-cache для service worker.

---

## 3. Docker (для VPS/своего сервера)

Нужен Docker + docker-compose на сервере.

```bash
# Сборка и запуск
docker-compose up -d --build

# Логи
docker-compose logs -f

# Остановка
docker-compose down
```

После запуска сайт доступен на `http://<ip>:8080`. Для продакшена поставь перед ним nginx/caddy с HTTPS:

**Caddyfile пример:**
```
your-domain.com {
    reverse_proxy localhost:8080
}
```

Caddy сам выдаст Let's Encrypt сертификат.

**Или просто:**
```bash
docker run -d -p 80:80 --name messenger-web --restart unless-stopped $(docker build -q .)
```

---

## 4. Любой VPS без Docker (Ubuntu/Debian)

```bash
# Установка Node.js
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs nginx

# Билд
git clone <твой репо>
cd messenger-web
npm ci
npm run build

# Копируем статику
sudo rm -rf /var/www/messenger
sudo cp -r dist /var/www/messenger

# Копируем nginx конфиг
sudo cp nginx.conf /etc/nginx/sites-available/messenger
sudo ln -sf /etc/nginx/sites-available/messenger /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

В `nginx.conf` подставь свой домен в `server_name`, root пропиши `/var/www/messenger`.

HTTPS через certbot:
```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
```

---

## 5. GitHub Pages (бесплатно, но требует отдельного билда)

Vite проект → не лучший вариант для GH Pages из-за SPA роутинга (надо править base URL). Лучше используй Netlify/Vercel.

---

## Переменные окружения

Начиная с module7, production-сборка должна брать публичные клиентские значения из `.env.local` / переменных хостинга, а серверные секреты — только из Supabase Edge Function secrets.

1. Скопируй шаблон:

```bash
cp .env.example .env.local
```

2. Заполни клиентские Vite-переменные:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-public-anon-key
VITE_SENTRY_DSN=
VITE_APP_VERSION=v320
BUILD_SOURCEMAPS=false
```

3. Серверные секреты НЕ должны иметь префикс `VITE_` и НЕ должны попадать во фронтенд:

```bash
supabase secrets set HMS_ACCESS_KEY="..." HMS_SECRET="..." AIRLABS_API_KEY="..."
```

4. Деплой Edge Functions:

```bash
supabase functions deploy hms-token
supabase functions deploy account-delete
supabase functions deploy flight-track
supabase functions deploy link-preview
```

5. Перед релизом:

```bash
npm run verify:release
```



## Supabase proxy for restricted/unstable regions

The app now supports a dedicated Supabase reverse proxy. This lets the browser call your own domain instead of calling `*.supabase.co` directly.

For production, deploy the Cloudflare Worker from `workers/supabase-proxy.ts`:

```bash
npm run proxy:deploy
```

Then set the app env:

```bash
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PROXY_URL=https://sigmas-supabase.example.com
VITE_SUPABASE_ANON_KEY=your-public-anon-key
```

`VITE_SUPABASE_PROXY_URL` must be a dedicated origin/subdomain, not a path like `/supabase`. The Worker proxies Auth, REST, Realtime/WebSocket, Storage and Edge Functions. Full setup: `docs/SUPABASE_PROXY.md`.


## Cloudflare Workers deploy note

For Cloudflare Workers Static Assets, SPA fallback is handled by `wrangler.jsonc`:

```jsonc
"assets": {
  "directory": "./dist/",
  "not_found_handling": "single-page-application"
}
```

Do not ship a `public/_redirects` file for the Workers frontend deploy. Rules like `/* /index.html 200` can be rejected by Wrangler with `Invalid _redirects configuration: Infinite loop detected [100324]`. The postbuild script now removes `dist/_redirects` automatically as a safety net. See `docs/CLOUDFLARE_DEPLOY_FIX.md`.



## Если после деплоя висит чёрный экран Sigmas

Это означает, что загрузился `index.html`, но React не дошёл до нормального mount. Начиная с `v327`, приложение показывает экран диагностики вместо вечного splash, если не настроены Supabase-переменные или JS падает до запуска.

Для Cloudflare проверь, что переменные заданы именно как **build variables**, а не только runtime secrets:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-public-anon-key
VITE_SUPABASE_PROXY_URL=https://sigmas-supabase.example.com
```

Важно: `VITE_*` встраиваются во фронтенд во время `npm run build`. После изменения переменных нужно сделать новый deploy с очисткой build cache.

Если используешь PWA на iPhone, после деплоя удали приложение с домашнего экрана и очисти данные сайта в Safari, потому что старый service worker может держать старый `index.html`/JS.
