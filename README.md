# Bitcoinkernel Workshop Bitdevs Summit Jaipur

Slides and hands-on exercises for a ~90 minute workshop on
[libbitcoinkernel](https://github.com/bitcoin/bitcoin/issues/27587) using
[rust-bitcoinkernel](https://github.com/sedited/rust-bitcoinkernel).

1. **Bitcoinkernel**: why consensus needs to be a library, what the kernel is, and what it requires.
2. **rust-bitcoinkernel**: the API, the mental model, the sharp edges, and four exercises.
3. **Built on the kernel**: kernel-node, bitcoinkernel-node, Floresta/Utreexo, and more.

## Viewing the slides

The deck is a static page with no build step:

```bash
python3 -m http.server 8000
# open http://localhost:8000
```

Opening `index.html` directly also works. The speaker view syncs over `BroadcastChannel`, which needs `http://`.

| Key | Action |
| --- | --- |
| `→` `Space` `PgDn` / `←` `PgUp` | Next / previous (steps first, then slides) |
| `Home` / `End` | First / last slide |
| `G` | Go to slide number |
| `O` | Overview grid |
| `S` | Speaker view: notes, next slide, timer |
| `F` | Fullscreen |
| `B` | Blank screen |
| `H` / `?` | Shortcut help |

`index.html#12` deep-links to slide 12. To export a PDF, print (`Ctrl+P`) with margins set to *None* and background graphics on.

Fonts, highlight.js and the QR code library load from CDNs. Offline, the deck falls back to system fonts, uncoloured code, and no QR code.

## Exercises

```bash
# prerequisites: cmake >= 3.22, a C++20 compiler (GCC >= 12.1 / Clang >= 17), Boost headers
sudo apt install build-essential cmake libboost-dev   # Debian/Ubuntu
brew install cmake boost                               # macOS

cd workshop
cargo build --bins   # the first build compiles Bitcoin Core and takes a few minutes
```

`workshop/data/blocks.hex` holds mainnet blocks 1–170 (one raw block per line), so the exercises need no network.

## Layout

```
index.html            slides (each <section class="slide"> has speaker notes in <aside class="notes">)
assets/css/deck.css   design tokens, layouts, components, print styles
assets/js/deck.js     navigation, steps, overview, speaker view, code rendering
workshop/             Rust crate for the hands-on part
```

### Authoring notes

- Code blocks go in `<div class="code" data-title="…"><script type="text/plain" data-lang="rust" data-hl="2,4-6">…</script></div>`. The source is used verbatim, so no HTML escaping is needed. `data-hl` highlights lines, and long lines shrink to fit.
- Add `class="step"` to reveal an element on the next key press, and `step with-prev` to reveal it together with the previous step.
