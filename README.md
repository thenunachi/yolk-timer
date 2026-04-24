# 🥚 Yolk Timer

A beautifully animated egg cooking timer built with vanilla HTML, CSS, and JavaScript.

**Live demo → [timer-kohl-chi.vercel.app](https://timer-kohl-chi.vercel.app)**

---

## Features

- **5 egg styles** — Boiled, Omelette, Poached, Scrambled, Sunny-side Up
- **Preset durations** — 3 presets per style (soft / medium / firm etc.)
- **Animated SVG scenes** — unique per-style animation: bubbling pot with flames, sizzling pan, poaching water, and more
- **Progress ring** — circular countdown with a chicken that orbits the ring while cooking
- **Web Audio sounds** — sizzle / boiling loop while cooking, triple bell when done; 🔊 toggle to mute
- **Carousel navigation** — arrow buttons and dot indicators to switch between timers
- **Fun egg facts** — 15 rotating facts with auto-advance and a progress bar
- **Browser notifications** — desktop alert when the timer finishes (if permission granted)
- **Omelette step guide** — live step highlighting as the timer progresses
- **Fully responsive** — works on mobile and desktop

---

## Tech stack

| Layer | Details |
|---|---|
| Markup | HTML5 + inline SVG |
| Styling | CSS3 — custom properties, keyframe animations, backdrop-filter |
| Logic | Vanilla JavaScript (ES6+) |
| Audio | Web Audio API — procedurally generated noise + oscillators |
| Hosting | Vercel (static) |
| Repo | GitHub |

No frameworks, no build step, no dependencies.

---

## Run locally

```bash
git clone https://github.com/thenunachi/yolk-timer.git
cd yolk-timer
open index.html   # or serve with any static server
```

Or with the Node `serve` package:

```bash
npx serve .
```

---

## Project structure

```
yolk-timer/
├── index.html   # markup + all SVG scenes
├── styles.css   # animations, layout, carousel, responsive
├── app.js       # timer logic, audio engine, carousel, egg facts
└── logo.png     # header logo
```

---

## Egg styles & timings

| Style | Soft | Medium | Firm |
|---|---|---|---|
| Boiled | 3 min | 6 min | 10 min |
| Omelette | 2 min | 3 min | 5 min |
| Poached | 3 min | 4 min | 5 min |
| Scrambled | 1.5 min | 2.5 min | 3.5 min |
| Sunny-side Up | 2 min | 3 min | 4 min |

---

## License

MIT
