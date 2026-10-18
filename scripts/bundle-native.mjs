import fs from 'node:fs';
import path from 'node:path';

const distDir = path.resolve('dist');
const assetsDir = path.join(distDir, 'assets');
const indexHtmlPath = path.join(distDir, 'index.html');

let html = fs.readFileSync(indexHtmlPath, 'utf-8');

const assetFiles = fs.readdirSync(assetsDir);
const cssFile = assetFiles.find((f) => f.endsWith('.css'));
const jsFile = assetFiles.find((f) => f.endsWith('.js'));

if (cssFile) {
  const cssContent = fs.readFileSync(path.join(assetsDir, cssFile), 'utf-8');
  html = html.replace(
    /<link[^>]*rel="stylesheet"[^>]*>/i,
    `<style>\n${cssContent}\n</style>`
  );
}

if (jsFile) {
  const jsContent = fs.readFileSync(path.join(assetsDir, jsFile), 'utf-8');
  html = html.replace(
    /<script[^>]*src="[^"]*"[^>]*><\/script>/i,
    () => `<script type="module">\n${jsContent}\n</script>`
  );
}

// Convert into a C header string literal using raw bytes or escaped hex so GCC compiles it cleanly
fs.mkdirSync('native', { recursive: true });
const bytes = Buffer.from(html, 'utf-8');
const hexArray = [];
for (let i = 0; i < bytes.length; i++) {
  hexArray.push(`0x${bytes[i].toString(16).padStart(2, '0')}`);
}
hexArray.push('0x00'); // null-terminator

const headerContent = `// Auto-generated embedded UI bundle for SpiderWeb native GTK4 binary
#ifndef SPIDERWEB_BUNDLE_H
#define SPIDERWEB_BUNDLE_H

#include <stddef.h>

static const unsigned char SPIDERWEB_HTML[] = {
  ${hexArray.join(', ')}
};

static const size_t SPIDERWEB_HTML_LEN = ${bytes.length};

#endif
`;

fs.writeFileSync(path.join('native', 'bundle.h'), headerContent, 'utf-8');
console.log(`✓ Generated native/bundle.h (${(bytes.length / 1024).toFixed(1)} KB embedded)`);
