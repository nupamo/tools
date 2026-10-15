import { defineConfig } from 'astro/config';
import react from '@astrojs/react';

export default defineConfig({
  output: 'static',
  site: process.env.SITE_URL || 'https://tools.nupa.moe',
  integrations: [react()],
  base: process.env.BASE_PATH || '/',
  trailingSlash: 'always',
  vite: { worker: { format: 'es' } },
});
