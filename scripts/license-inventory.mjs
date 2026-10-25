import { readdir, readFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

// Inventory installed package metadata without traversing dependency symlinks.
const root = process.cwd();
const rows = new Map();
async function inspect(directory) {
  let metadata;
  try { metadata = JSON.parse(await readFile(path.join(directory, 'package.json'), 'utf8')); }
  catch { return; }
  if (!metadata.name || !metadata.version) return;
  const license = typeof metadata.license === 'string' ? metadata.license : metadata.license?.type ?? 'UNKNOWN';
  const files = (await readdir(directory)).filter(name => /^(license|licence|copying|notice)(\.|$)/i.test(name));
  const repository = typeof metadata.repository === 'string' ? metadata.repository : metadata.repository?.url ?? null;
  rows.set(`${metadata.name}@${metadata.version}`, { name: metadata.name, version: metadata.version, license, repository, noticeFiles: files });
}
for (const entry of await readdir(path.join(root, 'node_modules/.pnpm'), { withFileTypes: true })) {
  if (!entry.isDirectory() || entry.name === 'node_modules') continue;
  const packages = path.join(root, 'node_modules/.pnpm', entry.name, 'node_modules');
  let children;
  try { children = await readdir(packages, { withFileTypes: true }); } catch { continue; }
  for (const child of children) {
    if (child.isSymbolicLink() || !child.isDirectory()) continue;
    const directory = path.join(packages, child.name);
    if (child.name.startsWith('@')) {
      for (const scoped of await readdir(directory, { withFileTypes: true })) {
        if (scoped.isDirectory() && !scoped.isSymbolicLink()) await inspect(path.join(directory, scoped.name));
      }
    } else await inspect(directory);
  }
}
const packages = [...rows.values()].sort((a, b) => a.name.localeCompare(b.name) || a.version.localeCompare(b.version));
const counts = Object.create(null);
for (const item of packages) counts[item.license] = (counts[item.license] ?? 0) + 1;
await mkdir(path.join(root, 'licenses'), { recursive: true });
await writeFile(path.join(root, 'licenses/dependencies.json'), JSON.stringify({ scope: 'Installed development/build dependencies; not a claim all packages are shipped in the static output.', counts, packages }, null, 2) + '\n');
console.log(JSON.stringify({ packages: packages.length, counts, unknown: packages.filter(item => item.license === 'UNKNOWN').map(item => item.name) }));
