// Captures Trackmania's own label glyphs from the running game (needs the bridge plugin) into
// examples/themed/glyphs.png + glyphs.json, for the design mockups. Run: bun run design:capture-glyphs
//
// Model (verified in game): glyphs are drawn at continuous sub-pixel positions and each pixel is a
// function of (pixel - glyph origin), so one N× oversampled coverage image per glyph (captured from
// N×N phase shots) reproduces any position with bicubic sampling. Pens advance by a fixed fractional
// width per character (digits are tabular).
import { execFileSync } from "node:child_process";
import { readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { PNG } from "pngjs";
import { Bridge } from "./bridge-client.ts";
import { bridgeRoot } from "./bridge-paths.ts";
import { decodeTga } from "./tga.ts";

const N = 4; // oversampling per axis
const outDir = join(import.meta.dir, "../examples/themed");

type Style = { font: string; ts: number; scale: number };
type Glyph = { P: Uint8Array; w: number; h: number; ox: number; oy: number };
type Model = Style & {
  glyphs: Map<string, Glyph>;
  runs: Map<string, Glyph>;
  adv: Record<string, number>;
  centerDy: number;
  rightDx: number;
};

// Text the mockups draw per style (see examples/themed/DESIGN.md)
const names = ["Wirtual", "Scrapie", "Massa", "Gwen", "You"];
const times = ["0:24.512", "0:24.689", "0:24.731", "0:24.902", "0:25.118"];
const body = ["Nadeo", "1", "2", "3", "4", "5", ...names];
const sets = (titleSize: number, scale: number) => [
  { font: "GameFontSemiBold", ts: titleSize, scale, strings: ["A01 - Green Plains", "", ""] },
  { font: "GameFontRegular", ts: 1, scale, strings: body },
  { font: "GameFontSemiBold", ts: 1.5, scale, strings: ["Records", "Top times"] },
  { font: "GameFontSemiBold", ts: 1, scale, strings: times },
];
const styleKey = (s: Style) => `${s.font === "GameFontSemiBold" ? "sb" : "r"}-${s.ts}@${s.scale}`;
const TITLE = "A01 - Green Plains";
const STYLES = [...sets(3, 1), ...sets(2, 0.8)];
// The compact title (textsize 2, label size 25 at scale 0.8) overflows and the game shrinks it, so it is
// captured as a whole-string run instead of per glyph
const RUNS = [{ style: "sb-2@0.8", size: 25, text: TITLE }];

const bridge = new Bridge(bridgeRoot().storage);
const px2x = (p: number) => p / 6 - 160;
const px2y = (p: number) => 90 - p / 6;
const num = (v: number) => v.toFixed(7);

async function screenshot(xml: string) {
  const full = `<manialink id="glyphs" version="3"><quad pos="-160 90" size="320 180" z-index="-1" bgcolor="000"/>${xml}</manialink>`;
  await bridge.show("glyphs", full, { hideOthers: true, waitFrames: 20 });
  let shot;
  for (let attempt = 0; ; attempt++) {
    try {
      shot = await bridge.screenshot({ width: 1920, height: 1080 });
      break;
    } catch (error) {
      if (attempt >= 3) throw error;
      await Bun.sleep(1000);
    }
  }
  const path = execFileSync("wslpath", ["-u", shot.path]).toString().trim();
  const img = decodeTga(new Uint8Array(readFileSync(path)));
  rmSync(path, { force: true });
  return img;
}

type Item = { style: Style; text: string; extra?: string; fx: number; fy: number };
// Draws each item in its own cw×ch cell, label origin at (offX+fx, offY+fy); returns luminance crops
async function renderCells(items: Item[], cw: number, ch: number, offX: number, offY: number) {
  const cols = Math.floor(1920 / cw),
    perShot = cols * Math.floor(1080 / ch);
  const crops: Uint8Array[] = [];
  for (let i0 = 0; i0 < items.length; i0 += perShot) {
    const batch = items.slice(i0, i0 + perShot);
    let xml = "";
    batch.forEach((it, i) => {
      const X = (i % cols) * cw + offX + it.fx,
        Y = Math.floor(i / cols) * ch + offY + it.fy;
      const s = it.style;
      xml += `<frame pos="${num(px2x(X))} ${num(px2y(Y))}" scale="${s.scale}"><label pos="0 0" text="${it.text}" textsize="${s.ts}" textfont="${s.font}" textcolor="FFF" ${it.extra ?? ""}/></frame>`;
    });
    const img = await screenshot(xml);
    batch.forEach((_, i) => {
      const cx = (i % cols) * cw,
        cy = Math.floor(i / cols) * ch,
        crop = new Uint8Array(cw * ch);
      for (let y = 0; y < ch; y++)
        for (let x = 0; x < cw; x++) crop[y * cw + x] = img.pixels[((cy + y) * 1920 + cx + x) * 4]!;
      crops.push(crop);
    });
  }
  return crops;
}

const GOFF = 16; // label origin offset inside the capture cell
// Captures N× oversampled coverage images (one per item) from N×N sub-pixel phase shots
async function captureImages(style: Style, labels: { text: string; extra?: string }[], cw: number) {
  const GH = 72,
    items: Item[] = [];
  for (const l of labels)
    for (let jy = 0; jy < N; jy++)
      for (let jx = 0; jx < N; jx++)
        items.push({ style, text: l.text, extra: l.extra, fx: jx / N, fy: jy / N });
  const crops = await renderCells(items, cw, GH, GOFF, GOFF);
  const out: Glyph[] = [];
  const SW = cw * N,
    SH = GH * N;
  labels.forEach((_, ci) => {
    const full = new Uint8Array(SW * SH);
    for (let j = 0; j < N * N; j++) {
      const crop = crops[ci * N * N + j]!,
        jx = j % N,
        jy = Math.floor(j / N);
      for (let my = 0; my < GH; my++)
        for (let mx = 0; mx < cw; mx++) {
          const qx = N * mx - jx + N,
            qy = N * my - jy + N;
          if (qx < SW && qy < SH) full[qy * SW + qx] = crop[my * cw + mx]!;
        }
    }
    let x0 = 1e9,
      x1 = -1,
      y0 = 1e9,
      y1 = -1;
    for (let y = 0; y < SH; y++)
      for (let x = 0; x < SW; x++)
        if (full[y * SW + x]) {
          x0 = Math.min(x0, x);
          x1 = Math.max(x1, x);
          y0 = Math.min(y0, y);
          y1 = Math.max(y1, y);
        }
    if (x1 < 0) return out.push({ P: new Uint8Array(0), w: 0, h: 0, ox: 0, oy: 0 });
    x0 = Math.max(0, x0 - 1);
    y0 = Math.max(0, y0 - 1);
    x1++;
    y1++;
    const w = x1 - x0 + 1,
      h = y1 - y0 + 1,
      P = new Uint8Array(w * h);
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) P[y * w + x] = full[(y0 + y) * SW + x0 + x]!;
    out.push({ P, w, h, ox: x0 - N - N * GOFF, oy: y0 - N - N * GOFF });
  });
  return out;
}
async function captureGlyphs(style: Style, chars: string[]) {
  const images = await captureImages(
    style,
    chars.map((text) => ({ text })),
    72,
  );
  return new Map(chars.map((c, i) => [c, images[i]!]));
}

