import { defineConfig } from 'astro/config';
import react from '@astrojs/react';

export default defineConfig({
  output: 'static',
  integrations: [react()],
  base: process.env.BASE_PATH || '/',
  trailingSlash: 'always',
});
