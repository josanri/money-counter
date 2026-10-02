# Money Counter

Minimal, installable web app to count euro coins (1 ct–2 €) and notes up to 20 €. Denominations of 50 € and above exist in the data model but are hidden from the UI.

## Design

Seven visual presets: Minimal, Swiss Minimalist, Neo Brutalism, Market, Coffee Shop, Fruit Shop, and Butcher. Presets shape typography, spacing, corners, controls, denomination surfaces, and coin marks. Each supports system, light, and dark appearance. Use **Customize** in settings to choose larger controls and show coin and note subtotals.

## Develop

```bash
npm install
npx playwright install chromium
npm run dev
```

Open the URL shown in the terminal (usually `http://localhost:4321`).

## Build

```bash
npm run build
npm run preview
```

## Theme screenshot gallery

```bash
npm run themes:gallery
```

This is a manual visual preview generator, not a test and not a commit hook. It captures every preset in system, light, and dark appearance, compact and large controls, and mobile and desktop sizes in Chromium. It saves WebP screenshots (PNG if the optional WebP encoder is unavailable) under `visual-output/theme-gallery/runs/` and creates `visual-output/theme-gallery/index.html` as a contact sheet. The generated folder is git-ignored. To capture an already-running site, set `THEME_GALLERY_URL` before running the command.

Deploy the `dist/` folder to any static host over **HTTPS** (required for install).

## GitHub Pages

For the first deployment:

1. Push the project to the `main` branch.
2. In the GitHub repository, open **Settings → Pages** and set **Build and deployment → Source** to **GitHub Actions**.
3. Open **Actions → Deploy to GitHub Pages** and select **Run workflow** on `main` to deploy immediately. You do not need another commit just to trigger deployment; any later push to `main` also starts the workflow automatically.

The workflow derives the repository name and configures the project base path automatically. A project repository is published at `https://<owner>.github.io/<repository>/`.

## Install on your phone

1. Deploy or use `npm run preview` on your network with HTTPS (or use a tunnel).
2. **Android (Chrome):** open the site → menu → **Install app**, or tap **Install** when the banner appears.
3. **iPhone (Safari):** Share → **Add to Home Screen**.

The app includes a [web app manifest](public/manifest.webmanifest) and a lightweight service worker for offline shell caching.
