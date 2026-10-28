import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  base: '/operacao-miami/',
  plugins: [
    VitePWA({
      // `prompt`, not `autoUpdate`, for the same reason as ICE Breaker: a new deploy should
      // never take over a page that is already running the old build. Registration lives
      // in `src/main.ts`.
      registerType: 'prompt',
      injectRegister: null,
      manifest: {
        name: 'Operação Miami',
        short_name: 'Op. Miami',
        description: 'Sátira política em pixel art - fuja de Brasília até a Flórida.',
        theme_color: '#10202a',
        background_color: '#10202a',
        display: 'fullscreen',
        orientation: 'any',
        icons: [{ src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }],
      },
    }),
  ],
});
