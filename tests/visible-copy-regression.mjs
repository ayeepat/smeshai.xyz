import assert from 'node:assert/strict';
import {readdir, readFile} from 'node:fs/promises';
import path from 'node:path';

const FORBIDDEN_PLATFORM_COPY = /school\.mos\.ru|uchebnik\.mos\.ru|(?<![Сс])МЭШ|(?<![Ss])Mesh/iu;
const SKIP_DIRECTORIES = new Set(['.git', 'node_modules', 'tests']);
const PUBLIC_EXTENSIONS = new Set(['.html', '.md', '.txt', '.json']);

async function collect(root) {
  const found = [];
  for (const entry of await readdir(root, {withFileTypes: true})) {
    if (entry.isDirectory() && SKIP_DIRECTORIES.has(entry.name)) continue;
    const absolute = path.join(root, entry.name);
    if (entry.isDirectory()) found.push(...await collect(absolute));
    else if (PUBLIC_EXTENSIONS.has(path.extname(entry.name)) || entry.name === 'robots.txt') found.push(absolute);
  }
  return found;
}

for (const file of await collect('.')) {
  const source = await readFile(file, 'utf8');
  assert.doesNotMatch(source, FORBIDDEN_PLATFORM_COPY, `${file} exposes platform-specific copy`);
}

const processorPage = await readFile('processors/index.html', 'utf8');
assert.match(processorPage, /url\.protocol === 'https:' \? safe\(url\.href\) : '#'/,
  'processor privacy links must reject active/non-HTTPS URL schemes');
assert.match(processorPage, /safeHttps\(item\.privacy_url\)/,
  'the live register must apply the URL sanitizer at the HTML sink');

const siteCss = await readFile('styles/site.css', 'utf8');
assert.match(siteCss, /@media \(max-width: 640px\)[\s\S]*?\.legal-wrap h1\s*\{[\s\S]*?font-size:\s*clamp\(23px, 7\.2vw, 28px\)/,
  'legal page headings must fit the 360px mobile viewport');

const installPage = await readFile('install/index.html', 'utf8');
const chromeStoreUrl = 'https://chromewebstore.google.com/detail/%D1%81%D0%BC%D1%8D%D1%88-ai/gbihhellmceffkjmolejogbdlgigkfpp';
assert.ok(installPage.indexOf('id="tab-chrome"') < installPage.indexOf('id="tab-edge"'),
  'Chrome must be the first browser option');
assert.match(installPage, /id="tab-chrome"[^>]*aria-selected="true"/,
  'Chrome must be selected by default');
assert.ok(installPage.split(chromeStoreUrl).length >= 4,
  'Chrome Web Store must be the primary structured-data, Chrome, and Yandex download URL');
assert.doesNotMatch(installPage, /Скоро|is-soon|aria-disabled="true"/i,
  'published browser options must not retain disabled or coming-soon copy');

console.log('visible website copy regression passed');
