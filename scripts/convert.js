#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const https = require('https');
const { execSync } = require('child_process');

// ---------------------------------------------------------------------------
// Args
// ---------------------------------------------------------------------------
const inputFile = process.argv[2];
if (!inputFile) {
  console.error('Usage: node convert.js <input.md>');
  process.exit(1);
}

const inputPath = path.resolve(inputFile);
if (!fs.existsSync(inputPath)) {
  console.error(`File not found: ${inputPath}`);
  process.exit(1);
}

const outputDir = path.dirname(inputPath);
const baseName = path.basename(inputPath, path.extname(inputPath));
const outputHtml = path.join(outputDir, baseName + '.html');

// mermaid.min.js is cached in the skill dir; never written next to the output
const skillDir = path.join(__dirname, '..');
const cachedMermaid = path.join(skillDir, 'mermaid.min.js');

// ---------------------------------------------------------------------------
// Ensure marked is available (install locally in skill dir if needed)
// ---------------------------------------------------------------------------
function ensureMarked() {
  const markedDir = path.join(skillDir, 'node_modules', 'marked');
  if (!fs.existsSync(markedDir)) {
    console.log('Installing marked (first time only)...');
    execSync('npm install marked --prefix ' + JSON.stringify(skillDir), { stdio: 'inherit' });
  }
}

ensureMarked();

let marked;
try {
  marked = require(path.join(skillDir, 'node_modules', 'marked')).marked;
} catch (e) {
  // fallback: try global or PATH
  try {
    marked = require('marked').marked;
  } catch (e2) {
    console.error('Could not load marked. Run: npm install marked --prefix ' + skillDir);
    process.exit(1);
  }
}

// ---------------------------------------------------------------------------
// Download mermaid.min.js → cache in skill dir, return its content as string
// ---------------------------------------------------------------------------
const MERMAID_CDN = 'https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js';

function fetchMermaidJs(url) {
  return new Promise((resolve, reject) => {
    console.log(`Downloading mermaid.min.js from ${url}...`);
    https.get(url, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        fetchMermaidJs(res.headers.location).then(resolve).catch(reject);
        return;
      }
      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode} fetching ${url}`));
        return;
      }
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => {
        const content = Buffer.concat(chunks).toString('utf8');
        fs.writeFileSync(cachedMermaid, content, 'utf8');
        console.log(`Cached: ${cachedMermaid}`);
        resolve(content);
      });
    }).on('error', reject);
  });
}

async function getMermaidJs() {
  return fetchMermaidJs(MERMAID_CDN);
}

// ---------------------------------------------------------------------------
// HTML entity decoder (for mermaid block content marked may have escaped)
// ---------------------------------------------------------------------------
function decodeHtmlEntities(str) {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'");
}

// ---------------------------------------------------------------------------
// Transform marked output: <pre><code class="language-mermaid">…</code></pre>
//   → <div class="mermaid">…</div>
// ---------------------------------------------------------------------------
function transformMermaidBlocks(html) {
  return html.replace(
    /<pre><code class="language-mermaid">([\s\S]*?)<\/code><\/pre>/g,
    (_, inner) => `<div class="mermaid">\n${decodeHtmlEntities(inner).trim()}\n</div>`
  );
}

function hasMermaidInMarkdown(md) {
  return /```mermaid[\s\S]*?```/i.test(md);
}

function hasMermaidInHtml(html) {
  return /class="language-mermaid"|class="mermaid"/.test(html);
}

// ---------------------------------------------------------------------------
// HTML page template — mermaidScript is embedded inline when present
// ---------------------------------------------------------------------------
function buildHtmlPage(title, bodyHtml, mermaidScript) {
  const mermaidCss = mermaidScript ? `
    /* Mermaid diagrams */
    .mermaid {
      background: #f9f9f9;
      border: 1px solid #e1e4e8;
      border-radius: 6px;
      padding: 16px;
      margin-bottom: 16px;
      overflow-x: auto;
      text-align: center;
    }` : '';

  const mermaidScripts = mermaidScript
    ? `  <script>${mermaidScript}</script>
  <script>
    mermaid.initialize({ startOnLoad: true, theme: 'default' });
  </script>`
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(title)}</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
      font-size: 16px;
      line-height: 1.6;
      color: #24292e;
      background: #fff;
      max-width: 900px;
      margin: 0 auto;
      padding: 32px 24px 80px;
    }
    h1, h2, h3, h4, h5, h6 {
      font-weight: 600;
      line-height: 1.25;
      margin-top: 24px;
      margin-bottom: 16px;
    }
    h1 { font-size: 2em; padding-bottom: .3em; border-bottom: 1px solid #eaecef; }
    h2 { font-size: 1.5em; padding-bottom: .3em; border-bottom: 1px solid #eaecef; }
    h3 { font-size: 1.25em; }
    a { color: #0366d6; text-decoration: none; }
    a:hover { text-decoration: underline; }
    p { margin-top: 0; margin-bottom: 16px; }
    blockquote {
      margin: 0 0 16px;
      padding: 0 1em;
      color: #6a737d;
      border-left: .25em solid #dfe2e5;
    }
    code {
      font-family: "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace;
      font-size: 85%;
      background: rgba(27,31,35,.05);
      border-radius: 3px;
      padding: .2em .4em;
    }
    pre {
      background: #f6f8fa;
      border-radius: 6px;
      padding: 16px;
      overflow: auto;
      font-size: 85%;
      line-height: 1.45;
      margin-bottom: 16px;
    }
    pre code {
      background: transparent;
      padding: 0;
      font-size: 100%;
    }
    table {
      border-collapse: collapse;
      width: 100%;
      margin-bottom: 16px;
    }
    th, td {
      border: 1px solid #dfe2e5;
      padding: 6px 13px;
      text-align: left;
    }
    tr:nth-child(even) { background: #f6f8fa; }
    th { background: #f0f2f4; font-weight: 600; }
    img { max-width: 100%; }
    hr { border: 0; border-top: 1px solid #eaecef; margin: 24px 0; }
    ul, ol { padding-left: 2em; margin-bottom: 16px; }
    li + li { margin-top: .25em; }
${mermaidCss}
  </style>
</head>
<body>
${bodyHtml}
${mermaidScripts}
</body>
</html>`;
}

function escapeHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  const mdContent = fs.readFileSync(inputPath, 'utf8');

  // Convert markdown → HTML
  const rawHtml = marked(mdContent);

  const needsMermaid = hasMermaidInMarkdown(mdContent) || hasMermaidInHtml(rawHtml);
  const bodyHtml = needsMermaid ? transformMermaidBlocks(rawHtml) : rawHtml;
  const mermaidScript = needsMermaid ? await getMermaidJs() : null;

  if (!needsMermaid) {
    console.log('No mermaid diagrams found — skipping mermaid.min.js');
  }

  // Build and write single self-contained HTML file
  const title = baseName.replace(/-/g, ' ');
  const html = buildHtmlPage(title, bodyHtml, mermaidScript);
  fs.writeFileSync(outputHtml, html, 'utf8');

  console.log(`\nDone! Single self-contained file:`);
  console.log(`  HTML: ${outputHtml}`);
}

main().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});
