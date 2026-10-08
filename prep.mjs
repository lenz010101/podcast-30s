// prep.mjs — extrae el segmento del podcast: crop 9:16 centrado en el sujeto
// izquierdo, denoise + grade + viñeta, upscale 1080x1920, audio limpio y palabras
// del tramo (smp_170.json, origen 170s) rebaseadas a t=0 del segmento.
import fs from "fs";
import { execFileSync } from "child_process";

const cfg = JSON.parse(fs.readFileSync("./config.json", "utf8"));
const SRC = "C:\\Users\\Admin\\Downloads\\MATEOYDIEGOMAR_PODCASTPRIME STEAKII.mp4";
const SMP = process.env.TEMP + "\\opencode\\gymstudy\\smp_170.json"; // origen 170s
const SMP_ORIGIN = 170;
const dur = cfg.segDur ?? 30;
const x = cfg.cropX ?? 328;
const off = SMP_ORIGIN - cfg.segStart; // smp_time + off = segment_time

// 1) video: crop 405x720 -> denoise -> grade -> lanczos 1080x1920 -> sharpen -> vignette
const vf = [
  `crop=405:720:${x}:0`,
  "hqdn3d=2:1.5:4:4",
  "eq=contrast=1.07:saturation=0.88:gamma=0.98",
  "colorbalance=rs=-0.03:bs=0.04",
  "scale=1080:1920:flags=lanczos",
  "unsharp=5:5:0.7",
  "vignette=PI/3.8",
].join(",");
// NOTA: -ss va DESPUES de -i (output-seek). El input-seek en este archivo roto
// aterriza 1s tarde en contenido en el video (y escribe un elst con edit vacio
// de 1s que congelaba el primer segundo). Output-seek = decode+drop exacto.
execFileSync("ffmpeg", ["-y", "-i", SRC, "-ss", String(cfg.segStart), "-t", String(dur + 0.05),
  "-an", "-vf", vf, "-c:v", "libx264", "-crf", "18", "-preset", "medium", "-pix_fmt", "yuv420p",
  "assets\\vid\\seg.mp4"], { stdio: "ignore" });
console.log("seg.mp4 ok");

// 2) audio del segmento (output-seek tambien; verificado +-13ms vs input-seek)
execFileSync("ffmpeg", ["-y", "-i", SRC, "-ss", String(cfg.segStart), "-t", String(dur),
  "-vn", "-c:a", "aac", "-b:a", "192k", "assets\\vo.m4a"], { stdio: "ignore" });
console.log("vo.m4a ok");

// 3) palabras: smp_170 (origen 170s) -> rebased al segmento
const d = JSON.parse(fs.readFileSync(SMP, "utf8"));
const words = [];
for (const seg of d.transcription) {
  let cur = null;
  for (const t of seg.tokens ?? []) {
    if (t.text.startsWith("[_")) continue;
    const s = t.offsets.from / 1000;
    const e = t.offsets.to / 1000;
    if (t.text.startsWith(" ")) {
      if (cur) words.push(cur);
      cur = { text: t.text.trim(), start: s, end: e };
    } else if (!cur) cur = { text: t.text, start: s, end: e };
    else { cur.text += t.text; cur.end = e; }
  }
  if (cur) words.push(cur);
}
const segWords = words
  .map((w) => ({ text: w.text, start: +(w.start + off).toFixed(2), end: +(w.end + off).toFixed(2) }))
  .filter((w) => w.start >= -0.15 && w.start < dur - 0.05);
fs.writeFileSync("./transcript_seg.json", JSON.stringify(segWords, null, 1));
console.log(`seg words=${segWords.length} ${segWords[0]?.start} -> ${segWords.at(-1)?.end}`);
