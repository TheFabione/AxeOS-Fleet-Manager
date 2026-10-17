#!/usr/bin/env node
// ════════════════════════════════════════════════════════════
// AxeOS Fleet Manager — release builder
//
//   node scripts/build-release.mjs           check, then build dist/
//   node scripts/build-release.mjs --check   check only, build nothing
//
// Checks: JSON files parse, every script passes `node --check`, the version
// in manifest.json appears in CHANGELOG.md, the README badge and a
// RELEASE_vX_Y_Z.md file. Then builds a reproducible zip (fixed timestamps
// and file order, so the same sources always give the same SHA-256), writes
// dist/SHA256SUMS.txt, puts the checksum into the release notes and writes
// dist/RELEASE_NOTES.md (same notes, links made absolute) for the GitHub release.
// Uses only Node.js built-ins, so it runs the same on Windows, macOS and Linux.
// ════════════════════════════════════════════════════════════
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { deflateRawSync } from 'node:zlib';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CHECK_ONLY = process.argv.includes('--check');

// Files that make up the extension. Anything else in the repository (docs,
// screenshots, scripts, release notes) stays out of the zip.
const RUNTIME_FILES = [
  'manifest.json', 'background.js', 'dashboard.html', 'dashboard.css', 'dashboard.js',
  'popup.html', 'popup.js', 'themes.css', 'pool-catalog.json', 'README.md', 'CHANGELOG.md',
];
const SCRIPTS = ['background.js', 'dashboard.js', 'popup.js'];

const errors = [], warnings = [];
const read = (f) => readFileSync(join(ROOT, f), 'utf8');

// ─── Checks ───
let manifest;
try { manifest = JSON.parse(read('manifest.json')); } catch (e) { errors.push(`manifest.json is not valid JSON: ${e.message}`); }
try { JSON.parse(read('pool-catalog.json')); } catch (e) { errors.push(`pool-catalog.json is not valid JSON: ${e.message}`); }
for (const f of SCRIPTS) {
  const r = spawnSync(process.execPath, ['--check', join(ROOT, f)], { encoding: 'utf8' });
  if (r.status !== 0) errors.push(`${f} has a syntax error:\n${(r.stderr || '').trim()}`);
}
const iconFiles = existsSync(join(ROOT, 'icons')) ? readdirSync(join(ROOT, 'icons')).filter((f) => f.endsWith('.png')).sort() : [];
for (const size of [16, 48, 128]) if (!iconFiles.includes(`icon${size}.png`)) errors.push(`icons/icon${size}.png is missing`);
for (const f of RUNTIME_FILES) if (!existsSync(join(ROOT, f))) errors.push(`${f} is missing`);

