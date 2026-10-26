# Bitcoinkernel Workshop BOSS Summit Jaipur

Slides and a walkthrough crate for a ~60 minute workshop on
[libbitcoinkernel](https://github.com/bitcoin/bitcoin/issues/27587) using
[rust-bitcoinkernel](https://github.com/sedited/rust-bitcoinkernel).

1. **Bitcoinkernel**: why consensus needs to be a library, what the kernel is, and what it requires.
2. **rust-bitcoinkernel**: the language wrapper bindings that we will be using to talk with the consensus code.
3. **Built on the kernel**: kernel-node[github.com/kernel-node/kernel-node], bitcoinkernel-node[github.com/yuvicc/bitcoinkernel-node], Floresta/Utreexo, and more.

## Building the walkthrough crate

```bash
# prerequisites: cmake >= 3.15, a C++20 compiler (GCC >= 12.1 / Clang >= 17), Boost headers
sudo apt install build-essential cmake libboost-dev   # Debian/Ubuntu
brew install cmake boost                               # macOS

cd workshop
cargo build --bins
```

`workshop/data/blocks.hex` holds mainnet blocks 1–170 (one raw block per line), so the walkthrough needs no network.

## Layout

```
index.html            slides (each <section class="slide"> has speaker notes in <aside class="notes">)
assets/css/deck.css   design tokens, layouts, components, print styles
assets/js/deck.js     navigation, steps, overview, speaker view, code rendering
workshop/             Rust crate for the rust-bitcoinkernel walkthrough
```
