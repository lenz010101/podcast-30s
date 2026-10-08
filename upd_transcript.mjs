// Actualiza transcript_seg.json desde una transcripcion whisper de vo.m4a
// (times ya son relativos al inicio del clip = tiempo de composicion, sin rebase).
import fs from "fs";

const src = process.argv[2]; // p.ej. %TEMP%\opencode\gymstudy\vo_small.json
const d = JSON.parse(fs.readFileSync(src, "utf8"));
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
    } else if (!cur) cur = { text: t.text.trim(), start: s, end: e };
    else { cur.text += t.text; cur.end = e; }
  }
  if (cur) words.push(cur);
}
const segWords = words
  .map((w) => ({ text: w.text, start: +w.start.toFixed(2), end: +w.end.toFixed(2) }))
  .filter((w) => w.start >= -0.15 && w.start < 29.95);
fs.writeFileSync("./transcript_seg.json", JSON.stringify(segWords, null, 1));
console.log(`transcript_seg.json: ${segWords.length} palabras ${segWords[0]?.start} -> ${segWords.at(-1)?.end}`);
console.log("TEXT:", segWords.map((w) => w.text).join(" "));
// momentos de interes para sincronizar floaters
for (const w of segWords) {
  if (/^(10|7|3|tres)$/.test(w.text)) console.log(`  numero "${w.text}" @ ${w.start}`);
}
