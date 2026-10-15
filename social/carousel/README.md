# TapLocal social carousel

Small, isolated renderer for 1080 × 1350 Instagram carousel PNGs. It reads `slides/semana3.json` and applies the shared `template.html` to every slide.

## Install

From the repository root:

```powershell
cd social/carousel
npm install
npx playwright install chromium
```

## Render

```powershell
npm run render
```

PNG files are written to `out/semana3-01.png`, `out/semana3-02.png`, and so on. The output directory is ignored by Git.

## Edit the JSON

Open `slides/semana3.json`, keep an array of objects with `title`, `body`, and `footer` fields, save it, and run `npm run render` again:

```powershell
notepad .\slides\semana3.json
```
