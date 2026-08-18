import { defineConfig } from 'astro/config';

// Hybrid rendering: pages are static, but /api/* runs on the server so the
// qualifier's scoring and routing live in our own endpoint rather than a
// third-party form product.
//
// Deploy: add the adapter for your host and set `adapter` below.
//   Vercel  — npx astro add vercel   → import vercel from '@astrojs/vercel/serverless'
//   Netlify — npx astro add netlify  → import netlify from '@astrojs/netlify'
//
// Until an adapter is added, `output: 'static'` keeps `npm run build` working
// and the qualifier falls back to client-side routing (see src/lib/submit.ts).
export default defineConfig({
  site: 'https://realitycheck.seesawlabs.com',
  output: 'static',
  build: { inlineStylesheets: 'auto' },
  devToolbar: { enabled: false },
});
