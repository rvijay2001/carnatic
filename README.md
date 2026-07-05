# carnatic

Personal repository for creating an app to aid my own learning of South Indian
classical (Carnatic) music.

A private practice companion PWA (iPhone + Mac) that grows with my lessons —
currently: just-intonation swara reference for raga Mayamalavagowla, on the way
to Sarali Varisai practice, swara sustain exercises, and ear training.

- **Design & binding rules:** [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
- **Live app:** https://rvijay2001.github.io/carnatic/
- **Stack:** Vite + Svelte 5 + TypeScript, Web Audio API, vite-plugin-pwa

## Develop

```sh
npm install
npm run dev      # local dev server
npm test         # unit tests
npm run build    # production build
```

Pushing to `main` deploys to GitHub Pages via Actions.
