// build.mjs — podcast-30s: crop/grade ya horneados en seg.mp4; acá la edición
// kinetic: captions Montserrat Black palabra-palabra con highlights, título fijo,
// punch-ins, pan&scan, cards keyword, b-roll y SFX.
import fs from "fs";

const cfg = JSON.parse(fs.readFileSync("./config.json", "utf8"));
const words = JSON.parse(fs.readFileSync("./transcript_seg.json", "utf8"));
const TOTAL = +(cfg.segDur ?? 30).toFixed(2);
words.forEach((w, i) => (w._i = i));

// ---- beats: máx 3 palabras, corte por puntuación o pausa ----
const beats = [];
let cur = [];
const flush = () => { if (cur.length) beats.push(cur); cur = []; };
for (const w of words) {
  cur.push(w);
  const nx = words[w._i + 1];
  const gap = nx ? nx.start - w.end : 9;
  if (cur.length >= 3 || /[.!?,:;]$/.test(w.text) || gap > 0.42) flush();
}
flush();
beats.forEach((b) => {
  b._t0 = +b[0].start.toFixed(2);
  b._t1 = +(b[b.length - 1].end + 0.1).toFixed(2);
});
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;");
const norm = (s) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9 ]/g, "");
const HL = new Set((cfg.hl ?? []).map((s) => norm(s)));
const HL2 = new Set((cfg.hl2 ?? []).map((s) => norm(s)));
const inWin = (t, wins) => (wins ?? []).some((w) => t >= w[0] && t < w[1]);
const cardWins = (cfg.cards ?? []).map((c) => [c.t, c.t + (c.dur ?? 0.6)]);

// ---- clips ----
let clips = "", tweens = "", sfx = "";

// escenario: video con headroom para pan + punch
clips += `      <div id="stage" class="clip"><video id="vid" src="assets/vid/seg.mp4" muted playsinline preload="auto" data-start="0" data-duration="${TOTAL}" data-playback-rate="1.00000"></video></div>\n`;

// b-roll encima del video, debajo de captions
(cfg.broll ?? []).forEach((b, i) => {
  clips += `      <video id="br${i}" class="clip br" src="assets/vid/${b.src}" playsinline preload="auto" data-start="${b.t}" data-duration="${b.dur}"></video>\n`;
  tweens += `      tl.fromTo("#br${i}", { opacity: 0, scale: 1.06 }, { opacity: 1, scale: 1, duration: .18, ease: "power2.out", immediateRender: false }, ${b.t});\n`;
  tweens += `      tl.to("#br${i}", { opacity: 0, duration: .14, ease: "power2.in" }, ${+(b.t + b.dur - 0.14).toFixed(2)});\n`;
  sfx += `      <audio id="sbr${i}" src="assets/sfx/whoosh.mp3" data-start="${b.t}" data-duration="0.51" data-volume="0.5"></audio>\n`;
});

// título fijo arriba (estilo ref): dos líneas, fondo negro, línea 2 en oro
if (cfg.title) {
  const lines = String(cfg.title).split("|");
  const inner = lines.map((l, i) => `<div class="tl${i ? " l2" : ""}">${esc(l)}</div>`).join("");
  clips += `      <div id="titleWrap"><div id="title">${inner}</div></div>\n`;
  tweens += `      tl.fromTo("#title", { opacity: 0, y: -76, scale: .68, rotate: -3 }, { opacity: 1, y: 0, scale: 1, rotate: 0, duration: .45, ease: "back.out(2.4)", immediateRender: false }, 0.15);\n`;
  sfx += `      <audio id="sti" src="assets/sfx/pop.mp3" data-start="0.15" data-duration="0.62" data-volume="0.55"></audio>\n`;
}

// ---- floaters: número grande flotando junto a la cara (no cubre todo) ----
(cfg.floaters ?? []).forEach((f, i) => {
  const dur = f.dur ?? 0.9;
  const rot = f.rot ?? -10;
  const floatDur = +((dur - 0.35) / 2).toFixed(2);
  clips += `      <div id="fl${i}" class="clip" data-start="${f.t}" data-duration="${dur}"><div class="floatBox" id="fb${i}" style="left:${f.x}px;top:${f.y}px;color:${f.color ?? "#7CFFB2"};font-size:${f.fs ?? 250}px">${esc(f.word)}</div></div>\n`;
  tweens += `      tl.fromTo("#fb${i}", { opacity: 0, scale: .3, rotate: ${rot - 18} }, { opacity: 1, scale: 1, rotate: ${rot}, duration: .3, ease: "back.out(3)", immediateRender: false }, ${f.t});\n`;
  tweens += `      tl.to("#fb${i}", { y: -20, duration: ${floatDur}, ease: "sine.inOut", yoyo: true, repeat: 1 }, ${+(f.t + 0.3).toFixed(2)});\n`;
  tweens += `      tl.to("#fb${i}", { opacity: 0, scale: .7, duration: .15, ease: "power2.in" }, ${+(f.t + dur - 0.15).toFixed(2)});\n`;
  sfx += `      <audio id="sfl${i}" src="assets/sfx/pop.mp3" data-start="${f.t}" data-duration="0.62" data-volume="0.7"></audio>\n`;
});

