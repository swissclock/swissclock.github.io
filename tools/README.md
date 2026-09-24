# tools

Source for build-time assets that are not part of the site itself. Nothing here
is bundled: `tools/` is outside the Vite entry, so it never reaches `dist/`.

## og-card.html

The 1200x630 link-preview card served at `/og.jpg`. JPEG, not PNG: the point
cloud is photographic and costs a third as much in JPEG with no visible loss.

It imports `/src/scene/index.js` rather than reproducing the model, so the brain
on the card is the brain on the page and the two cannot drift apart. That means
it has to be rendered against the dev server, not opened as a file.

Re-render it after changing the name, the role, the tagline or the scene:

```bash
npx vite --port 5175 --strictPort &

"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  --headless=new --disable-gpu --use-gl=swiftshader --enable-unsafe-swiftshader \
  --hide-scrollbars --force-device-scale-factor=2 --window-size=1200,630 \
  --virtual-time-budget=45000 --screenshot=/tmp/og2x.png \
  http://localhost:5175/tools/og-card.html

sips -Z 1200 -s format png /tmp/og2x.png --out /tmp/og1x.png
sips -s format jpeg -s formatOptions 88 /tmp/og1x.png --out public/og.jpg
```

Notes on the flags, all of which matter:

- `--use-gl=swiftshader --enable-unsafe-swiftshader` gives headless Chrome a
  software WebGL implementation. Without them the canvas is blank. It is slow:
  24,000 points take a few minutes to reach a settled frame, which is why the
  virtual time budget is generous.
- `--force-device-scale-factor=2` renders at twice the size; `sips` then halves
  it, so the type in the card is crisp rather than rasterised at 1x.
- The page waits for the geometry to load and runs the camera easing to a stop
  before it sets `data-ready`, so the shot is never taken mid-animation.
