'use strict';

const fs = require('fs');
const path = require('path');

const root = process.cwd();
const src = path.join(root, 'phasa-tawan-foundation.json');
const out = path.join(root, 'phasa-tawan-foundation.readable.json');

const raw = fs.readFileSync(src, 'utf8').replace(/^\uFEFF/, '');
const parsed = JSON.parse(raw);
const pretty = JSON.stringify(parsed, null, 2) + '\n';
fs.writeFileSync(out, pretty, 'utf8');

console.log('[foundation-readable] wrote:', out);