const cr = (p0: number, p1: number, p2: number, p3: number, t: number) =>
  p1 + 0.5 * t * (p2 - p0 + t * (2 * p0 - 5 * p1 + 4 * p2 - p3 + t * (3 * (p1 - p2) + p3 - p0)));
function sample(g: Glyph, X: number, Y: number, k: number, l: number) {
  const fx = (k - X) * N - g.ox,
    fy = (l - Y) * N - g.oy;
  const ix = Math.floor(fx),
    iy = Math.floor(fy),
    tx = fx - ix,
    ty = fy - iy;
  const at = (x: number, y: number) =>
    x < 0 || y < 0 || x >= g.w || y >= g.h ? 0 : g.P[y * g.w + x]!;
  const rows: number[] = [];
  for (let dy = -1; dy <= 2; dy++)
    rows.push(
      cr(at(ix - 1, iy + dy), at(ix, iy + dy), at(ix + 1, iy + dy), at(ix + 2, iy + dy), tx),
    );
  return Math.max(0, Math.min(255, cr(rows[0]!, rows[1]!, rows[2]!, rows[3]!, ty)));
}

const total = (m: Model, text: string) => [...text].reduce((a, c) => a + (m.adv[c] ?? 0), 0);
// Renders text into a cw×ch alpha buffer (0..255); (X,Y) is the label pos in buffer pixels
function renderText(
  m: Model,
  text: string,
  X: number,
  Y: number,
  cw: number,
  ch: number,
  align = "left",
  valign = "top",
) {
  const a = new Float32Array(cw * ch);
  let pen = align === "right" ? X - total(m, text) + m.rightDx : X;
  const y0 = valign === "center" ? Y + m.centerDy : Y;
  for (const c of text) {
    const g = m.glyphs.get(c);
    if (g && g.w) {
      const kx0 = Math.max(0, Math.floor(pen + g.ox / N) - 1),
        kx1 = Math.min(cw - 1, Math.ceil(pen + (g.ox + g.w) / N) + 1);
      const ky0 = Math.max(0, Math.floor(y0 + g.oy / N) - 1),
        ky1 = Math.min(ch - 1, Math.ceil(y0 + (g.oy + g.h) / N) + 1);
      for (let l = ky0; l <= ky1; l++)
        for (let k = kx0; k <= kx1; k++) {
          const v = sample(g, pen, y0, k, l) / 255,
            i = l * cw + k;
          a[i] = v + a[i]! * (1 - v); // over blend
        }
    }
    pen += m.adv[c] ?? 0;
  }
  return a;
}
const err = (a: Float32Array, lum: Uint8Array) => {
  let e = 0;
  for (let i = 0; i < a.length; i++) e += Math.abs(a[i]! * 255 - lum[i]!);
  return e;
};
// 1D minimizer: coarse scan, then successive refinement
function minimize(f: (v: number) => number, lo: number, hi: number, coarse: number) {
  let best = lo,
    bestE = Infinity;
  for (let v = lo; v <= hi; v += coarse) {
    const e = f(v);
    if (e < bestE) {
      bestE = e;
      best = v;
    }
  }
  for (let step = coarse / 4; step > 0.0005; step /= 4)
    for (let v = best - step * 4; v <= best + step * 4; v += step) {
      const e = f(v);
      if (e < bestE) {
        bestE = e;
        best = v;
      }
    }
  return { v: best, e: bestE };
}

