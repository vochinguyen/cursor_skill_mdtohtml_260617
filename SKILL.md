---
name: md-to-html
description: Converts Markdown files to standalone HTML with Mermaid diagram support. Use when the user wants to convert a .md file to HTML, says "md to html", "markdown to html", "convert markdown", "mermaid html", or provides a .md file path for HTML export.
disable-model-invocation: true
---

# MD to HTML Converter

Converts a Markdown file to a styled, self-contained HTML file. Supports Mermaid diagrams, tables, fenced code blocks, and all standard Markdown.

## Quick start

```bash
node ~/.cursor/skills/md-to-html/scripts/convert.js /path/to/file.md
```

Output: `/path/to/file.html` and `mermaid.min.js` in the same directory.

## What the script does

1. Reads the `.md` file
2. Installs `marked` on first run (via `npm install --prefix`)
3. Converts Markdown → HTML using `marked`
4. Transforms `<pre><code class="language-mermaid">` blocks → `<div class="mermaid">` so Mermaid renders them
5. Downloads `mermaid.min.js` from `https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js` (only if not already present)
6. Writes a full HTML page with GitHub-like CSS + Mermaid support

## When user provides a file

Run the script directly — no extra setup needed. Node.js is required (pre-installed on macOS).

```bash
node ~/.cursor/skills/md-to-html/scripts/convert.js "$MD_FILE_PATH"
```

Then open the resulting `.html` file in a browser.
