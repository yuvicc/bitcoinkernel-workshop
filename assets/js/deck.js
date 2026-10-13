/* ==========================================================================
   Bitcoinkernel Workshop — slide engine (no dependencies)

   Keys:  → ↓ Space PgDn  next      ← ↑ PgUp  previous
          Home / End      first / last slide
          F  fullscreen    O  overview    S  speaker view
          G  go to slide   H / ?  help     B  blank screen
   URL:   index.html#12   deep-links to slide 12
          ?speaker        speaker view (notes, next slide, timer)
          ?preview        passive render used inside the speaker view
   ========================================================================== */

(function () {
  "use strict";

  const params = new URLSearchParams(location.search);
  const MODE = params.has("speaker") ? "speaker" : params.has("preview") ? "preview" : "deck";
  const CHANNEL = "bitcoinkernel-deck";
  const W = 1920, H = 1080;

  const stage = document.querySelector(".stage");
  const slides = Array.from(document.querySelectorAll(".stage > .slide"));
  const total = slides.length;

  let index = 0;
  let step = 0;
  let channel = null;
  try { channel = new BroadcastChannel(CHANNEL); } catch (_) { /* file:// in some browsers */ }

  /* ------------------------------------------------------------------------
     Code blocks: <div class="code" data-title="x.rs">
                    <script type="text/plain" data-lang="rust" data-hl="2,4-6"> … </script>
                  </div>
     Script tags keep the source verbatim, so no HTML escaping is needed.
     ------------------------------------------------------------------------ */

  function dedent(src) {
    const lines = src.replace(/\t/g, "    ").split("\n");
    while (lines.length && !lines[0].trim()) lines.shift();
    while (lines.length && !lines[lines.length - 1].trim()) lines.pop();
    const indent = Math.min(
      ...lines.filter((l) => l.trim()).map((l) => l.match(/^ */)[0].length)
    );
    return lines.map((l) => l.slice(indent)).join("\n");
  }

  function parseRanges(spec) {
    const out = new Set();
    (spec || "").split(",").forEach((part) => {
      const [a, b] = part.trim().split("-").map(Number);
      if (!a) return;
      for (let i = a; i <= (b || a); i++) out.add(i);
    });
    return out;
  }

  function buildCodeBlocks(root) {
    root.querySelectorAll(".code > script[type='text/plain']").forEach((script) => {
      const wrap = script.parentElement;
      const lang = script.dataset.lang || "plaintext";
      const pre = document.createElement("pre");
      const code = document.createElement("code");
      code.className = "language-" + lang;
      code.textContent = dedent(script.textContent);
      pre.appendChild(code);

      if (wrap.dataset.title) {
        const title = document.createElement("div");
        title.className = "code-title";
        title.textContent = wrap.dataset.title;
        wrap.appendChild(title);
      }
      wrap.appendChild(pre);
      pre.dataset.hl = script.dataset.hl || "";
      script.remove();

      if (window.hljs) {
        try { window.hljs.highlightElement(code); } catch (_) { /* leave plain */ }
      }
    });
  }

  // Shrink a code block's font until its longest line fits the column.
  function fitCode(root) {
    root.querySelectorAll(".code pre").forEach((pre) => {
      pre.style.fontSize = "";
      let fs = parseFloat(getComputedStyle(pre).fontSize);
      while (pre.scrollWidth > pre.clientWidth + 1 && fs > 15) {
        fs -= 0.5;
        pre.style.fontSize = fs + "px";
      }
    });
  }

  function layoutCode(root) {
    fitCode(root);
    placeLineHighlights(root);
  }

  function placeLineHighlights(root) {
    root.querySelectorAll(".code pre[data-hl]").forEach((pre) => {
      pre.querySelectorAll(".hl-line").forEach((n) => n.remove());
      const lines = parseRanges(pre.dataset.hl);
      if (!lines.size) return;
      const cs = getComputedStyle(pre);
      const lh = parseFloat(cs.lineHeight);
      const top = parseFloat(cs.paddingTop);
      lines.forEach((n) => {
        const bar = document.createElement("div");
        bar.className = "hl-line";
        bar.style.top = top + (n - 1) * lh + "px";
        bar.style.height = lh + "px";
        pre.insertBefore(bar, pre.firstChild);
      });
    });
  }

  /* ------------------------------------------------------------------------
     Steps: every .step is its own reveal, in DOM order.
     Add .with-prev to reveal together with the preceding step.
     ------------------------------------------------------------------------ */

  function stepGroups(slide) {
    const groups = [];
    slide.querySelectorAll(".step").forEach((el) => {
      if (el.classList.contains("with-prev") && groups.length) groups[groups.length - 1].push(el);
      else groups.push([el]);
    });
    return groups;
  }

  const groupsBySlide = slides.map(stepGroups);

  function applySteps(i, n) {
    groupsBySlide[i].forEach((group, g) => {
      group.forEach((el) => el.classList.toggle("visible", g < n));
    });
  }

  /* ------------------------------------------------------------------------
     Chrome: progress bar + footer
     ------------------------------------------------------------------------ */

  const BTC_ICON =
    '<svg viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r="30" fill="#f7931a"/>' +
    '<path fill="#fff" d="M44.6 27.9c.6-4.1-2.5-6.3-6.8-7.8l1.4-5.6-3.4-.8-1.4 5.4c-.9-.2-1.8-.4-2.7-.7l1.4-5.5-3.4-.8-1.4 5.6c-.7-.2-1.5-.3-2.2-.5l-4.7-1.2-.9 3.6s2.5.6 2.5.6c1.4.3 1.6 1.3 1.6 2l-1.6 6.4c.1 0 .2.1.4.1l-.4-.1-2.2 8.9c-.2.4-.6 1-1.6.8 0 0-2.5-.6-2.5-.6l-1.7 3.9 4.4 1.1c.8.2 1.6.4 2.4.6l-1.4 5.6 3.4.8 1.4-5.6c.9.3 1.8.5 2.7.7l-1.4 5.5 3.4.8 1.4-5.6c5.8 1.1 10.1.7 11.9-4.6 1.5-4.2-.1-6.7-3.1-8.2 2.2-.5 3.9-2 4.3-5zm-7.7 10.8c-1 4.2-8.1 1.9-10.4 1.4l1.9-7.5c2.3.6 9.6 1.7 8.5 6.1zm1-10.9c-1 3.8-6.9 1.9-8.8 1.4l1.7-6.8c1.9.5 8.1 1.4 7.1 5.4z"/></svg>';

  const progress = document.createElement("div");
  progress.className = "progress";
  stage.appendChild(progress);

  const footer = document.createElement("div");
  footer.className = "footer";
  footer.innerHTML =
    '<div class="brand">' + BTC_ICON + "<span>" + (document.body.dataset.event || "") + "</span></div>" +
    '<div class="section-name"></div>' +
    '<div class="counter"><b class="cur">1</b> / ' + total + "</div>";
  stage.appendChild(footer);
  const footerSection = footer.querySelector(".section-name");
  const footerCur = footer.querySelector(".cur");

  /* ------------------------------------------------------------------------
     Layout
     ------------------------------------------------------------------------ */

  function fit() {
    const s = Math.min(window.innerWidth / W, window.innerHeight / H);
    stage.style.transform = "translate(-50%, -50%) scale(" + s + ")";
  }

  /* ------------------------------------------------------------------------
     Navigation
     ------------------------------------------------------------------------ */

  function render() {
    slides.forEach((s, i) => {
      s.classList.toggle("active", i === index);
      s.classList.toggle("past", i < index);
    });
    applySteps(index, step);

    const slide = slides[index];
    progress.style.width = (total > 1 ? (index / (total - 1)) * 100 : 100) + "%";
    footerSection.textContent = slide.dataset.section || "";
    footerCur.textContent = index + 1;
    stage.classList.toggle("hide-chrome", slide.hasAttribute("data-no-chrome"));

    if (MODE === "deck") {
      const hash = "#" + (index + 1);
      if (location.hash !== hash) history.replaceState(null, "", hash);
      broadcast();
    }
  }

  function go(i, s) {
    index = Math.max(0, Math.min(total - 1, i));
    const max = groupsBySlide[index].length;
    step = s === "all" ? max : Math.max(0, Math.min(max, s || 0));
    render();
  }

  function next() {
    if (step < groupsBySlide[index].length) { step++; render(); }
    else if (index < total - 1) go(index + 1, 0);
  }

  function prev() {
    if (step > 0) { step--; render(); }
    else if (index > 0) go(index - 1, "all");
  }

  function fromHash() {
    const n = parseInt(location.hash.replace("#", ""), 10);
    return Number.isFinite(n) ? n - 1 : 0;
  }

  function broadcast() {
    if (channel) channel.postMessage({ type: "state", index, step });
  }

  function handleNav(action) {
    if (action === "next") next();
    else if (action === "prev") prev();
    else if (action === "first") go(0);
    else if (action === "last") go(total - 1, "all");
  }

  /* ------------------------------------------------------------------------
     Overlays
     ------------------------------------------------------------------------ */

  let overview, help, gotoBox, blank;

  function buildOverlays() {
    overview = document.createElement("div");
    overview.className = "overview";
    overview.innerHTML = '<div class="overview-grid"></div>';
    document.body.appendChild(overview);

    help = document.createElement("div");
    help.className = "help";
    help.innerHTML =
      "<h4>Keyboard shortcuts</h4><table>" +
      "<tr><td><kbd>→</kbd><kbd>Space</kbd></td><td>Next</td></tr>" +
      "<tr><td><kbd>←</kbd></td><td>Previous</td></tr>" +
      "<tr><td><kbd>Home</kbd><kbd>End</kbd></td><td>First / last slide</td></tr>" +
      "<tr><td><kbd>G</kbd></td><td>Go to slide number</td></tr>" +
      "<tr><td><kbd>O</kbd></td><td>Overview</td></tr>" +
      "<tr><td><kbd>S</kbd></td><td>Speaker view</td></tr>" +
      "<tr><td><kbd>F</kbd></td><td>Fullscreen</td></tr>" +
      "<tr><td><kbd>B</kbd></td><td>Blank screen</td></tr>" +
      "<tr><td><kbd>Ctrl</kbd><kbd>P</kbd></td><td>Export PDF</td></tr>" +
      "</table>";
    document.body.appendChild(help);

    gotoBox = document.createElement("div");
    gotoBox.className = "goto";
    gotoBox.innerHTML = '<input type="number" min="1" max="' + total + '" placeholder="Slide #">';
    document.body.appendChild(gotoBox);

    blank = document.createElement("div");
    blank.style.cssText = "position:fixed;inset:0;background:#000;z-index:120;display:none";
    document.body.appendChild(blank);

    const input = gotoBox.querySelector("input");
    input.addEventListener("keydown", (e) => {
      e.stopPropagation();
      if (e.key === "Enter") {
        const n = parseInt(input.value, 10);
        if (Number.isFinite(n)) go(n - 1);
        closeGoto();
      } else if (e.key === "Escape") closeGoto();
    });
  }

  function openOverview() {
    const grid = overview.querySelector(".overview-grid");
    grid.innerHTML = "";
    slides.forEach((s, i) => {
      const thumb = document.createElement("div");
      thumb.className = "thumb" + (i === index ? " current" : "");
      const inner = document.createElement("div");
      inner.className = "thumb-inner";
      inner.style.background = "var(--bg)";
      const clone = s.cloneNode(true);
      clone.classList.add("active");
      clone.classList.remove("past");
      inner.appendChild(clone);
      const num = document.createElement("div");
      num.className = "thumb-num";
      num.textContent = i + 1;
      thumb.appendChild(inner);
      thumb.appendChild(num);
      thumb.addEventListener("click", () => { closeOverview(); go(i); });
      grid.appendChild(thumb);
    });
    overview.classList.add("open");
    requestAnimationFrame(() => {
      grid.querySelectorAll(".thumb").forEach((t) => {
        t.querySelector(".thumb-inner").style.transform = "scale(" + t.clientWidth / W + ")";
      });
      const cur = grid.querySelector(".current");
      if (cur) cur.scrollIntoView({ block: "center" });
    });
  }

  function closeOverview() { overview.classList.remove("open"); }
  function openGoto() {
    gotoBox.classList.add("open");
    const input = gotoBox.querySelector("input");
    input.value = "";
    setTimeout(() => input.focus(), 0);
  }
  function closeGoto() { gotoBox.classList.remove("open"); }

  function toggleFullscreen() {
    if (!document.fullscreenElement) document.documentElement.requestFullscreen().catch(() => {});
    else document.exitFullscreen();
  }

  function openSpeaker() {
    const url = location.pathname + "?speaker#" + (index + 1);
    window.open(url, "bk-speaker", "width=1400,height=860");
  }

  /* ------------------------------------------------------------------------
     Input
     ------------------------------------------------------------------------ */

  function onKey(e, send) {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const k = e.key;
    const act = send || handleNav;

    if (overview && overview.classList.contains("open")) {
      if (k === "Escape" || k === "o" || k === "O") closeOverview();
      return;
    }
    if (help && help.classList.contains("open") && (k === "Escape" || k === "?" || k === "h" || k === "H")) {
      help.classList.remove("open");
      return;
    }
    if (blank && blank.style.display === "block" && (k === "b" || k === "B" || k === "Escape")) {
      blank.style.display = "none";
      return;
    }

    switch (k) {
      case "ArrowRight": case "ArrowDown": case " ": case "PageDown": case "Enter":
        e.preventDefault(); act("next"); break;
      case "ArrowLeft": case "ArrowUp": case "PageUp": case "Backspace":
        e.preventDefault(); act("prev"); break;
      case "Home": e.preventDefault(); act("first"); break;
      case "End": e.preventDefault(); act("last"); break;
      default:
        if (send) return; // speaker window only forwards navigation
        switch (k.toLowerCase()) {
          case "f": toggleFullscreen(); break;
          case "o": openOverview(); break;
          case "s": openSpeaker(); break;
          case "g": e.preventDefault(); openGoto(); break;
          case "b": blank.style.display = "block"; break;
          case "h": case "?": help.classList.toggle("open"); break;
          case "escape": closeGoto(); help.classList.remove("open"); break;
        }
    }
  }

  function bindTouch(target, act) {
    let x0 = null, y0 = null;
    target.addEventListener("touchstart", (e) => {
      x0 = e.touches[0].clientX;
      y0 = e.touches[0].clientY;
    }, { passive: true });
    target.addEventListener("touchend", (e) => {
      if (x0 === null) return;
      const dx = e.changedTouches[0].clientX - x0;
      const dy = e.changedTouches[0].clientY - y0;
      if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) act(dx < 0 ? "next" : "prev");
      x0 = null;
    });
  }

  /* ------------------------------------------------------------------------
     QR codes (optional; needs qrcodejs from the CDN)
     ------------------------------------------------------------------------ */

  function buildQrCodes() {
    document.querySelectorAll("[data-qr]").forEach((el) => {
      if (!window.QRCode) { el.style.display = "none"; return; }
      new window.QRCode(el, {
        text: el.dataset.qr,
        width: 480,
        height: 480,
        colorDark: "#09090b",
        colorLight: "#ffffff",
        correctLevel: window.QRCode.CorrectLevel.M,
      });
    });
  }

  /* ------------------------------------------------------------------------
     Speaker view
     ------------------------------------------------------------------------ */

  function startSpeaker() {
    document.body.className = "speaker";
    const deck = document.querySelector(".deck");
    deck.style.display = "none";

    const base = location.pathname + "?preview";
    const view = document.createElement("div");
    view.className = "speaker-view";
    view.innerHTML =
      '<div class="sv-bar">' +
      '<span class="sv-timer">00:00</span>' +
      '<button class="sv-toggle">Pause</button><button class="sv-reset">Reset</button>' +
      '<span class="sv-clock"></span>' +
      '<span class="sv-pos"></span>' +
      '<span class="sv-status"></span>' +
      "</div>" +
      '<div class="sv-col"><div class="sv-label">Current</div>' +
      '<div class="sv-frame"><iframe class="cur" src="' + base + '#1"></iframe></div></div>' +
      '<div class="sv-col"><div class="sv-label">Next</div>' +
      '<div class="sv-frame next"><iframe class="nxt" src="' + base + '#2"></iframe></div>' +
      '<div class="sv-label">Notes</div><div class="sv-notes"></div></div>';
    document.body.appendChild(view);

    const curFrame = view.querySelector("iframe.cur");
    const nxtFrame = view.querySelector("iframe.nxt");
    const notesEl = view.querySelector(".sv-notes");
    const posEl = view.querySelector(".sv-pos");
    const timerEl = view.querySelector(".sv-timer");
    const clockEl = view.querySelector(".sv-clock");
    const statusEl = view.querySelector(".sv-status");

    let started = null, elapsedBefore = 0, running = false;
    const pad = (n) => String(n).padStart(2, "0");

    function tick() {
      const ms = elapsedBefore + (running ? Date.now() - started : 0);
      const t = Math.floor(ms / 1000);
      timerEl.textContent = (t >= 3600 ? Math.floor(t / 3600) + ":" : "") + pad(Math.floor((t % 3600) / 60)) + ":" + pad(t % 60);
      const d = new Date();
      clockEl.textContent = pad(d.getHours()) + ":" + pad(d.getMinutes());
    }
    function startTimer() { if (!running) { running = true; started = Date.now(); } }
    view.querySelector(".sv-toggle").addEventListener("click", (e) => {
      if (running) { elapsedBefore += Date.now() - started; running = false; e.target.textContent = "Resume"; }
      else { startTimer(); e.target.textContent = "Pause"; }
    });
    view.querySelector(".sv-reset").addEventListener("click", () => {
      elapsedBefore = 0; started = Date.now();
    });
    setInterval(tick, 500);
    tick();

    function show(i, s) {
      index = i; step = s;
      const post = (frame, msg) => {
        const send = () => frame.contentWindow && frame.contentWindow.postMessage(msg, "*");
        send();
        frame.addEventListener("load", send, { once: true });
      };
      post(curFrame, { type: "goto", index: i, step: s });
      if (i + 1 < total) {
        nxtFrame.style.visibility = "visible";
        post(nxtFrame, { type: "goto", index: i + 1, step: 0 });
      } else {
        nxtFrame.style.visibility = "hidden";
      }
      const notes = slides[i].querySelector(".notes");
      notesEl.innerHTML = notes ? notes.innerHTML : '<p class="dim">No notes.</p>';
      const steps = groupsBySlide[i].length;
      posEl.textContent = "Slide " + (i + 1) + " / " + total + (steps ? "  ·  step " + s + " / " + steps : "");
    }

    const send = (action) => {
      startTimer();
      if (channel) channel.postMessage({ type: "nav", action });
    };

    if (channel) {
      statusEl.textContent = "";
      channel.onmessage = (e) => {
        if (e.data && e.data.type === "state") show(e.data.index, e.data.step);
      };
      channel.postMessage({ type: "hello" });
    } else {
      statusEl.textContent = "Sync unavailable: serve over http:// (python3 -m http.server)";
    }

    document.addEventListener("keydown", (e) => onKey(e, send));
    show(fromHash(), 0);
  }

  /* ------------------------------------------------------------------------
     Boot
     ------------------------------------------------------------------------ */

  function boot() {
    buildCodeBlocks(document);
    buildQrCodes();

    if (MODE === "speaker") { startSpeaker(); return; }

    fit();
    window.addEventListener("resize", fit);
    layoutCode(document);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => layoutCode(document));

    if (MODE === "preview") {
      document.body.classList.add("preview");
      window.addEventListener("message", (e) => {
        if (e.data && e.data.type === "goto") go(e.data.index, e.data.step);
      });
      go(fromHash(), 0);
      return;
    }

    buildOverlays();
    document.addEventListener("keydown", (e) => onKey(e));
    bindTouch(document, handleNav);
    window.addEventListener("hashchange", () => {
      const i = fromHash();
      if (i !== index) go(i);
    });
    if (channel) {
      channel.onmessage = (e) => {
        if (!e.data) return;
        if (e.data.type === "nav") handleNav(e.data.action);
        else if (e.data.type === "hello") broadcast();
      };
    }

    go(fromHash(), 0);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
