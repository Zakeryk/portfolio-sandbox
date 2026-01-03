# File Assets

Drop your project images in this folder and they'll automatically be matched to projects based on filename.

## How it works

1. Add images to this folder with project names in the filename
2. Run `node ../generate-manifest.js` to generate the manifest
3. Refresh the page to see real images instead of placeholders

## Naming convention

Include the project name (or part of it) in your image filename. The matching is case-insensitive and ignores spaces/special characters.

**Examples:**
- `ravewater-concept-092-final.jpg` → matches "Rave Water"
- `merch-lildustyg.jpg` → matches "Lil Dusty G"
- `reveo-dashboard-v2.png` → matches "Reveo"
- `gothparade-poster-01.jpg` → matches "gothparade"
- `greenphilosophyco-homepage.jpg` → matches "Green Philosophy Co"

## Projects available for matching

- Reveo
- Snowie
- Green Philosophy Co
- Raveyard Sounds
- Shockwav Sound Co
- gothparade
- Rave Water
- Glass Heart
- Beat Secrets
- us2
- Polar Culture
- Lil Dusty G
- School of Bass
- Crywolf

## Regenerating the manifest

After adding new images, run:
```bash
cd /path/to/concept_dragfile/assets
node generate-manifest.js
```

This will scan the file-assets folder and update `file-assets-manifest.json` with all matched images.
