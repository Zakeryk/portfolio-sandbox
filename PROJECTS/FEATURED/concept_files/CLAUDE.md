# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## project overview

single-file portfolio web app (index.html) with interactive desktop/filing metaphor. users drag documents around a desk, open them to spill images, view in lightbox gallery, and delete via wastebin. no build step - runs directly in browser.

**tech:** vanilla js + gsap animations, single 3400+ line html file

## deploy command

deploy changes by running:
```bash
bash "/Users/zkryk/ORANGE_RUGGED_EXTERNALDRIVE/PORTFOLIO_INDEX/deploy.command"
```

**important:** use `bash` not `open` - open fails with permission errors

## architecture

### file structure
```
/
├── index.html           # entire app (html + css + js)
├── meta.json           # project metadata
├── favicon.png         # app icon
├── thumb.png/svg       # preview thumbnails
└── assets/
    ├── background.jpg
    ├── generate-manifest.js          # scans images, outputs manifest
    ├── update-images.command         # quick manifest update
    ├── file-assets-manifest.json     # maps projects → image paths
    └── file-assets/                  # 45+ portfolio images
```

### code organization in index.html

**css (lines ~20-900):**
- resets, backgrounds, noise overlay
- filing area (sidebar) & documents area (main desk)
- wastebin styles (bottom center, slides up on drag)
- lightbox gallery (horizontal desktop, vertical mobile)
- responsive breakpoint @768px

**javascript (lines ~1200-3400+):**
- state object (central state mgmt)
- setupWastebin() - delete zone logic
- setupDocumentDraggable() - gsap draggable instances
- spillImagesForGallery() - scatter images from document
- enterLightbox() / exitLightbox() - gallery viewer
- toggleFocusImage() - focus/unfocus with scroll-into-view
- shake detection - collect similar docs via gesture
- hover-to-collect - 500ms hover collects docs
- filing system - drag to category folders

### state management

centralized `state` object tracks:
```js
{
  draggables,        // gsap instances
  currentZIndex,     // z-index stacking
  spilledFolders,    // which docs opened
  spilledImages,     // image elements on desk
  galleryActive,     // lightbox open/closed
  isMobile,          // responsive mode
  wastebin,          // delete zone api
  // ...more
}
```

## key interactions

1. **drag & drop:** gsap draggable with bounds, inertia (desktop only), z-index mgmt
2. **open document:** click → spills images in circle around doc
3. **lightbox:** double-click image → full gallery viewer
   - desktop: horizontal scroll, click to focus
   - mobile: vertical grid, swipe
   - esc/close button to exit
4. **wastebin:** drag doc over wastebin → drop to delete (removes from desk)
5. **shake gesture:** left-right drag reversals (3+) → collects similar category docs
6. **filing:** drag to left sidebar category headers → returns doc to menu
7. **peek effect:** hover doc → 3 preview images appear with tilt animation

## asset management

### adding new images

1. add images to `assets/file-assets/` with naming pattern: `projectname-##.png`
2. update manifest:
   ```bash
   cd assets
   node generate-manifest.js
   ```
3. manifest matches filenames to 14 project names (case-insensitive, strips spaces/special chars)

### supported projects

reveo, snowie, green philosophy co, raveyard sounds, shockwav sound co, gothparade, rave water, glass heart, beat secrets, us2, polar culture, lil dusty g, school of bass, crywolf

## common dev patterns

### disabling dragging (e.g., during lightbox)
```js
const allDocs = document.querySelectorAll('.document');
allDocs.forEach(doc => {
  const dragInstance = Draggable.get(doc);
  if (dragInstance) dragInstance.disable();
});
```

### re-enabling
```js
allDocs.forEach(doc => {
  const dragInstance = Draggable.get(doc);
  if (dragInstance) dragInstance.enable();
});
```

### scroll element into view
```js
element.scrollIntoView({
  behavior: 'smooth',
  block: 'nearest',
  inline: 'center'
});
```

## responsive design

- **desktop (>768px):** sidebar visible, horizontal lightbox, hover effects, inertia dragging
- **mobile (≤768px):** hamburger menu, vertical lightbox, touch-optimized, no inertia

## important gotchas

- **wastebin in lightbox:** wastebin css hidden via `body:has(#lightbox-overlay.visible) #wastebin { display: none }` but docs can still trigger showWastebin() if draggable enabled - must disable doc dragging when lightbox opens
- **focused images off-screen:** use scrollIntoView when focusing to center image in gallery
- **gsap instances:** always check `Draggable.get(element)` exists before calling methods
- **mobile touch:** use passive event listeners, no hover effects on mobile

## performance notes

- preloaded images cached in state.preloadedImages
- `will-change: transform` on draggable elements
- gsap tweens minimize repaints
- image manifest loads async, falls back to placeholders
