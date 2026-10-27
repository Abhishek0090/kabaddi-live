# 09 PWA

The app installs to a home screen, and the control panel opens again without a network. No PWA library is used.

## Files

| File | Purpose |
| --- | --- |
| [src/app/manifest.ts](../src/app/manifest.ts) | Web app manifest at `/manifest.webmanifest` |
| [src/lib/appIcon.tsx](../src/lib/appIcon.tsx) | Draws the icon with `next/og` |
| [src/app/icon.tsx](../src/app/icon.tsx), [src/app/apple-icon.tsx](../src/app/apple-icon.tsx) | Favicon (64px) and Apple touch icon (180px) |
| [src/app/pwa-icon/[size]/route.tsx](../src/app/pwa-icon/[size]/route.tsx) | 192 and 512 PNGs for the manifest, built at build time |
| [public/sw.js](../public/sw.js) | Service worker |
| [public/offline.html](../public/offline.html) | Shown for a page that was never cached |
| [src/components/RegisterSW.tsx](../src/components/RegisterSW.tsx) | Registers the worker in production builds only |
| [next.config.ts](../next.config.ts) | Serves `sw.js` with `Cache-Control: no-cache` |

The icon mark fills 62% of the square, inside the 80% safe zone, so one image works as both a normal and a maskable icon.

## Caching rules in `sw.js`

| Request | Strategy | Cache |
| --- | --- | --- |
| `/_next/static/*`, icons | Cache first (file names are content-hashed) | `static-v1` |
| Page navigations | Network first, then cached copy, then `offline.html` | `pages-v1` |
| Supabase, other origins, non-GET | Not touched | none |

Score writes never go through the service worker. They live in the localStorage queue described in [04 Scoring and sync](04-scoring-and-sync.md).

## Things to know

- The worker only registers in `npm run build` + `npm start` or on Vercel. `npm run dev` never caches pages, so you always see fresh code.
- Install and offline need HTTPS (or `localhost`). A tablet on a LAN IP over http can use the app but cannot install it.
- After changing `sw.js`, bump `VERSION` at its top. The activate step deletes caches from older versions.
- The page cache prefix `pages-` is also used by `clearPageCaches()` in [src/lib/pwa.ts](../src/lib/pwa.ts). Change both together.
