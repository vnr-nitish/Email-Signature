// Recolors the social icon PNGs (a solid-color circle + white glyph) to a
// custom color for non-default signatures, entirely client-side via
// canvas pixel replacement — no server round-trip, and the result is a
// self-contained data: URI, so it needs no hosting of its own and works
// immediately in a copied signature.
//
// How it works: every pixel close to the source teal is swapped for the
// target color; anything else (the white glyph, transparent background)
// is left untouched. This is a color *replacement*, not a true recolor of
// the drawing — a thin ring of anti-aliased pixels right at the edge
// between teal and white/transparent won't perfectly match the new color,
// but at the 26x26px size these render at in a signature, that's not
// visible in practice.

import { DEFAULT_ICON_COLOR } from "./signature-template.js";

const ICON_NAMES = ["linkedin", "instagram", "youtube", "facebook", "twitter"];
const SOURCE_COLOR = hexToRgb(DEFAULT_ICON_COLOR);
const MATCH_TOLERANCE = 90; // sum of abs channel differences

// Cache recolored results per color (and the plain default-color icons)
// so switching back and forth, or re-rendering repeatedly, doesn't redo
// the pixel work every time.
const cache = new Map(); // color -> { linkedin: dataUri, ... }

function hexToRgb(hex) {
  const clean = hex.replace("#", "");
  return {
    r: parseInt(clean.slice(0, 2), 16),
    g: parseInt(clean.slice(2, 4), 16),
    b: parseInt(clean.slice(4, 6), 16),
  };
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

async function recolorOne(iconName, target) {
  const img = await loadImage(`assets/icons/${iconName}.png`);
  const canvas = document.createElement("canvas");
  canvas.width = img.width;
  canvas.height = img.height;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(img, 0, 0);

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] === 0) continue; // fully transparent, leave alone
    const dist = Math.abs(data[i] - SOURCE_COLOR.r) + Math.abs(data[i + 1] - SOURCE_COLOR.g) + Math.abs(data[i + 2] - SOURCE_COLOR.b);
    if (dist <= MATCH_TOLERANCE) {
      data[i] = target.r;
      data[i + 1] = target.g;
      data[i + 2] = target.b;
    }
  }
  ctx.putImageData(imageData, 0, 0);
  return canvas.toDataURL("image/png");
}

// Returns { linkedin: dataUri, instagram: dataUri, ... } for the given
// hex color, or null if it's the default color (meaning: just use the
// plain shipped PNGs, no override needed).
export async function getIconUrls(hexColor) {
  const color = hexColor || DEFAULT_ICON_COLOR;
  if (color.toLowerCase() === DEFAULT_ICON_COLOR.toLowerCase()) return null;

  if (cache.has(color)) return cache.get(color);

  const target = hexToRgb(color);
  const entries = await Promise.all(ICON_NAMES.map(async (name) => [name, await recolorOne(name, target)]));
  const result = Object.fromEntries(entries);
  cache.set(color, result);
  return result;
}
