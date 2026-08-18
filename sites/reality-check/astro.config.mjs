import { defineConfig } from 'astro/config';
import vercel from '@astrojs/vercel';

// Static by default, with the qualifier endpoint rendered on demand.
//
// Astro 5 removed `output: 'hybrid'` — with an adapter present, `output: 'static'`
// prerenders everything except routes that opt out via `export const prerender = false`.
// That is exactly the shape we want: four static pages, one server function.
export default defineConfig({
  site: 'https://realitycheck.seesawlabs.com',
  output: 'static',
  adapter: vercel({
    webAnalytics: { enabled: false },
  }),
  build: { inlineStylesheets: 'auto' },
  devToolbar: { enabled: false },
});
