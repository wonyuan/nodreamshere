// Bakes the page textures into PNGs in public/textures, so the browser draws flat images
// instead of computing SVG noise and blend modes on every frame. Run: npm run textures
// Uses your installed Google Chrome to render the SVG noise.

import { chromium } from "playwright-core";
import { writeFile } from "node:fs/promises";

const SVG = {
  grain: "<svg xmlns='http://www.w3.org/2000/svg' width='300' height='300'><filter id='n' color-interpolation-filters='sRGB'><feTurbulence type='fractalNoise' baseFrequency='.95' numOctaves='3' stitchTiles='stitch'/><feColorMatrix type='saturate' values='0'/><feColorMatrix values='1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 0 1'/><feComponentTransfer><feFuncR type='linear' slope='2.6' intercept='-.8'/><feFuncG type='linear' slope='2.6' intercept='-.8'/><feFuncB type='linear' slope='2.6' intercept='-.8'/></feComponentTransfer></filter><rect width='100%' height='100%' filter='url(#n)'/></svg>",
  blotch: "<svg xmlns='http://www.w3.org/2000/svg' width='1000' height='1000'><filter id='b' color-interpolation-filters='sRGB'><feTurbulence type='fractalNoise' baseFrequency='.002' numOctaves='2' seed='11' stitchTiles='stitch'/><feColorMatrix type='saturate' values='0'/><feColorMatrix values='1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 0 1'/><feComponentTransfer><feFuncR type='linear' slope='2' intercept='-.5'/><feFuncG type='linear' slope='2' intercept='-.5'/><feFuncB type='linear' slope='2' intercept='-.5'/></feComponentTransfer></filter><rect width='100%' height='100%' filter='url(#b)'/></svg>",
  scratches: "<svg xmlns='http://www.w3.org/2000/svg' width='1100' height='800'><filter id='s' color-interpolation-filters='sRGB'><feTurbulence type='fractalNoise' baseFrequency='.8 .0025' numOctaves='2' seed='7' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  1 0 0 0 0'/><feComponentTransfer><feFuncA type='discrete' tableValues='0 0 0 0 0 0 0 0 0 0 0 .9'/></feComponentTransfer></filter><rect width='100%' height='100%' filter='url(#s)'/><g fill='none' stroke='white' stroke-linecap='round'><path d='M140 0 C150 260 132 520 147 800' stroke-width='1'/><path d='M712 60 L736 410' stroke-width='.8'/><path d='M980 300 C972 500 990 640 984 800' stroke-width='.9'/><path d='M300 540 L460 610' stroke-width='.7'/><path d='M60 380 L210 345' stroke-width='.6'/><path d='M820 120 C860 135 900 128 950 160' stroke-width='.8'/><path d='M520 700 C540 730 560 742 620 752' stroke-width='.7'/><path d='M400 40 L380 230' stroke-width='.5'/><path d='M640 480 C700 470 740 490 790 520' stroke-width='.6'/><path d='M30 90 L90 60' stroke-width='.9'/></g><g fill='none' stroke='black' stroke-linecap='round' opacity='.8'><path d='M260 300 L300 420' stroke-width='.7'/><path d='M870 420 C890 470 880 520 905 560' stroke-width='.6'/><path d='M560 140 q20 -6 40 4' stroke-width='.9'/></g><g fill='black'><circle cx='230' cy='120' r='1.8'/><circle cx='610' cy='310' r='1.2'/><circle cx='900' cy='660' r='2.2'/><circle cx='380' cy='760' r='1.4'/><circle cx='1040' cy='90' r='1.1'/><circle cx='70' cy='640' r='1.7'/><circle cx='760' cy='200' r='.9'/><circle cx='480' cy='450' r='1.1'/><path d='M500 200 q5 -4 11 1 q3 5 -2 7' stroke='black' stroke-width='1' fill='none'/></g><g fill='white'><circle cx='330' cy='90' r='1.4'/><circle cx='950' cy='380' r='1.1'/><circle cx='150' cy='520' r='1.6'/><circle cx='690' cy='610' r='1'/></g></svg>",
  dither: "<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160' shape-rendering='crispEdges'><filter id='d' x='0' y='0' width='100%' height='100%' color-interpolation-filters='sRGB'><feTurbulence type='turbulence' baseFrequency='1.9' numOctaves='1' seed='4' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 .05  0 0 0 0 .1  0 0 0 0 .04  0 0 0 1 0'/><feComponentTransfer><feFuncA type='discrete' tableValues='0 0 0 1'/></feComponentTransfer></filter><rect width='100%' height='100%' filter='url(#d)'/></svg>",
  paper: "<svg xmlns='http://www.w3.org/2000/svg' width='600' height='600'><filter id='p' color-interpolation-filters='sRGB'><feTurbulence type='fractalNoise' baseFrequency='.485' numOctaves='1' seed='5' stitchTiles='stitch'/><feColorMatrix values='.33 .33 .33 0 0  .33 .33 .33 0 0  .33 .33 .33 0 0  0 0 0 0 1'/></filter><rect width='100%' height='100%' filter='url(#p)'/></svg>",
};

