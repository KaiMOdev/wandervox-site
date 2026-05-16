#!/usr/bin/env node
// Builds localized index.html files from src/template.html + i18n/<lang>.json,
// plus English destination landing pages from data/destinations.json.
// Run via: npm run build:i18n
//
// Script is named `build:i18n` (not `build`) intentionally so Vercel does NOT
// auto-detect it and run it during deploy. The generated index.html and
// nl/index.html files are committed to git and Vercel serves them as static
// assets. Run the script locally after editing any i18n/*.json.
//
// English output goes to ./index.html (root). Other locales go to ./<lang>/index.html.
// Destination output goes to ./destinations/index.html and ./destinations/<slug>/index.html.

import { readFileSync, writeFileSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const TEMPLATE = join(ROOT, 'src', 'template.html');
const DESTINATION_TEMPLATE = join(ROOT, 'src', 'destination-template.html');
const DESTINATIONS_TEMPLATE = join(ROOT, 'src', 'destinations-template.html');
const I18N_DIR = join(ROOT, 'i18n');
const DESTINATIONS_FILE = join(ROOT, 'data', 'destinations.json');
const DESTINATIONS_OUT = join(ROOT, 'destinations');

const SITE_ORIGIN = 'https://wandervox.app';
const DEFAULT_LANG = 'en';
const LASTMOD = '2026-05-16';

const HOME_DESTINATION_COPY = {
  en: {
    label: 'Destination guides',
    title: 'Travel translation guides for popular destinations',
    desc: 'Start with high-intent guides for the places travelers search before they install a translation app.',
    all: 'View all destination guides',
    cta: 'View guide',
    lang: 'Language',
    currency: 'Currency',
    nav: 'Destinations',
  },
  nl: {
    label: 'Bestemmingsgidsen',
    title: 'Reisvertaling per populaire bestemming',
    desc: 'Begin met praktische gidsen voor bestemmingen waar taal, menu\'s, borden en lokale gewoonten belangrijk zijn.',
    all: 'Bekijk alle bestemmingsgidsen',
    cta: 'Bekijk gids',
    lang: 'Taal',
    currency: 'Valuta',
    nav: 'Bestemmingen',
  },
  es: {
    label: 'Guias de destino',
    title: 'Traduccion de viaje para destinos populares',
    desc: 'Guias practicas para destinos donde importan los menus, senales, frases locales y contexto cultural.',
    all: 'Ver todas las guias',
    cta: 'Ver guia',
    lang: 'Idioma',
    currency: 'Moneda',
    nav: 'Destinos',
  },
  de: {
    label: 'Reisefuehrer',
    title: 'Reiseuebersetzung fuer beliebte Ziele',
    desc: 'Praktische Zielseiten fuer Reisen, bei denen Menues, Schilder, lokale Saetze und Kultur wichtig sind.',
    all: 'Alle Zielseiten ansehen',
    cta: 'Guide ansehen',
    lang: 'Sprache',
    currency: 'Waehrung',
    nav: 'Reiseziele',
  },
  fr: {
    label: 'Guides de destination',
    title: 'Traduction de voyage pour destinations populaires',
    desc: 'Des guides pratiques pour les voyages ou menus, panneaux, phrases locales et contexte culturel comptent.',
    all: 'Voir tous les guides',
    cta: 'Voir le guide',
    lang: 'Langue',
    currency: 'Devise',
    nav: 'Destinations',
  },
  ja: {
    label: '目的地ガイド',
    title: '人気の旅行先向け翻訳ガイド',
    desc: 'メニュー、標識、現地フレーズ、文化的な注意点が重要な旅行先向けの実用ガイドです。',
    all: 'すべての目的地ガイドを見る',
    cta: 'ガイドを見る',
    lang: '言語',
    currency: '通貨',
    nav: '目的地',
  },
};

const FEATURED_DESTINATION_SLUGS = [
  'japan',
  'italy',
  'thailand',
  'france',
  'spain',
  'portugal',
];

function flatten(obj, prefix = '', out = {}) {
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object' && !Array.isArray(v)) flatten(v, key, out);
    else out[key] = v;
  }
  return out;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeJsonForHtml(value) {
  return JSON.stringify(value, null, 2).replace(/</g, '\\u003c');
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

function loadDestinations() {
  return JSON.parse(readFileSync(DESTINATIONS_FILE, 'utf8'));
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

function buildDestinationCards(destinations, copy) {
  return destinations.map((destination) => `
      <article class="destination-card">
        <a href="/destinations/${escapeHtml(destination.slug)}" aria-label="${escapeHtml(copy.cta)}: ${escapeHtml(destination.name)}">
          <span class="destination-card-code">${escapeHtml(destination.countryCode)}</span>
          <h3>${escapeHtml(destination.name)}</h3>
          <p>${escapeHtml(destination.hero)}</p>
          <dl>
            <div><dt>${escapeHtml(copy.lang)}</dt><dd>${escapeHtml(destination.language)}</dd></div>
            <div><dt>${escapeHtml(copy.currency)}</dt><dd>${escapeHtml(destination.currency)}</dd></div>
          </dl>
          <span class="destination-card-cta">${escapeHtml(copy.cta)}</span>
        </a>
      </article>`).join('');
}

function buildHomeDestinationsSection(lang, destinations) {
  const copy = HOME_DESTINATION_COPY[lang] ?? HOME_DESTINATION_COPY.en;
  const featured = FEATURED_DESTINATION_SLUGS
    .map((slug) => destinations.find((destination) => destination.slug === slug))
    .filter(Boolean);

  return `<section class="destination-preview" id="destinations">
  <div class="container">
    <div class="section-header-center">
      <div class="section-label">${escapeHtml(copy.label)}</div>
      <h2 class="section-title">${escapeHtml(copy.title)}</h2>
      <p class="section-desc">${escapeHtml(copy.desc)}</p>
    </div>
    <div class="destination-grid">
${buildDestinationCards(featured, copy)}
    </div>
    <div class="destination-more">
      <a href="/destinations" class="btn-secondary">${escapeHtml(copy.all)}</a>
    </div>
  </div>
</section>`;
}

function buildDestinationListPage(destinations) {
  const template = readFileSync(DESTINATIONS_TEMPLATE, 'utf8');
  const cards = buildDestinationCards(destinations, HOME_DESTINATION_COPY.en);
  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    '@id': `${SITE_ORIGIN}/destinations#webpage`,
    url: `${SITE_ORIGIN}/destinations`,
    name: 'Travel Translation Destination Guides',
    description: 'Destination-specific WanderVox translation guides for travelers.',
    inLanguage: 'en',
    isPartOf: { '@id': `${SITE_ORIGIN}/#website` },
    about: { '@id': `${SITE_ORIGIN}/#app` },
    mainEntity: {
      '@type': 'ItemList',
      itemListElement: destinations.map((destination, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        name: destination.name,
        url: `${SITE_ORIGIN}/destinations/${destination.slug}`,
      })),
    },
  };

  const html = substitute(template, {
    canonical_url: `${SITE_ORIGIN}/destinations`,
    meta_title: 'Travel Translation Destination Guides | WanderVox',
    meta_description: 'Destination-specific translation guides for Japan, Italy, Thailand, France, Germany, Spain, Portugal, Mexico, Greece, and South Korea.',
    og_image: `${SITE_ORIGIN}/og.svg`,
    destination_cards: cards,
    structured_data: escapeJsonForHtml(structuredData),
  }, 'destinations');

  const outPath = join(DESTINATIONS_OUT, 'index.html');
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, html, 'utf8');
  console.log(`[destinations] -> ${outPath.replace(ROOT, '.').replace(/\\/g, '/')}`);
}

