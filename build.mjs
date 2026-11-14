// Bundles src/ (Preact + the engine) into public/app.js. `npm run build`, or `npm run dev` to rebuild on save.
import * as esbuild from 'esbuild';
const opts = { entryPoints: ['src/main.jsx'], bundle: true, minify: true, format: 'esm', outfile: 'public/app.js', jsx: 'automatic', jsxImportSource: 'preact', target: 'es2020' };
if (process.argv.includes('--watch')) { const ctx = await esbuild.context(opts); await ctx.watch(); console.log('watching src/'); }
else await esbuild.build(opts);
