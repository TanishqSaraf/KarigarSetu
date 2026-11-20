// Builds KarigarSetu as ONE self-contained HTML file (JS, CSS and fonts inlined) for hosting
// as a Claude Artifact. Output: dist-artifact/karigarsetu.html
// Usage: npm run build:artifact
import { build } from 'vite';
import react from '@vitejs/plugin-react';
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const outDir = 'dist-artifact/build';
process.env.VITE_ROUTER = 'memory';
await build({
  configFile: false,
  plugins: [react()],
  logLevel: 'warn',
  build: { outDir, emptyOutDir: true, assetsInlineLimit: 100_000_000, cssCodeSplit: false, modulePreload: false },
});

const assets = join(outDir, 'assets');
const files = readdirSync(assets);
const js = files.filter((f) => f.endsWith('.js')).map((f) => readFileSync(join(assets, f), 'utf8'));
const css = files.filter((f) => f.endsWith('.css')).map((f) => readFileSync(join(assets, f), 'utf8'));
if (js.length !== 1 || css.length !== 1) throw new Error(`Expected 1 JS and 1 CSS file, got ${files.join(', ')}`);

// The artifact host supplies <html>/<head>/<body>; the page starts with its own <title> and <style>.
const html = `<title>KarigarSetu</title>
<meta name="description" content="Job-work and gold tracking for small jewellers who work with karigars.">
<style>
html, body { background: #F8F5EF; }
${css[0].replace(/<\/style/gi, '<\\/style')}
</style>
<div id="root"></div>
<script type="module">
${js[0].replace(/<\/script/gi, '<\\/script')}
</script>
`;
writeFileSync('dist-artifact/karigarsetu.html', html);
console.log(`dist-artifact/karigarsetu.html  ${(html.length / 1024).toFixed(0)} KB`);
