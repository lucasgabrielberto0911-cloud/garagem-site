# Screenshots PWA

Arquivos usados no `manifest.webmanifest` (Instalar app).

- `narrow.png` — 1080×1920 (celular)
- `wide.png` — 1920×1080 (desktop)

Para regenerar a partir da marca (logo + splash atuais):

```bash
node scripts/generate-pwa-assets.mjs
```

Os splashes Apple extras ficam em `public/branding/splash-{largura}x{altura}.png`.
O fallback continua sendo `splash-iphone.png` (1170×2532). iPhones novos sem
media query específica usam esse fallback.
