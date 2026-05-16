# WanderVox marketing site

Static site for https://wandervox.app - pure HTML/CSS, no build step. Hosted on Vercel.

## Files
- index.html - landing page
- destinations/index.html and destinations/<slug>/index.html - generated destination landing pages
- data/destinations.json - source content for destination landing pages
- src/*.html and i18n/*.json - source templates and localized homepage copy
- privacy.html, terms.html - legal
- llms.txt, robots.txt, sitemap.xml - SEO/GEO
- favicon.svg - icon
- vercel.json - hosting config (cleanUrls, caching, security headers)

## Build
Run `npm run build:i18n` after editing `src/template.html`, `src/*destination*.html`, `i18n/*.json`, or `data/destinations.json`. Generated HTML and `sitemap.xml` are committed.

## Deploy
Vercel auto-deploys on push to main. No build command, no framework.
