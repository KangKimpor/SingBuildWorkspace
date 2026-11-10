// Prepares docs/figma/lib-doc.js — the version of lib.js that can be eval'd
// from Figma shared plugin data (global scope, so no top-level `await`).
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const src = path.join(root, "docs/figma/lib.js");
const out = path.join(root, "docs/figma/lib-doc.js");

const lines = fs.readFileSync(src, "utf8").split("\n");
const idx = lines.findIndex((l) => l.includes("await Promise.all(FONTS.map"));
if (idx === -1) throw new Error("font loader line not found");

lines[idx] =
  "function bootFonts() { return Promise.all(FONTS.map(function (s) { return figma.loadFontAsync({ family: 'Inter', style: s }); })); }";

fs.writeFileSync(out, lines.join("\n"), "utf8");
console.log("wrote", out, fs.statSync(out).size, "bytes");
