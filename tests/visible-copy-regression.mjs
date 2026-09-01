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

console.log('visible website copy regression passed');
