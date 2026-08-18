#!/usr/bin/env node
/*
 * Lightweight release guard against putting server-only secrets into the client bundle.
 * It intentionally focuses on patterns that are dangerous for this project rather than
 * generic entropy scanning, because Supabase anon keys and Sentry DSNs are public client IDs.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOTS = ['src', 'scripts', 'workers'];
const ALLOWED = new Set(['src/lib/supabase.ts', 'src/lib/sentry.ts']);
const checks = [
  { re: /const\s+SK\s*=\s*['"][^'"]+['"]/i, reason: 'hardcoded 100ms/HMS secret constant' },
  { re: /HMS_SECRET\s*=\s*['"][^'"]{12,}['"]/i, reason: 'hardcoded HMS_SECRET value' },
  { re: /new\s+SignJWT\s*\(/, reason: 'JWT signing in browser/client code' },
  { re: /SERVICE_ROLE_KEY\s*=\s*['"][^'"]{12,}['"]/i, reason: 'hardcoded Supabase service role key' },
  { re: /AIRLABS_API_KEY\s*=\s*['"][^'"]{8,}['"]/i, reason: 'hardcoded AirLabs API key' },
];

function walk(dir, acc = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) {
      if (['node_modules', 'dist', '.git'].includes(name)) continue;
      walk(p, acc);
    } else if (/\.(ts|tsx|js|mjs)$/.test(name)) {
      acc.push(p);
    }
  }
  return acc;
}

const violations = [];
for (const root of ROOTS) {
  for (const file of walk(root)) {
    if (ALLOWED.has(file)) continue;
    const text = readFileSync(file, 'utf8');
    for (const c of checks) {
      if (c.re.test(text)) violations.push({ file, reason: c.reason });
    }
  }
}

if (violations.length) {
  console.error(`✗ scan:secrets — найдено ${violations.length} потенциальных секретов/подписей в клиентском коде:`);
  for (const v of violations) console.error(`  ${v.file}: ${v.reason}`);
  process.exit(1);
}
console.log('✓ scan:secrets — серверные секреты в клиентском коде не найдены.');
