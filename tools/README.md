# tools

Source for build-time assets that are not part of the site itself.

## og-card.html

The 1200x630 link-preview card served at `/og.png`. Re-render it after changing
the name, the role or the tagline, so the card and the page do not drift apart:

```bash
cd tools && python3 -m http.server 8766 &
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  --headless=new --disable-gpu --hide-scrollbars --force-device-scale-factor=1 \
  --window-size=1200,630 --virtual-time-budget=9000 \
  --screenshot=../public/og.png http://localhost:8766/og-card.html
```

It is rendered rather than hand-drawn so it uses the same typefaces and palette
as the site. It deliberately avoids WebGL, which headless Chrome renders only
through a software rasteriser and very slowly.
