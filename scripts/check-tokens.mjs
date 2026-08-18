#!/usr/bin/env node
/*
 * Гард дизайн-системы (без ESLint — в проекте его нет, это standalone-проверка без зависимостей).
 * Правило: «магических» fontSize в диапазоне текстовой шкалы (11–26 px) быть не должно —
 * такие размеры обязаны ссылаться на токены var(--fs-*) или класс ty-*.
 * Размеры ВНЕ шкалы (≤10 и ≥27) — это иконки/аватары/эмодзи/крупные числа, они допускаются.
 *
 * Запуск:  npm run check:tokens
 * Код выхода 1 при нарушениях — удобно для CI / pre-commit.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = 'src';
const IN_SCALE_MIN = 11;
const IN_SCALE_MAX = 26;
const RE = /fontSize:\s*([0-9]+(?:\.[0-9]+)?)(?![0-9.])/g;

function walk(dir, acc = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, acc);
    else if (p.endsWith('.tsx')) acc.push(p);
  }
  return acc;
}

const violations = [];
for (const file of walk(ROOT)) {
  const lines = readFileSync(file, 'utf8').split('\n');
  lines.forEach((line, i) => {
    RE.lastIndex = 0;
    let m;
    while ((m = RE.exec(line))) {
      const v = parseFloat(m[1]);
      if (Number.isInteger(v) && v >= IN_SCALE_MIN && v <= IN_SCALE_MAX) {
        violations.push({ file, line: i + 1, value: m[1], snippet: line.trim().slice(0, 90) });
      }
    }
  });
}

if (violations.length === 0) {
  console.log('✓ check:tokens — «магических» fontSize в шкале (11–26 px) не найдено.');
  process.exit(0);
}

console.error(`✗ check:tokens — найдено ${violations.length} fontSize в диапазоне токенов (11–26 px).`);
console.error('  Используйте var(--fs-*) или класс ty-* (см. docs/DESIGN_SYSTEM.md).\n');
for (const v of violations) {
  console.error(`  ${v.file}:${v.line}  →  fontSize: ${v.value}    ${v.snippet}`);
}
console.error('\n  (Размеры вне текстовой шкалы — иконки/аватары — и так вне 11–26 и не флагуются.)');
process.exit(1);
