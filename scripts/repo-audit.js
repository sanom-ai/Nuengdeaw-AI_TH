const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const SKIP_DIRS = new Set(['.git', 'node_modules']);
const TEXT_EXTENSIONS = new Set(['.html', '.css', '.md']);
const ATTR_PATTERN = /(src|href)=['"]([^'"]+)['"]/gi;
const CSS_URL_PATTERN = /url\((?:['"])?([^'"\)]+)(?:['"])?\)/gi;
const MD_LINK_PATTERN = /\[[^\]]+\]\(([^)]+)\)/g;

function walk(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, files);
    else files.push(full);
  }
  return files;
}

function isRelativeRef(ref) {
  if (!ref || ref.startsWith('#')) return false;
  if (ref.startsWith('mailto:') || ref.startsWith('tel:')) return false;
  if (ref.startsWith('http://') || ref.startsWith('https://')) return false;
  if (ref.startsWith('data:') || ref.startsWith('blob:')) return false;
  if (ref.startsWith('//')) return false;
  return true;
}

function resolveCandidates(file, ref) {
  const clean = ref.split('#')[0].split('?')[0].trim();
  if (!clean) return [];
  const base = path.resolve(path.dirname(file), clean);
  const candidates = [base];
  if (!path.extname(base)) {
    candidates.push(path.join(base, 'index.html'));
    candidates.push(`${base}.html`);
    candidates.push(`${base}.css`);
    candidates.push(`${base}.md`);
  }
  return [...new Set(candidates)];
}

function existsOne(candidates) {
  return candidates.some(candidate => fs.existsSync(candidate));
}

function scanFile(file) {
  const ext = path.extname(file).toLowerCase();
  if (!TEXT_EXTENSIONS.has(ext)) return [];
  let content = fs.readFileSync(file, 'utf8');
  const issues = [];
  const refs = [];

  if (ext === '.html') {
    content = content.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '');
  }

  for (const match of content.matchAll(ATTR_PATTERN)) refs.push(match[2]);
  for (const match of content.matchAll(CSS_URL_PATTERN)) refs.push(match[1]);
  if (ext === '.md') {
    for (const match of content.matchAll(MD_LINK_PATTERN)) refs.push(match[1]);
  }

  for (const ref of refs) {
    if (!isRelativeRef(ref)) continue;
    const candidates = resolveCandidates(file, ref);
    if (!candidates.length) continue;
    if (!existsOne(candidates)) issues.push({ file, ref });
  }
  return issues;
}

const files = walk(ROOT);
const issues = files.flatMap(scanFile);
if (issues.length) {
  console.error('Broken relative references found:');
  for (const issue of issues) {
    console.error(`- ${path.relative(ROOT, issue.file)} -> ${issue.ref}`);
  }
  process.exit(1);
}

console.log(`Repository audit passed for ${files.length} files.`);
