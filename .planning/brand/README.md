# AI Habit Quest — Brand assets

## icon-512.svg

Official app icon, 512×512.

**Design notes:**
- Onyx Sport Luxury palette (deep onyx → electric violet → emerald progress arc).
- Central "Q" mark — open ring + tail — reads as both a quest checkpoint and a habit-loop motif.
- Green checkmark badge in the corner reinforces the "tick / done" semantic.
- Rounded square (108px corner radius) matches iOS app-icon convention so it sits comfortably alongside system apps.

## Converting SVG → PNG 512×512

Telegram BotFather + most catalog directories want **PNG** (no transparency in the rounded-square tile is fine because the tile is already opaque).

### Option A — online (zero setup, fastest)

1. Open https://cloudconvert.com/svg-to-png or https://convertio.co/svg-png/
2. Upload `icon-512.svg`
3. Set output size **512 × 512**
4. Convert → download → upload to BotFather (`/setuserpic` + Configure Mini App photo).

### Option B — local with ImageMagick

```bash
brew install imagemagick           # macOS
choco install imagemagick           # Windows
# Convert (density 192 ensures crisp 512px raster):
magick -density 192 -background "#08090c" icon-512.svg -resize 512x512 icon-512.png
```

### Option C — local with Sharp (Node)

```bash
npm install --no-save sharp
node -e "require('sharp')('icon-512.svg').resize(512,512).png({compressionLevel:9}).toFile('icon-512.png')"
```

### Option D — preview in browser (no install)

Open `icon-512.svg` directly in any browser — it renders at the correct size. Right-click → Save image as → PNG (some browsers will export PNG directly).

## Where this icon is used

- BotFather `/setuserpic` — bot avatar in Telegram search + chat header.
- BotFather **Configure Mini App → photo** — preview card in Mini Apps catalog.
- tApps Center, appss.pro and other Mini-App catalogs — submission form "icon" field.
- README screenshots / promotional material.

If you want a **640×360** preview banner (used by some catalogs) — let me know and I can generate a variant from the same SVG.