const RW = 360,
  RH = 72,
  RX = 8,
  RY = 14; // run cell (advance fits), label origin offset
async function measure(style: Style, glyphs: Map<string, Glyph>, chars: string[]): Promise<Model> {
  const m: Model = { ...style, glyphs, runs: new Map(), adv: {}, centerDy: 0, rightDx: 0 };
  const fx = 0.3,
    fy = 0.2,
    REP = 8;
  const probe = chars.find((c) => glyphs.get(c)?.w)!;
  const spaced = Array(REP).fill(probe).join(" ");
  const items: Item[] = chars.map((c) => ({ style, text: c.repeat(REP), fx, fy }));
  items.push({ style, text: spaced, fx, fy });
  const crops = await renderCells(items, RW, RH, RX, RY);
  chars.forEach((c, i) => {
    const fit = minimize(
      (adv) => {
        m.adv[c] = adv;
        return err(renderText(m, c.repeat(REP), RX + fx, RY + fy, RW, RH), crops[i]!);
      },
      1,
      40,
      0.1,
    );
    m.adv[c] = fit.v;
    if (fit.e > 2500)
      console.warn(
        `  warn: advance fit for U+${c.codePointAt(0)!.toString(16)} left error ${fit.e.toFixed(0)}`,
      );
  });
  const sp = minimize(
    (adv) => {
      m.adv[" "] = adv;
      return err(renderText(m, spaced, RX + fx, RY + fy, RW, RH), crops[chars.length]!);
    },
    1,
    20,
    0.1,
  );
  m.adv[" "] = sp.v;
  // valign center: vertical shift relative to valign top (fitted on H)
  const probeText = probe;
  const cItems: Item[] = [
    [0.3, 0.2],
    [0.7, 0.6],
  ].map(([a, b]) => ({ style, text: probeText, extra: 'valign="center"', fx: a!, fy: b! }));
  const cCrops = await renderCells(cItems, 72, 72, 16, 36);
  const cFit = minimize(
    (dy) => {
      m.centerDy = dy;
      return cItems.reduce(
        (e, it, k) =>
          e +
          err(
            renderText(m, probeText, 16 + it.fx, 36 + it.fy, 72, 72, "left", "center"),
            cCrops[k]!,
          ),
        0,
      );
    },
    -40,
    10,
    0.25,
  );
  m.centerDy = cFit.v;
  return m;
}