// whoosh de apertura
sfx += `      <audio id="sopen" src="assets/sfx/whoosh.mp3" data-start="0.03" data-duration="0.51" data-volume="0.45"></audio>\n`;

// ---- captions kinéticas ----
beats.forEach((b, i) => {
  const beatHit = cardWins.some((w) => b._t0 < w[1] && b._t1 > w[0]);
  if (beatHit) return; // tapado por card -> no emitir
  const nxT = beats[i + 1] ? beats[i + 1]._t0 : TOTAL;
  const end = +Math.min(TOTAL, b._t1 + 0.25, nxT - 0.03).toFixed(2);
  if (end - b._t0 < 0.14) return;
  const totch = b.reduce((a, w) => a + w.text.length, 0);
  const fs = totch <= 10 ? 100 : totch <= 18 ? 90 : totch <= 26 ? 80 : 70;
  const inner = b.map((w, k) => {
    const n = norm(w.text);
    const c = HL.has(n) ? " hl" : HL2.has(n) ? " hl2" : "";
    return `<span class="w${c}" id="cp${i}w${k}">${esc(w.text)}</span>`;
  }).join(" ");
  clips += `      <div id="cp${i}" class="clip" data-start="${b._t0}" data-duration="${+(end - b._t0).toFixed(2)}"><div class="group" data-layout-allow-overlap><div class="ln" style="font-size:${fs}px">${inner}</div></div></div>\n`;
  b.forEach((w, k) => {
    tweens += `      tl.fromTo("#cp${i}w${k}", { opacity: 0, scale: .5, y: 16 }, { opacity: 1, scale: 1, y: 0, duration: .15, ease: "back.out(3)", immediateRender: false }, ${+(b._t0 + k * 0.055).toFixed(2)});\n`;
  });
  if (end - b._t0 > 0.32) tweens += `      tl.to("#cp${i}", { opacity: 0, duration: .1, ease: "power2.in" }, ${+(end - 0.1).toFixed(2)});\n`;
});

// ---- cards keyword (apoyo visual) ----
(cfg.cards ?? []).forEach((c, i) => {
  const dur = c.dur ?? 0.6;
  clips += `      <div id="cd${i}" class="clip card" style="background:${c.bg ?? "#0C0C0C"}" data-start="${c.t}" data-duration="${dur}"><div class="cword" id="cdw${i}" style="color:${c.fg ?? "#FFD700"};font-size:${c.fs ?? 172}px">${esc(c.word)}</div></div>\n`;
  tweens += `      tl.fromTo("#cdw${i}", { opacity: 0, scale: .55, rotate: -4 }, { opacity: 1, scale: 1, rotate: 0, duration: .2, ease: "back.out(3)", immediateRender: false }, ${c.t});\n`;
  tweens += `      tl.to("#cd${i}", { opacity: 0, scale: .9, duration: .13, ease: "power2.in" }, ${+(c.t + dur - 0.13).toFixed(2)});\n`;
  sfx += `      <audio id="scd${i}" src="assets/sfx/whoosh-big.mp3" data-start="${c.t}" data-duration="1.0" data-volume="0.55"></audio>\n`;
});

// ---- pan & scan (keyframes de x sobre el video) ----
(cfg.pan ?? []).forEach((p, i, arr) => {
  if (i === 0) return;
  const [t0, v0] = arr[i - 1], [t1, v1] = p;
  tweens += `      tl.fromTo("#vid", { x: ${v0} }, { x: ${v1}, duration: ${+(t1 - t0).toFixed(2)}, ease: "sine.inOut", immediateRender: false }, ${t0});\n`;
});

// ---- punch-ins ----
(cfg.punches ?? []).forEach((p, i) => {
  const up = p.up ?? 0.22, hold = p.hold ?? 0.6, down = p.down ?? 0.42, s = p.s ?? 1.19;
  tweens += `      tl.to("#stage", { scale: ${s}, duration: ${up}, ease: "power2.out" }, ${p.t});\n`;
  tweens += `      tl.to("#stage", { scale: 1, duration: ${down}, ease: "power2.inOut" }, ${+(p.t + up + hold).toFixed(2)});\n`;
  sfx += `      <audio id="sp${i}" src="assets/sfx/pop.mp3" data-start="${p.t}" data-duration="0.62" data-volume="0.7"></audio>\n`;
});