function buildPhraseRows(destination) {
  return destination.phrases.map(([source, translated]) => `
        <tr>
          <td>${escapeHtml(source)}</td>
          <td lang="${escapeHtml(destination.languageCode)}">${escapeHtml(translated)}</td>
        </tr>`).join('');
}

function buildListItems(items) {
  return items.map((item) => `<li>${escapeHtml(item)}</li>`).join('');
}

function buildRelatedLinks(destination, destinations) {
  return destinations
    .filter((item) => item.slug !== destination.slug)
    .slice(0, 4)
    .map((item) => `<a href="/destinations/${escapeHtml(item.slug)}">${escapeHtml(item.name)}</a>`)
    .join('');
}

function buildDestinationPage(destination, destinations) {
  const template = readFileSync(DESTINATION_TEMPLATE, 'utf8');
  const canonical = `${SITE_ORIGIN}/destinations/${destination.slug}`;
  const structuredData = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebPage',
        '@id': `${canonical}#webpage`,
        url: canonical,
        name: destination.metaTitle,
        description: destination.metaDescription,
        inLanguage: 'en',
        isPartOf: { '@id': `${SITE_ORIGIN}/#website` },
        about: { '@id': `${SITE_ORIGIN}/#app` },
        datePublished: '2026-05-16T00:00:00Z',
        dateModified: `${LASTMOD}T00:00:00Z`,
      },
      {
        '@type': 'SoftwareApplication',
        '@id': `${SITE_ORIGIN}/#app`,
        name: 'WanderVox',
        operatingSystem: 'Android',
        applicationCategory: 'TravelApplication',
        url: SITE_ORIGIN,
      },
      {
        '@type': 'FAQPage',
        '@id': `${canonical}#faq`,
        mainEntity: [
          {
            '@type': 'Question',
            name: `Can WanderVox translate ${destination.language} in ${destination.name}?`,
            acceptedAnswer: {
              '@type': 'Answer',
              text: `Yes. WanderVox supports ${destination.language} translation for practical travel situations including voice, typed text, menus, signs, and common phrases.`,
            },
          },
          {
            '@type': 'Question',
            name: `Does WanderVox help with menus and signs in ${destination.name}?`,
            acceptedAnswer: {
              '@type': 'Answer',
              text: 'Yes. The Smart Camera can translate menus, signs, documents, and printed text from a photo, with travel-focused context where available.',
            },
          },
        ],
      },
    ],
  };

  const html = substitute(template, {
    canonical_url: canonical,
    meta_title: escapeHtml(destination.metaTitle),
    meta_description: escapeHtml(destination.metaDescription),
    og_image: `${SITE_ORIGIN}/og.svg`,
    destination_name: escapeHtml(destination.name),
    country_code: escapeHtml(destination.countryCode),
    language_name: escapeHtml(destination.language),
    language_code: escapeHtml(destination.languageCode),
    currency_code: escapeHtml(destination.currency),
    hero_text: escapeHtml(destination.hero),
    intro: escapeHtml(destination.intro),
    highlights: buildListItems(destination.highlights),
    use_cases: buildListItems(destination.useCases),
    phrase_rows: buildPhraseRows(destination),
    related_links: buildRelatedLinks(destination, destinations),
    structured_data: escapeJsonForHtml(structuredData),
  }, destination.slug);

  const outPath = join(DESTINATIONS_OUT, destination.slug, 'index.html');
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, html, 'utf8');
  console.log(`[destination:${destination.slug}] -> ${outPath.replace(ROOT, '.').replace(/\\/g, '/')}`);
}