async function fitRight(m: Model, texts: string[]) {
  const items: Item[] = texts.flatMap((text) =>
    [
      [0.3, 0.2],
      [0.8, 0.6],
    ].map(([a, b]) => ({ style: m, text, extra: 'halign="right"', fx: a!, fy: b! })),
  );
  const crops = await renderCells(items, 360, 72, 330, 14);
  const fit = minimize(
    (dx) => {
      m.rightDx = dx;
      return items.reduce(
        (e, it, k) =>
          e + err(renderText(m, it.text, 330 + it.fx, 14 + it.fy, 360, 72, "right"), crops[k]!),
        0,
      );
    },
    -12,
    12,
    0.25,
  );
  m.rightDx = fit.v;
}

const VW = 700,
  VX = 340; // verify cell width and label origin
type Check = { name: string; max: number; bad: number };
async function verify(m: Model, strings: string[]) {
  const cases: (Item & { align: string; valign: string })[] = [];
  const phases = [
    [0.45, 0.8],
    [0.9, 0.15],
    [0.13, 0.57],
  ] as const;
  strings.forEach((text, si) => {
    const [fx, fy] = phases[si % phases.length]!;
    for (const [align, valign] of [
      ["left", "top"],
      ["left", "center"],
      ["right", "center"],
    ] as const)
      cases.push({
        style: m,
        text,
        extra: `halign="${align}" valign="${valign}"`,
        fx,
        fy,
        align,
        valign,
      });
  });
  const crops = await renderCells(cases, VW, 72, VX, 36);
  const checks: Check[] = cases.map((c, i) => {
    const a = renderText(m, c.text, VX + c.fx, 36 + c.fy, VW, 72, c.align, c.valign),
      lum = crops[i]!;
    let max = 0,
      bad = 0;
    for (let j = 0; j < a.length; j++) {
      const d = Math.abs(a[j]! * 255 - lum[j]!);
      max = Math.max(max, d);
      if (d > 20) bad++;
    }
    return { name: `${c.text} ${c.align}/${c.valign}`, max, bad };
  });
  return checks;
}

