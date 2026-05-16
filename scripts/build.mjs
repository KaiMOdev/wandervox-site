#!/usr/bin/env node
// Builds localized index.html files from src/template.html + i18n/<lang>.json.
// Run via: npm run build
//
// English output goes to ./index.html (root).
// Other locales go to ./<lang>/index.html.

import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const TEMPLATE = join(ROOT, 'src', 'template.html');
const I18N_DIR = join(ROOT, 'i18n');

const SITE_ORIGIN = 'https://wandervox.app';
const DEFAULT_LANG = 'en';
const HREFLANG_DEFAULT = 'en';

function flatten(obj, prefix = '', out = {}) {
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object' && !Array.isArray(v)) flatten(v, key, out);
    else out[key] = v;
  }
  return out;
}

function substitute(template, dict, lang) {
  const missing = [];
  const out = template.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_m, key) => {
    if (Object.prototype.hasOwnProperty.call(dict, key)) return String(dict[key]);
    missing.push(key);
    return `{{${key}}}`;
  });
  if (missing.length) {
    console.warn(`[${lang}] Missing ${missing.length} keys: ${[...new Set(missing)].slice(0, 10).join(', ')}${missing.length > 10 ? '…' : ''}`);
  }
  return out;
}

function loadLocale(lang) {
  const file = join(I18N_DIR, `${lang}.json`);
  const raw = JSON.parse(readFileSync(file, 'utf8'));
  return flatten(raw);
}

function buildHreflangBlock(langs) {
  const lines = langs.map((lang) => {
    const href = lang === DEFAULT_LANG ? `${SITE_ORIGIN}/` : `${SITE_ORIGIN}/${lang}/`;
    return `<link rel="alternate" hreflang="${lang}" href="${href}">`;
  });
  lines.push(`<link rel="alternate" hreflang="x-default" href="${SITE_ORIGIN}/">`);
  return lines.join('\n');
}

function build() {
  const template = readFileSync(TEMPLATE, 'utf8');
  const langs = readdirSync(I18N_DIR)
    .filter((f) => f.endsWith('.json'))
    .map((f) => f.replace(/\.json$/, ''))
    .sort();

  if (!langs.includes(DEFAULT_LANG)) throw new Error(`Missing default locale: ${DEFAULT_LANG}.json`);

  const hreflangBlock = buildHreflangBlock(langs);

  for (const lang of langs) {
    const dict = loadLocale(lang);
    dict['lang'] = lang;
    dict['canonical_url'] = lang === DEFAULT_LANG ? `${SITE_ORIGIN}/` : `${SITE_ORIGIN}/${lang}/`;
    dict['hreflang_block'] = hreflangBlock;

    const html = substitute(template, dict, lang);

    const outPath = lang === DEFAULT_LANG
      ? join(ROOT, 'index.html')
      : join(ROOT, lang, 'index.html');
    mkdirSync(dirname(outPath), { recursive: true });
    writeFileSync(outPath, html, 'utf8');
    console.log(`[${lang}] -> ${outPath.replace(ROOT, '.').replace(/\\/g, '/')}`);
  }
}

build();
