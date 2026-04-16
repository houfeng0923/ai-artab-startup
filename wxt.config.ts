import { defineConfig } from 'wxt';

// See https://wxt.dev/api/config.html
export default defineConfig({
  outDir: 'output',
  manifest: {
    name: '晨页',
    description: 'A local-first new tab page for grouped tasks, daily plans, and short history.',
    permissions: ['storage'],
  },
});