// Each texture: source SVG, canvas size, and how grey noise turns into transparent specks.
// "signed": darker-than-mid pixels become black specks and lighter ones pale-green specks — the
// same effect an overlay blend gave, but baked in. "darken": only darker pixels show (like multiply).
const JOBS = [
  { name: "grain", svg: SVG.grain, size: [300, 300], mode: "signed", dark: 1.2, light: 0.7 },
  { name: "blotch", svg: SVG.blotch, render: [1000, 1000], size: [250, 250], mode: "signed", dark: 0.42, light: 0.25 },
  { name: "scratches", svg: SVG.scratches, size: [1100, 800], mode: "asis", alpha: 0.32 },
  { name: "dither", svg: SVG.dither, size: [160, 160], mode: "asis", alpha: 1 },
  // The beige card: the same fine speckle as the wheel (Reel.tsx), so card and wheel read as one
  // material. Baked at 2× and shown at 300px so it's as crisp as the wheel's live grain on retina
  // screens; .485 per texture px = ~.97 per CSS px, the wheel's density at its usual size.
  { name: "paper", svg: SVG.paper, size: [600, 600], mode: "signed", dark: 0.42, light: 0.3, highlight: [255, 255, 255], shadow: [0, 0, 0] },
];

const browser = await chromium.launch({ channel: "chrome", headless: true });
const page = await browser.newPage();

for (const job of JOBS) {
  const dataUrl = await page.evaluate(async (job) => {
    const img = new Image();
    const [rw, rh] = job.render ?? job.size;
    img.src = "data:image/svg+xml," + encodeURIComponent(job.svg);
    await img.decode();
    const [w, h] = job.size;
    const canvas = Object.assign(document.createElement("canvas"), { width: w, height: h });
    const ctx = canvas.getContext("2d");
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(img, 0, 0, rw, rh, 0, 0, w, h);
    if (job.mode === "asis") {
      if (job.alpha !== 1) {
        const copy = ctx.getImageData(0, 0, w, h);
        for (let i = 3; i < copy.data.length; i += 4) copy.data[i] *= job.alpha;
        ctx.putImageData(copy, 0, 0);
      }
      return canvas.toDataURL("image/png");
    }
    const px = ctx.getImageData(0, 0, w, h);
    const d = px.data;
    for (let i = 0; i < d.length; i += 4) {
      const v = d[i] / 255;
      let rgb = job.shadow ?? [0, 0, 0];
      let a = 0;
      if (job.mode === "signed") {
        const off = v - 0.5;
        if (off >= 0) rgb = job.highlight ?? [150, 196, 138];
        a = off < 0 ? -off * job.dark : off * job.light * 1.6;
      } else {
        a = (1 - v) * job.dark;
      }
      [d[i], d[i + 1], d[i + 2]] = rgb;
      d[i + 3] = Math.min(255, Math.round(a * 255));
    }
    ctx.putImageData(px, 0, 0);
    return canvas.toDataURL("image/png");
  }, job);
  const file = `public/textures/${job.name}.png`;
  const bytes = Buffer.from(dataUrl.split(",")[1], "base64");
  await writeFile(file, bytes);
  console.log(`${file}  ${(bytes.length / 1024).toFixed(0)} KB`);
}

await browser.close();
