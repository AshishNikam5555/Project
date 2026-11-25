#!/usr/bin/env node
// Writes i18n/en.json and i18n/mr.json from js/i18n.js (the source of truth) for translators to review.
const fs = require('fs'), path = require('path');
const { D } = require('../js/i18n.js');
for (const l of Object.keys(D)) fs.writeFileSync(path.join(__dirname, '..', 'i18n', `${l}.json`), JSON.stringify(D[l], null, 2) + '\n');
console.log('Wrote i18n/en.json, i18n/mr.json');