function buildSitemap(langs, destinations) {
  const localeLinks = langs.map((lang) => {
    const href = lang === DEFAULT_LANG ? `${SITE_ORIGIN}/` : `${SITE_ORIGIN}/${lang}/`;
    return `    <xhtml:link rel="alternate" hreflang="${lang}" href="${href}"/>`;
  }).join('\n');
  const localeLinksWithDefault = `${localeLinks}\n    <xhtml:link rel="alternate" hreflang="x-default" href="${SITE_ORIGIN}/"/>`;

  const homeUrls = langs.map((lang) => {
    const loc = lang === DEFAULT_LANG ? `${SITE_ORIGIN}/` : `${SITE_ORIGIN}/${lang}/`;
    const priority = lang === DEFAULT_LANG ? '1.0' : '0.9';
    return `  <url>
    <loc>${loc}</loc>
    <lastmod>${LASTMOD}</lastmod>
    <changefreq>daily</changefreq>
    <priority>${priority}</priority>
${localeLinksWithDefault}
  </url>`;
  }).join('\n');

  const destinationUrls = [
    {
      loc: `${SITE_ORIGIN}/destinations`,
      priority: '0.8',
    },
    ...destinations.map((destination) => ({
      loc: `${SITE_ORIGIN}/destinations/${destination.slug}`,
      priority: '0.75',
    })),
  ].map((entry) => `  <url>
    <loc>${entry.loc}</loc>
    <lastmod>${LASTMOD}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>${entry.priority}</priority>
  </url>`).join('\n');

  const legalUrls = `  <url>
    <loc>${SITE_ORIGIN}/privacy</loc>
    <lastmod>2026-05-14</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.3</priority>
  </url>
  <url>
    <loc>${SITE_ORIGIN}/terms</loc>
    <lastmod>2026-05-14</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.3</priority>
  </url>`;

  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml">
${homeUrls}
${destinationUrls}
${legalUrls}
</urlset>
`;
  writeFileSync(join(ROOT, 'sitemap.xml'), sitemap, 'utf8');
  console.log('[sitemap] -> ./sitemap.xml');
}

function build() {
  const template = readFileSync(TEMPLATE, 'utf8');
  const destinations = loadDestinations();
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
    dict['nav.destinations'] = (HOME_DESTINATION_COPY[lang] ?? HOME_DESTINATION_COPY.en).nav;
    dict['footer.f_destinations'] = (HOME_DESTINATION_COPY[lang] ?? HOME_DESTINATION_COPY.en).nav;
    dict['destinations_section'] = lang === DEFAULT_LANG ? buildHomeDestinationsSection(lang, destinations) : '';

    const html = substitute(template, dict, lang);

    const outPath = lang === DEFAULT_LANG
      ? join(ROOT, 'index.html')
      : join(ROOT, lang, 'index.html');
    mkdirSync(dirname(outPath), { recursive: true });
    writeFileSync(outPath, html, 'utf8');
    console.log(`[${lang}] -> ${outPath.replace(ROOT, '.').replace(/\\/g, '/')}`);
  }

  rmSync(DESTINATIONS_OUT, { recursive: true, force: true });
  buildDestinationListPage(destinations);
  for (const destination of destinations) {
    buildDestinationPage(destination, destinations);
  }
  buildSitemap(langs, destinations);
}

build();