const version = manifest?.version;
if (version && !/^\d+\.\d+\.\d+$/.test(version)) errors.push(`manifest.json version "${version}" is not in X.Y.Z form`);
const notesFile = version ? `RELEASE_v${version.replace(/\./g, '_')}.md` : null;
if (version) {
  const changelog = read('CHANGELOG.md');
  if (!new RegExp(`^## v${version.replace(/\./g, '\\.')}\\b`, 'm').test(changelog)) errors.push(`CHANGELOG.md has no "## v${version}" entry`);
  else if (changelog.indexOf(`## v${version}`) !== changelog.search(/^## v/m)) warnings.push(`the v${version} entry is not the first one in CHANGELOG.md`);
  if (!read('README.md').includes(`version-${version}-`)) errors.push(`the README version badge does not say ${version}`);
  if (!existsSync(join(ROOT, notesFile))) errors.push(`${notesFile} (release notes) is missing`);
  else if (!/SHA-256 of `axe-fleet-manager-v[\d.]+\.zip`:\s*```/.test(read(notesFile))) warnings.push(`${notesFile} has no "SHA-256 of \`axe-fleet-manager-v${version}.zip\`:" block, so the checksum can't be filled in`);
}

for (const w of warnings) console.log(`⚠  ${w}`);
if (errors.length) {
  for (const e of errors) console.error(`✗  ${e}`);
  console.error(`\n${errors.length} problem${errors.length === 1 ? '' : 's'} found. Nothing was built.`);
  process.exit(1);
}
console.log(`✓  Checks passed for v${version}`);
if (CHECK_ONLY) process.exit(0);

// ─── Reproducible zip ───
const CRC_TABLE = new Uint32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc32 = (buf) => { let c = 0xffffffff; for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
// Fixed timestamp (2026-01-01 00:00) so rebuilding unchanged sources gives the same bytes
const DOS_TIME = 0, DOS_DATE = ((2026 - 1980) << 9) | (1 << 5) | 1;

function buildZip(entries) {
  const locals = [], centrals = []; let offset = 0;
  for (const { name, data } of entries) {
    const nameBuf = Buffer.from(name, 'utf8');
    const deflated = deflateRawSync(data, { level: 9 });
    const useDeflate = deflated.length < data.length;
    const body = useDeflate ? deflated : data, crc = crc32(data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4); local.writeUInt16LE(0x0800, 6);
    local.writeUInt16LE(useDeflate ? 8 : 0, 8); local.writeUInt16LE(DOS_TIME, 10); local.writeUInt16LE(DOS_DATE, 12);
    local.writeUInt32LE(crc, 14); local.writeUInt32LE(body.length, 18); local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBuf.length, 26); local.writeUInt16LE(0, 28);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0); central.writeUInt16LE(0x031e, 4); central.writeUInt16LE(20, 6); central.writeUInt16LE(0x0800, 8);
    central.writeUInt16LE(useDeflate ? 8 : 0, 10); central.writeUInt16LE(DOS_TIME, 12); central.writeUInt16LE(DOS_DATE, 14);
    central.writeUInt32LE(crc, 16); central.writeUInt32LE(body.length, 20); central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(nameBuf.length, 28); central.writeUInt32LE((name.endsWith("/") ? 0o40755 : 0o100644) * 65536, 38);
    central.writeUInt32LE(offset, 42);
    locals.push(local, nameBuf, body); centrals.push(central, nameBuf);
    offset += local.length + nameBuf.length + body.length;
  }
  const cd = Buffer.concat(centrals), end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(entries.length, 8); end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(cd.length, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, cd, end]);
}

const folder = `axe-fleet-manager-v${version}`;
const files = [...RUNTIME_FILES, ...iconFiles.map((f) => `icons/${f}`)].sort();
const entries = files.map((f) => ({ name: `${folder}/${f}`, data: readFileSync(join(ROOT, f)) }));
const zip = buildZip(entries);
const zipName = `${folder}.zip`;
const sha = createHash('sha256').update(zip).digest('hex');

mkdirSync(join(ROOT, 'dist'), { recursive: true });
writeFileSync(join(ROOT, 'dist', zipName), zip);
writeFileSync(join(ROOT, 'dist', 'SHA256SUMS.txt'), `${sha}  ${zipName}\n`);

// Put the checksum into the release notes (replaces the placeholder or an older hash)
const notes = read(notesFile);
const filled = notes.replace(/(SHA-256 of `axe-fleet-manager-v[\d.]+\.zip`:\s*```[^\n]*\n)[^\n]*(\n```)/, `$1${sha}$2`);
if (filled !== notes) writeFileSync(join(ROOT, notesFile), filled);

// Release body for GitHub: relative links (CHANGELOG.md, docs/…) don't resolve on
// a release page, so point them at the files as they are in this tag
let repoUrl = null;
const origin = spawnSync('git', ['remote', 'get-url', 'origin'], { cwd: ROOT, encoding: 'utf8' });
const m = origin.status === 0 && (origin.stdout || '').trim().match(/github\.com[:/]([^/]+)\/([^/\s]+?)(?:\.git)?\/?$/);
if (m) repoUrl = `https://github.com/${m[1]}/${m[2]}`;
const body = repoUrl
  ? filled.replace(/\]\((?!https?:|#|mailto:)([^)\s]+)\)/g, (_, path) => `](${repoUrl}/blob/v${version}/${path.replace(/^\.\//, '')})`)
  : filled;
writeFileSync(join(ROOT, 'dist', 'RELEASE_NOTES.md'), body);

console.log(`✓  Built dist/${zipName} (${(zip.length / 1024).toFixed(0)} KB, ${files.length} files)`);
console.log(`✓  SHA-256 ${sha}`);
console.log(filled !== notes ? `✓  Checksum written into ${notesFile}` : `•  ${notesFile} already had this checksum`);
console.log(repoUrl ? `✓  dist/RELEASE_NOTES.md ready, links point to ${repoUrl}/blob/v${version}/` : '⚠  No GitHub "origin" remote found: dist/RELEASE_NOTES.md keeps relative links');