// ---- bass drops ----
(cfg.bass ?? []).forEach((t, i) => {
  sfx += `      <audio id="sb${i}" src="assets/sfx/bass.mp3" data-start="${t}" data-duration="1.0" data-volume="0.8"></audio>\n`;
});

// ---- fin: dip corto ----
clips += `      <div id="dip"></div>\n`;
tweens += `      tl.fromTo("#dip", { opacity: 0 }, { opacity: 1, duration: .14, ease: "power2.in", immediateRender: false }, ${+(TOTAL - 0.14).toFixed(2)});\n`;

const html = `<!doctype html>
<html lang="es" data-resolution="portrait">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=1080, height=1920" />
    <script src="assets/gsap.min.js"></script>
    <style>
      @font-face { font-family: "Mont"; src: url("assets/fonts/Montserrat-var.ttf") format("truetype"); font-weight: 100 900; }
      @font-face { font-family: "Bebas"; src: url("assets/fonts/BebasNeue-Regular.ttf") format("truetype"); }
      * { margin: 0; padding: 0; box-sizing: border-box; }
      html, body { margin: 0; width: 1080px; height: 1920px; overflow: hidden; background: #000; }
      #root { position: relative; width: 1080px; height: 1920px; overflow: hidden; background: #000; }
      .clip { position: absolute; left: 0; top: 0; width: 1080px; height: 1920px; overflow: hidden; }
      #stage { will-change: transform; transform-origin: ${cfg.punchOrigin ?? "52% 38%"}; }
      #vid { position: absolute; left: -8%; top: -8%; width: 116%; height: 116%;
        object-fit: cover; background: #000; will-change: transform; }
      .br { object-fit: cover; background: #000; }
      #titleWrap { position: absolute; left: 0; top: 64px; width: 1080px; display: flex;
        justify-content: center; z-index: 5; }
      #title { background: #0C0C0C; padding: 16px 36px 22px; text-align: center;
        will-change: transform, opacity; box-shadow: 0 10px 34px rgba(0,0,0,.55); }
      .tl { font: 900 66px/1.04 "Mont", sans-serif; color: #fff; letter-spacing: .5px;
        white-space: nowrap; text-shadow: none; }
      .tl.l2 { color: #FFD700; }
      .group { position: absolute; left: 0; top: 1080px; width: 1080px; height: 460px;
        display: flex; align-items: center; justify-content: center; padding: 0 48px; }
      .ln { text-align: center; line-height: 1.14; color: #fff; font-family: "Mont", sans-serif;
        font-weight: 900; letter-spacing: -1px; max-width: 984px;
        -webkit-text-stroke: 4px #0A0A0A; paint-order: stroke fill;
        text-shadow: 0 4px 18px rgba(0,0,0,.7), 0 1px 4px rgba(0,0,0,.9); }
      .ln .w { display: inline-block; opacity: 0; will-change: transform, opacity; }
      .ln .hl { color: #FFD700; font-size: 1.13em;
        text-shadow: 0 4px 18px rgba(0,0,0,.7), 0 0 34px rgba(255,215,0,.45); }
      .ln .hl2 { color: #7CFFB2; font-size: 1.13em;
        text-shadow: 0 4px 18px rgba(0,0,0,.7), 0 0 34px rgba(124,255,178,.4); }
      .floatBox { position: absolute; font: 900 250px/0.95 "Mont", sans-serif; letter-spacing: -6px;
        opacity: 0; will-change: transform, opacity; text-shadow: 0 10px 38px rgba(0,0,0,.65);
        -webkit-text-stroke: 5px #0A0A0A; paint-order: stroke fill; }
      .card { display: flex; align-items: center; justify-content: center; z-index: 8; }
      .cword { font: 900 172px "Mont", sans-serif; letter-spacing: -2px; text-align: center;
        line-height: 1.02; padding: 0 40px; opacity: 0; will-change: transform, opacity;
        text-shadow: 0 0 60px rgba(0,0,0,.4); }
      #dip { position: absolute; left: 0; top: 0; width: 1080px; height: 1920px;
        background: #000; opacity: 0; z-index: 30; }
    </style>
  </head>
  <body>
    <div id="root" data-composition-id="main" data-start="0" data-duration="${TOTAL}" data-width="1080" data-height="1920">
      <audio id="voice" src="assets/vo.m4a" data-start="0" data-duration="${TOTAL}" data-media-start="0.00" data-playback-rate="1.00000"></audio>
${sfx}${clips}    </div>
    <script>
      window.__timelines = window.__timelines || {};
      const tl = gsap.timeline({ paused: true });
      window.__timelines["main"] = tl;
${tweens}      tl.seek(0);
    </script>
  </body>
</html>
`;
fs.writeFileSync("index.html", html);
console.log(`beats=${beats.length} cards=${(cfg.cards ?? []).length} punches=${(cfg.punches ?? []).length} wrote index.html total=${TOTAL}`);
