# swissclock.github.io

Personal site for Evyatar Swissa — neuroscientist, Director of In-vivo Research at
Modulight Bio.

Built with Vite and three.js. The model is a point-sampled mouse brain from the
Allen Mouse Brain Common Coordinate Framework v3, with the trigeminal nerve and its
sensory nucleus highlighted as the therapeutic target of the optogenetic work.

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # -> dist/
npm run preview
```

All content lives in `src/content/data.js` and is rendered into the HTML at build
time, so the page reads fine without JavaScript. See [SPEC.md](SPEC.md) for the
design and content rules.

The previous version of the site is kept in `legacy/`.
