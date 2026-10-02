# Money Counter

Minimal, installable web app to count euro coins (1 ct–2 €) and notes up to 20 €. Denominations of 50 € and above exist in the data model but are hidden from the UI.

## Design

Six visual presets: Minimal, Euro, Market, Coffee Shop, Fruit Shop, and Butcher. Presets shape typography, spacing, corners, controls, denomination surfaces, and coin marks. Each supports system, light, and dark appearance.

## Develop

```bash
npm install
npm run hooks:install
npx playwright install chromium firefox webkit
npm run dev
```

Open the URL shown in the terminal (usually `http://localhost:4321`).

## Build

```bash
npm run build
npm run preview
```

## Theme pre-commit check

```bash
npm run themes:check
```

The pre-commit hook runs this check before each commit. It builds a production preview and checks every preset across Chromium, Firefox, and WebKit, system/light/dark appearance, compact/large controls, and mobile/desktop widths. It saves full-page screenshots in timestamped runs and updates `test-output/theme-matrix/index.html` as a contact sheet. The output folder is git-ignored. Set `THEME_CHECK_URL` to check an already-running app instead.

Deploy the `dist/` folder to any static host over **HTTPS** (required for install).

## GitHub Pages

The included workflow deploys on pushes to `main`. In the repository settings, choose **Settings → Pages → Build and deployment → GitHub Actions** as the source. The workflow derives the repository name and configures the project base path automatically. A project repository is published at `https://<owner>.github.io/<repository>/`.

## Install on your phone

1. Deploy or use `npm run preview` on your network with HTTPS (or use a tunnel).
2. **Android (Chrome):** open the site → menu → **Install app**, or tap **Install** when the banner appears.
3. **iPhone (Safari):** Share → **Add to Home Screen**.

The app includes a [web app manifest](public/manifest.webmanifest) and a lightweight service worker for offline shell caching.
