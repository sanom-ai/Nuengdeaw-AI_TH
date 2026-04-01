'use strict';

const fs = require('fs');
const path = require('path');

const workspaceRoot = process.cwd();
const uiDbPath = path.join(workspaceRoot, 'Nuengdeaw_UI_Config_DB.js');
const uiDb = require(uiDbPath);

const INCLUDE_EXTS = new Set(['.html', '.js']);
const EXCLUDE_DIRS = new Set(['.git', 'node_modules', 'dist', 'build', 'coverage']);

const args = new Set(process.argv.slice(2));
const strictUnused = args.has('--strict-unused');

const keyPatterns = [
  /resolveText\(\s*['\"]([^'\"]+)['\"]/g,
  /setText\(\s*['\"][^'\"]+['\"]\s*,\s*['\"]([^'\"]+)['\"]/g,
  /setHtmlMulti\(\s*['\"][^'\"]+['\"]\s*,\s*['\"]([^'\"]+)['\"]/g,
];

const extractUsedKeys = (text) => {
  const keys = new Set();
  for (const pattern of keyPatterns) {
    let m;
    while ((m = pattern.exec(text)) !== null) keys.add(m[1]);
  }
  return [...keys];
};

const walkFiles = (rootDir) => {
  const out = [];
  const stack = [rootDir];

  while (stack.length > 0) {
    const current = stack.pop();
    let entries = [];
    try {
      entries = fs.readdirSync(current, { withFileTypes: true });
    } catch (_) {
      continue;
    }

    for (const entry of entries) {
      const abs = path.join(current, entry.name);
      const rel = path.relative(rootDir, abs);
      if (entry.isDirectory()) {
        if (!EXCLUDE_DIRS.has(entry.name)) stack.push(abs);
        continue;
      }
      if (!entry.isFile()) continue;

      const ext = path.extname(entry.name).toLowerCase();
      if (!INCLUDE_EXTS.has(ext)) continue;
      out.push(rel);
    }
  }

  return out.sort((a, b) => a.localeCompare(b));
};

const inferAllowedOwnersByFile = (relPath, allOwners) => {
  const n = relPath.replace(/\\/g, '/').toLowerCase();

  if (n.endsWith('/index.html') || n === 'index.html') return ['shared'];
  if (n.includes('gen1')) return ['shared', 'gen1'];
  if (n.includes('gen2')) return ['shared', 'gen2'];
  if (n.includes('gen3')) return ['shared', 'gen3'];
  if (n.includes('gen4')) return ['shared', 'gen4'];

  return allOwners;
};

const getOwnerFromKey = (key) => String(key).split('.')[0];

const dbConfig = (typeof uiDb.get === 'function') ? uiDb.get() : {};
const allOwners = Array.isArray(dbConfig?.keyConventions?.owners)
  ? dbConfig.keyConventions.owners
  : ['shared', 'gen1', 'gen2', 'gen3', 'gen4'];

const allFiles = walkFiles(workspaceRoot);
const availableKeys = new Set(uiDb.listTextKeys());
const usedByFile = {};

for (const rel of allFiles) {
  const abs = path.join(workspaceRoot, rel);
  let text = '';
  try {
    text = fs.readFileSync(abs, 'utf8');
  } catch (_) {
    continue;
  }
  const keys = extractUsedKeys(text);
  if (keys.length > 0) usedByFile[rel] = keys;
}

const missing = [];
const invalidOwner = [];
const usedSet = new Set();

for (const [file, keys] of Object.entries(usedByFile)) {
  const allowedOwners = new Set(inferAllowedOwnersByFile(file, allOwners));
  for (const key of keys) {
    usedSet.add(key);

    if (!availableKeys.has(key)) {
      missing.push({ file, key });
      continue;
    }

    const owner = getOwnerFromKey(key);
    if (!allowedOwners.has(owner)) {
      invalidOwner.push({ file, key, owner, allowed: [...allowedOwners] });
    }
  }
}

const unused = [...availableKeys].filter((k) => !usedSet.has(k));

const printSection = (title, rows, formatFn) => {
  if (!rows.length) return;
  console.log(`\n${title}`);
  rows.forEach((row) => console.log(`- ${formatFn(row)}`));
};

console.log('[lint-ui-text-keys] Summary');
console.log(`- files scanned: ${allFiles.length}`);
console.log(`- files with key usage: ${Object.keys(usedByFile).length}`);
console.log(`- available keys: ${availableKeys.size}`);
console.log(`- used keys: ${usedSet.size}`);

printSection('Missing Keys', missing, (r) => `${r.file}: ${r.key}`);
printSection('Owner Policy Violations', invalidOwner, (r) => `${r.file}: ${r.key} (owner=${r.owner}, allowed=${r.allowed.join(',')})`);
printSection('Unused Keys', unused, (k) => `${k}`);

const hasBlocking = missing.length > 0 || invalidOwner.length > 0 || (strictUnused && unused.length > 0);
if (hasBlocking) {
  console.error('\n[lint-ui-text-keys] FAILED');
  process.exit(1);
}

console.log('\n[lint-ui-text-keys] PASSED');
