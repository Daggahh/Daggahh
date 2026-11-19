// Turns a GitHub contribution calendar into animated SVGs.
// Usage: node gen.mjs [calendar.json] [outDir]
//   If GITHUB_TOKEN and GH_USER are set, fetches the calendar instead of reading a file.
import fs from "node:fs";
import path from "node:path";

const OUT = process.argv[3] || "dist";
const W = 880, H = 190, PAD = 22;

async function loadDays() {
  if (process.env.GITHUB_TOKEN && process.env.GH_USER) {
    const q = `{user(login:"${process.env.GH_USER}"){contributionsCollection{contributionCalendar{weeks{contributionDays{date contributionCount}}}}}}`;
    const r = await fetch("https://api.github.com/graphql", {
      method: "POST",
      headers: { Authorization: `bearer ${process.env.GITHUB_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify({ query: q }),
    });
    const j = await r.json();
    if (!r.ok || j.errors || !j.data?.user) throw new Error(`GitHub API failed: ${r.status} ${JSON.stringify(j.errors || j.message || "")}`);
    return toWeeks(j);
  }
  return toWeeks(JSON.parse(fs.readFileSync(process.argv[2] || "calendar.json", "utf8")));
}
const toWeeks = (j) => j.data.user.contributionsCollection.contributionCalendar.weeks.map((w) => w.contributionDays.map((d) => d.contributionCount));

// deterministic randomness so the art doesn't reshuffle every run
let seed = 1337;
const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const r2 = (n) => Math.round(n * 100) / 100;

const frame = (inner, style = "") => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">
<style>${style}</style>
<rect width="${W}" height="${H}" rx="12" fill="#0d1117" stroke="#21262d"/>
${inner}
</svg>`;

function levels(weeks) {
  const max = Math.max(1, ...weeks.flat());
  return (c) => (c === 0 ? 0 : Math.max(1, Math.min(4, Math.ceil((Math.log(c + 1) / Math.log(max + 1)) * 4))));
}
function grid(weeks) {
  const cols = weeks.length, cell = Math.min((W - PAD * 2) / cols, (H - PAD * 2) / 7);
  const ox = (W - cols * cell) / 2, oy = (H - 7 * cell) / 2;
  return { cell, ox, oy };
}

// 1. constellation: every active day is a star, the busiest days get joined up
function constellation(weeks) {
  seed = 7; const lv = levels(weeks); const { cell, ox, oy } = grid(weeks);
  const stars = [];
  weeks.forEach((w, x) => w.forEach((c, y) => {
    if (!c) return;
    stars.push({ c, l: lv(c), x: ox + x * cell + cell / 2 + (rand() - 0.5) * cell * 0.8, y: oy + y * cell + cell / 2 + (rand() - 0.5) * cell * 0.8, i: stars.length });
  }));
  const top = [...stars].sort((a, b) => b.c - a.c).slice(0, 14).sort((a, b) => a.i - b.i);
  // join neighbours only, so it reads as a few constellations instead of one long scribble
  const line = top.map((s, i) => `${i && Math.hypot(s.x - top[i - 1].x, s.y - top[i - 1].y) < W * 0.14 ? "L" : "M"}${r2(s.x)},${r2(s.y)}`).join(" ");
  const dust = Array.from({ length: 90 }, () => `<circle cx="${r2(rand() * W)}" cy="${r2(rand() * H)}" r="0.5" fill="#30363d"/>`).join("");
  const s = stars.map((s) => `<circle class="t" cx="${r2(s.x)}" cy="${r2(s.y)}" r="${[0, 0.8, 1.2, 1.7, 2.3][s.l]}" fill="${["", "#6e7681", "#8b949e", "#c9d1d9", "#f0f6fc"][s.l]}" style="animation-delay:${r2(rand() * 4)}s;animation-duration:${r2(2.5 + rand() * 3)}s"/>`).join("");
  const glow = top.map((s) => `<circle cx="${r2(s.x)}" cy="${r2(s.y)}" r="5" fill="url(#g)"/>`).join("");
  return frame(`<defs><radialGradient id="g"><stop offset="0" stop-color="#f0f6fc" stop-opacity=".5"/><stop offset="1" stop-color="#f0f6fc" stop-opacity="0"/></radialGradient></defs>
${dust}<path class="l" d="${line}" fill="none" stroke="#8b949e" stroke-width=".6" stroke-opacity=".6"/>${glow}${s}
<line class="m" x1="0" y1="0" x2="60" y2="18" stroke="url(#sh)" stroke-width="1.2"/>
<defs><linearGradient id="sh"><stop offset="0" stop-color="#f0f6fc" stop-opacity="0"/><stop offset="1" stop-color="#f0f6fc"/></linearGradient></defs>`,
  `.t{animation:tw ease-in-out infinite}@keyframes tw{0%,100%{opacity:1}50%{opacity:.25}}
.l{stroke-dasharray:3000;stroke-dashoffset:3000;animation:dr 6s ease-out forwards}@keyframes dr{to{stroke-dashoffset:0}}
.m{opacity:0;animation:sh 9s linear 2s infinite}@keyframes sh{0%{opacity:0;transform:translate(120px,10px)}2%{opacity:1}8%{opacity:0;transform:translate(420px,100px)}100%{opacity:0}}`);
}

// 2. skyline: each week is a building, lit windows track the commits
function skyline(weeks) {
  seed = 11; const tot = weeks.map((w) => w.reduce((a, b) => a + b, 0)); const max = Math.max(...tot);
  const ground = H - 18, bw = (W - PAD * 2) / weeks.length;
  let out = Array.from({ length: 60 }, () => `<circle class="t" cx="${r2(rand() * W)}" cy="${r2(rand() * 70)}" r="${r2(0.4 + rand() * 0.6)}" fill="#6e7681" style="animation-delay:${r2(rand() * 5)}s"/>`).join("");
  out += `<circle cx="${W - 70}" cy="38" r="13" fill="#c9d1d9"/><circle cx="${W - 64}" cy="34" r="12" fill="#0d1117"/>`;
  tot.forEach((t, i) => {
    const h = 8 + Math.sqrt(t / max) * (ground - 50), x = PAD + i * bw, y = ground - h;
    out += `<rect x="${r2(x + 1)}" y="${r2(y)}" width="${r2(bw - 2)}" height="${r2(h)}" fill="#161b22" stroke="#21262d" stroke-width=".5"/>`;
    const rows = Math.floor((h - 6) / 6), litP = t ? 0.15 + 0.75 * (t / max) : 0;
    for (let r = 0; r < rows; r++) for (let c = 0; c < 2; c++) {
      if (rand() > litP) continue;
      const fl = rand() < 0.12 ? ` class="f" style="animation-delay:${r2(rand() * 6)}s"` : "";
      out += `<rect${fl} x="${r2(x + 3 + c * (bw - 8) / 2)}" y="${r2(y + 4 + r * 6)}" width="${r2((bw - 10) / 2)}" height="2.4" fill="${rand() < 0.5 ? "#c9d1d9" : "#8b949e"}"/>`;
    }
  });
  out += `<line x1="0" x2="${W}" y1="${ground}" y2="${ground}" stroke="#30363d"/>`;
  return frame(out, `.t{animation:tw 4s ease-in-out infinite}@keyframes tw{50%{opacity:.2}}.f{animation:fl 7s steps(1) infinite}@keyframes fl{0%,60%{opacity:1}61%,80%{opacity:.1}81%{opacity:1}}`);
}

// 3. galaxy: the year spirals out from the core, january in the middle, today on the rim
function galaxy(weeks) {
  seed = 31; const lv = levels(weeks); const days = weeks.flat();
  const cx = W / 2, cy = H / 2;
  // every star rides its own tilted orbit, so the disc turns but the stars stay round
  const SX = 2.6, SY = 0.92, DUR = 160;
  const stars = days.map((c, i) => {
    const t = i / days.length, r = Math.max(2, 4 + t * 82 + (rand() - 0.5) * (2 + t * 7));
    const th = ((i * 0.21) / 2.2 + (i % 2 ? Math.PI : 0)) % (Math.PI * 2);
    const a = r * SX, b = r * SY;
    const orbit = `M${r2(a)},0 A${r2(a)},${r2(b)} 0 1 1 ${r2(-a)},0 A${r2(a)},${r2(b)} 0 1 1 ${r2(a)},0`;
    const motion = `<animateMotion dur="${DUR}s" begin="-${r2((th / (Math.PI * 2)) * DUR)}s" repeatCount="indefinite" path="${orbit}"/>`;
    const l = lv(c);
    if (!l) return `<circle r=".5" fill="#30363d">${motion}</circle>`;
    return `<circle class="t" r="${[0, 0.7, 1, 1.4, 2][l]}" fill="${["", "#6e7681", "#8b949e", "#c9d1d9", "#f0f6fc"][l]}" style="animation-delay:${r2(rand() * 4)}s">${motion}</circle>`;
  }).join("");
  const dust = Array.from({ length: 120 }, () => `<circle cx="${r2(rand() * W)}" cy="${r2(rand() * H)}" r="${r2(0.3 + rand() * 0.5)}" fill="#30363d"/>`).join("");
  return frame(`<defs><radialGradient id="core"><stop offset="0" stop-color="#f0f6fc" stop-opacity=".55"/><stop offset=".35" stop-color="#c9d1d9" stop-opacity=".12"/><stop offset="1" stop-color="#c9d1d9" stop-opacity="0"/></radialGradient></defs>
${dust}<g transform="translate(${cx},${cy})"><ellipse rx="${40 * SX}" ry="${40 * SY}" fill="url(#core)"/>${stars}</g>`,
  `.t{animation:tw 3.5s ease-in-out infinite}@keyframes tw{50%{opacity:.3}}`);
}

// 4. peaks: one mountain ridge per weekday, drawn across the year
function peaks(weeks) {
  seed = 41; const max = Math.max(1, ...weeks.flat());
  const rows = 7, top = 44, gap = (H - 26 - top) / rows, amp = 46;
  const xs = (i) => PAD + (i / (weeks.length - 1)) * (W - PAD * 2);
  let out = Array.from({ length: 50 }, () => `<circle class="t" cx="${r2(rand() * W)}" cy="${r2(rand() * 60)}" r="${r2(0.4 + rand() * 0.6)}" fill="#6e7681" style="animation-delay:${r2(rand() * 5)}s"/>`).join("");
  out += `<circle cx="${W - 90}" cy="34" r="11" fill="#c9d1d9" opacity=".9"/>`;
  for (let d = 0; d < rows; d++) {
    const base = top + (d + 1) * gap;
    const v = weeks.map((w, i) => {
      const a = weeks[i - 1]?.[d] ?? w[d], b = w[d] ?? 0, c = weeks[i + 1]?.[d] ?? w[d];
      return Math.sqrt(((a ?? 0) + 2 * b + (c ?? 0)) / 4 / max);
    });
    const pts = v.map((k, i) => [xs(i), base - k * amp]);
    let p = `M${r2(pts[0][0])},${r2(pts[0][1])}`;
    for (let i = 1; i < pts.length; i++) {
      const mx = (pts[i - 1][0] + pts[i][0]) / 2;
      p += ` C${r2(mx)},${r2(pts[i - 1][1])} ${r2(mx)},${r2(pts[i][1])} ${r2(pts[i][0])},${r2(pts[i][1])}`;
    }
    const shade = ["#30363d", "#3b424b", "#484f58", "#59626c", "#6e7681", "#8b949e", "#c9d1d9"][d];
    out += `<path d="${p} L${W - PAD},${H} L${PAD},${H} Z" fill="#0d1117"/>`;
    out += `<path class="r" d="${p}" fill="none" stroke="${shade}" stroke-width="${d === rows - 1 ? 1.3 : 1}" style="animation-delay:${r2(d * 0.25)}s"/>`;
    if (d === rows - 1) out += `<circle r="2.2" fill="#f0f6fc"><animateMotion dur="14s" repeatCount="indefinite" path="${p}"/></circle>`;
  }
  return frame(`<defs><clipPath id="cl"><rect width="${W}" height="${H}" rx="12"/></clipPath></defs><g clip-path="url(#cl)">${out}</g>`,
  `.t{animation:tw 4s ease-in-out infinite}@keyframes tw{50%{opacity:.2}}
.r{stroke-dasharray:2600;stroke-dashoffset:2600;animation:dr 4s ease-out forwards}@keyframes dr{to{stroke-dashoffset:0}}`);
}

// 5. garden: each week grows a stem, busy weeks grow tall and bloom, everything sways
function garden(weeks) {
  seed = 53; const tot = weeks.map((w) => w.reduce((a, b) => a + b, 0)); const max = Math.max(1, ...tot);
  const ground = H - 20, bw = (W - PAD * 2) / weeks.length;
  let out = Array.from({ length: 45 }, () => `<circle class="t" cx="${r2(rand() * W)}" cy="${r2(rand() * 70)}" r="${r2(0.4 + rand() * 0.5)}" fill="#484f58" style="animation-delay:${r2(rand() * 5)}s"/>`).join("");
  tot.forEach((t, i) => {
    const k = t / max, x = PAD + i * bw + bw / 2, h = 6 + Math.sqrt(k) * (ground - 46), y = ground - h;
    const bend = (rand() - 0.5) * 10;
    const sway = `style="transform-origin:${r2(x)}px ${ground}px;animation-delay:-${r2(rand() * 5)}s;animation-duration:${r2(4 + rand() * 3)}s"`;
    let g = `<path d="M${r2(x)},${ground} Q${r2(x + bend)},${r2(ground - h / 2)} ${r2(x + bend / 2)},${r2(y)}" fill="none" stroke="#30363d" stroke-width="1.1"/>`;
    if (h > 26) g += `<path d="M${r2(x + bend * 0.3)},${r2(ground - h * 0.4)} q${r2(5 * (bend > 0 ? -1 : 1))},-4 ${r2(7 * (bend > 0 ? -1 : 1))},-1" fill="none" stroke="#30363d" stroke-width="1"/>`;
    if (k > 0.2) {
      const pr = 1.5 + k * 3.2, fx = x + bend / 2;
      g += [0, 72, 144, 216, 288].map((a) => `<circle cx="${r2(fx + Math.cos(a * Math.PI / 180) * pr)}" cy="${r2(y + Math.sin(a * Math.PI / 180) * pr)}" r="${r2(pr * 0.7)}" fill="${k > 0.6 ? "#c9d1d9" : "#6e7681"}" opacity=".85"/>`).join("");
      g += `<circle cx="${r2(fx)}" cy="${r2(y)}" r="${r2(pr * 0.45)}" fill="#f0f6fc"/>`;
    } else if (t) g += `<circle cx="${r2(x + bend / 2)}" cy="${r2(y)}" r="1.4" fill="#545d68"/>`;
    out += `<g class="s" ${sway}>${g}</g>`;
  });
  out += `<line x1="0" x2="${W}" y1="${ground}" y2="${ground}" stroke="#30363d"/>`;
  return frame(out, `.t{animation:tw 4s ease-in-out infinite}@keyframes tw{50%{opacity:.2}}
.s{animation:sw ease-in-out infinite alternate}@keyframes sw{from{transform:rotate(-2.5deg)}to{transform:rotate(2.5deg)}}`);
}

const weeks = await loadDays();
fs.mkdirSync(OUT, { recursive: true });
for (const [name, fn] of Object.entries({ constellation, skyline, galaxy, peaks, garden })) {
  fs.writeFileSync(path.join(OUT, `${name}.svg`), fn(weeks));
  console.log(name, (fs.statSync(path.join(OUT, `${name}.svg`)).size / 1024).toFixed(1) + "kb");
}
