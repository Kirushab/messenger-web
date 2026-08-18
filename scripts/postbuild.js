// Дублирует dist/index.html в dist/404.html.
// Это работает как SPA-fallback на хостингах которые не поддерживают rewrites
// (или когда rewrite не настроен): static-сервер на любой неизвестный путь по
// умолчанию отдаёт 404.html, а у нас это полностью валидный SPA-индекс с тем
// же JS, и React Router уже сам решит куда вести пользователя.
import { copyFileSync, existsSync, unlinkSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const dist = join(__dirname, '..', 'dist');

const src = join(dist, 'index.html');
const dst404 = join(dist, '404.html');
const dst200 = join(dist, '200.html');
const redirects = join(dist, '_redirects');

if (existsSync(src)) {
  copyFileSync(src, dst404);
  // 200.html is harmless on Cloudflare Workers and useful for fallback hosts such as Render/Surge.
  copyFileSync(src, dst200);
  console.log('[postbuild] dist/index.html → dist/404.html and dist/200.html (SPA fallbacks)');
} else {
  console.warn('[postbuild] dist/index.html not found, skipping SPA fallback copies');
}

// Cloudflare Workers Static Assets rejects Netlify/Pages-style SPA rewrite rules like
// `/* /index.html 200` with: Invalid _redirects configuration: Infinite loop detected.
// The Worker already uses `assets.not_found_handling = single-page-application` in wrangler.jsonc,
// so make the build robust even if an old public/_redirects or generated dist/_redirects sneaks in.
if (existsSync(redirects)) {
  unlinkSync(redirects);
  console.log('[postbuild] removed dist/_redirects; Cloudflare Workers SPA fallback is handled by wrangler.jsonc');
}
