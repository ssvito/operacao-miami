# Repo & Deploy

Parte de [Operação Miami](./Operacao%20Miami.md).

`C:\vito\operacao-miami`, branch `main`, remote `github.com/ssvito/operacao-miami` (público). Deploy próprio por GitHub Actions para o Pages, como o ICE Breaker - **https://ssvito.github.io/operacao-miami/**. `vite.config.ts` usa `base: '/operacao-miami/'` e o `index.html` usa `%BASE_URL%` nos ícones.

O Pages precisa estar com a fonte em **GitHub Actions** (Settings > Pages); o `configure-pages` do workflow com `enablement: true` não tem permissão para ligar isso sozinho com o token padrão.

## Ícones

`public/icon.svg` é a fonte; os PNG (192, 512 e o `apple-touch-icon` de 180) saem de `node scripts/gen-icons.mjs`, que repete os mesmos retângulos e escreve PNG direto com `zlib`, sem dependência. Mudou o SVG, muda o script junto. A arte fica nos 80% centrais em escala inteira, porque os PNG são `maskable` e o Android recorta a borda.
