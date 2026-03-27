#!/usr/bin/env node
/**
 * Post-build script: adds Subresource Integrity (SRI) hashes to
 * <script> and <link> tags in dist/index.html.
 *
 * Usage: node scripts/add-sri.mjs
 */

import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const distDir = resolve(__dirname, '..', 'dist');
const indexPath = resolve(distDir, 'index.html');

if (!existsSync(indexPath)) {
  console.warn('[SRI] dist/index.html not found — skipping SRI generation');
  process.exit(0);
}

function computeSRI(filePath) {
  const content = readFileSync(filePath);
  const hash = createHash('sha384').update(content).digest('base64');
  return `sha384-${hash}`;
}

let html = readFileSync(indexPath, 'utf-8');
let count = 0;

// Add integrity to <script ...> tags that have a src attribute
html = html.replace(/<script\b([^>]*)>/gi, (match, attrs) => {
  if (match.includes('integrity=')) return match;
  const srcMatch = attrs.match(/\bsrc="([^"]+)"/);
  if (!srcMatch) return match;
  const src = srcMatch[1];
  const filePath = resolve(distDir, src.replace(/^\//, ''));
  if (!existsSync(filePath)) return match;
  const integrity = computeSRI(filePath);
  count++;
  let newAttrs = attrs.includes('crossorigin') ? attrs : `${attrs} crossorigin="anonymous"`;
  return `<script${newAttrs} integrity="${integrity}">`;
});

// Add integrity to <link> tags that reference .css or .js files
html = html.replace(/<link\b([^>]*)\/?>/gi, (match, attrs) => {
  if (match.includes('integrity=')) return match;
  const hrefMatch = attrs.match(/\bhref="([^"]+)"/);
  if (!hrefMatch) return match;
  const href = hrefMatch[1];
  if (!href.endsWith('.css') && !href.endsWith('.js')) return match;
  const filePath = resolve(distDir, href.replace(/^\//, ''));
  if (!existsSync(filePath)) return match;
  const integrity = computeSRI(filePath);
  count++;
  let newAttrs = attrs.includes('crossorigin') ? attrs : `${attrs} crossorigin="anonymous"`;
  return `<link${newAttrs} integrity="${integrity}">`;
});

writeFileSync(indexPath, html, 'utf-8');
console.log(`[SRI] Added integrity hashes to ${count} tag(s) in dist/index.html`);