function pack(models: Model[]) {
  const W = 1024,
    rects: { m: Model; c: string; g: Glyph; x: number; y: number }[] = [];
  const all = models.flatMap((m) =>
    [...m.glyphs, ...[...m.runs].map(([k, g]) => [`run|${k}`, g] as const)]
      .filter(([, g]) => g.w)
      .map(([c, g]) => ({ m, c, g, x: 0, y: 0 })),
  );
  all.sort((a, b) => b.g.h - a.g.h);
  let x = 0,
    y = 0,
    rowH = 0;
  for (const r of all) {
    if (x + r.g.w > W) {
      x = 0;
      y += rowH;
      rowH = 0;
    }
    r.x = x;
    r.y = y;
    x += r.g.w;
    rowH = Math.max(rowH, r.g.h);
    rects.push(r);
  }
  const H = y + rowH,
    png = new PNG({ width: W, height: H });
  const gray = Buffer.alloc(W * H);
  for (const r of rects)
    for (let j = 0; j < r.g.h; j++)
      for (let i = 0; i < r.g.w; i++) gray[(r.y + j) * W + r.x + i] = r.g.P[j * r.g.w + i]!;
  png.data = gray;
  return { png, rects, W, H };
}

const only = process.argv[2];
const models: Model[] = [];
try {
  const ping = await bridge.ping();
  if (ping.context === "none")
    throw new Error("No game context. Open a map or the main menu first.");
  for (const spec of STYLES) {
    const key = styleKey(spec);
    if (only && !key.includes(only)) continue;
    const style: Style = { font: spec.font, ts: spec.ts, scale: spec.scale };
    const chars = [...new Set(spec.strings.flatMap((s) => [...s]))].filter((c) => c !== " ");
    console.log(`${key}: ${chars.length} glyphs`);
    const glyphs = await captureGlyphs(style, chars);
    const m = await measure(style, glyphs, chars);
    await fitRight(m, spec.strings.filter((t) => !/[\uE000-\uF8FF]/.test(t)).slice(0, 5));
    for (const run of RUNS.filter((r) => r.style === key))
      m.runs.set(
        `${run.size}|${run.text}`,
        (await captureImages(style, [{ text: run.text, extra: `size="${run.size} 5"` }], 200))[0]!,
      );
    const checks = await verify(
      m,
      spec.strings.filter((s) => s.length > 1 || spec.strings.length < 4).slice(0, 6),
    );
    const worst = checks.sort((a, b) => b.max - a.max)[0]!;
    if (process.env.DEBUG) console.log(JSON.stringify(m.adv));
    console.log(
      `  centerDy ${m.centerDy.toFixed(3)} rightDx ${m.rightDx.toFixed(3)} space ${m.adv[" "]!.toFixed(3)} | verify: worst max ${worst.max.toFixed(0)} (${worst.name}), px>20: ${checks.reduce((a, c) => a + c.bad, 0)}`,
    );
    models.push(m);
  }
  const { png, rects, W, H } = pack(models);
  const json: Record<string, unknown> = { n: N, atlas: { w: W, h: H }, styles: {} };
  for (const m of models) {
    const glyphs: Record<string, number[]> = {};
    const runs: Record<string, number[]> = {};
    for (const r of rects.filter((r) => r.m === m)) {
      const rect = [r.x, r.y, r.g.w, r.g.h, r.g.ox, r.g.oy];
      if (r.c.startsWith("run|")) runs[r.c.slice(4)] = rect;
      else glyphs[r.c] = rect;
    }
    (json.styles as Record<string, unknown>)[styleKey(m)] = {
      adv: Object.fromEntries(
        Object.entries(m.adv).map(([c, v]) => [c, Math.round(v * 1000) / 1000]),
      ),
      centerDy: Math.round(m.centerDy * 1000) / 1000,
      rightDx: Math.round(m.rightDx * 1000) / 1000,
      glyphs,
      ...(Object.keys(runs).length ? { runs } : {}),
    };
  }
  if (!only) {
    writeFileSync(
      join(outDir, "glyphs.png"),
      PNG.sync.write(png, { colorType: 0, inputColorType: 0, inputHasAlpha: false }),
    );
    writeFileSync(join(outDir, "glyphs.json"), JSON.stringify(json) + "\n");
    console.log(`wrote glyphs.png (${W}×${H}) and glyphs.json`);
  }
} finally {
  await bridge.clear();
}
