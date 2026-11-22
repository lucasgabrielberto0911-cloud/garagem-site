// Auditoria visual do admin (local, dados fictícios). Uso: BASE=http://127.0.0.1:3471 OUT=dir node audit.mjs
import { chromium } from "playwright";
import fs from "node:fs";
const BASE = process.env.BASE || "http://127.0.0.1:3471";
const OUT = process.env.OUT || "/tmp/admin-audit";
fs.mkdirSync(OUT, { recursive: true });
const ROUTES = (process.env.ROUTES || "/admin,/admin/veiculos,/admin/veiculos?tab=vendidos,/admin/veiculos/novo,/admin/veiculos/rascunhos,/admin/veiculos/:id,/admin/compra,/admin/em-preparacao,/admin/parados,/admin/vendas,/admin/vendas/nova,/admin/promissorias,/admin/depoimentos,/admin/site,/admin/ajuda,/admin/conta,/admin/catalogo").split(",");
const VIEWS = [{ name: "360", width: 360, height: 780, mobile: true }, { name: "1280", width: 1280, height: 800, mobile: false }];
const results = [];
const browser = await chromium.launch();
for (const v of VIEWS) {
  const ctx = await browser.newContext({ viewport: { width: v.width, height: v.height }, isMobile: v.mobile, hasTouch: v.mobile, serviceWorkers: "block" });
  const page = await ctx.newPage();
  const errors = [];
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text().slice(0, 160)); });
  page.on("pageerror", (e) => errors.push("pageerror: " + String(e).slice(0, 160)));
  await page.goto(BASE + "/admin/login");
  await page.fill('input[name="email"]', "auditoria@teste.local");
  await page.fill('input[name="password"]', "Auditoria#2026");
  await Promise.all([page.waitForURL((u) => !u.pathname.includes("/login"), { timeout: 30000 }), page.keyboard.press("Enter")]);
  let vehicleId = process.env.VEHICLE_ID || "";
  if (!vehicleId) {
    await page.goto(BASE + "/admin/veiculos");
    const href = await page.locator('a[href^="/admin/veiculos/c"]').first().getAttribute("href").catch(() => null);
    vehicleId = href ? href.split("/").pop() : "";
  }
  for (const r0 of ROUTES) {
    const r = r0.replace(":id", vehicleId);
    errors.length = 0;
    const t0 = Date.now();
    let status = 0;
    try { const resp = await page.goto(BASE + r, { waitUntil: "domcontentloaded", timeout: 45000 }); status = resp?.status() ?? 0; await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {}); } catch (e) { results.push({ view: v.name, route: r, fatal: String(e).slice(0, 120) }); continue; }
    const ms = Date.now() - t0;
    await page.waitForTimeout(400);
    const info = await page.evaluate(() => {
      const vw = window.innerWidth, vh = window.innerHeight;
      const se = document.scrollingElement;
      const docOverflow = se.scrollWidth - vw;
      const vis = (el) => { const s = getComputedStyle(el); const r = el.getBoundingClientRect(); return s.visibility !== "hidden" && s.display !== "none" && r.width > 0 && r.height > 0 && parseFloat(s.opacity) > 0.05; };
      const inHScroll = (el) => { for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) { const s = getComputedStyle(p); if (/(auto|scroll)/.test(s.overflowX) && p.scrollWidth > p.clientWidth) return true; if (/(hidden|clip)/.test(s.overflowX) && p.getBoundingClientRect().right <= vw + 1) return "clipped"; } return false; };
      const desc = (el) => { const t = (el.innerText || el.getAttribute("aria-label") || "").trim().replace(/\s+/g, " ").slice(0, 50); return `${el.tagName.toLowerCase()}${el.id ? "#" + el.id : ""}${t ? ' "' + t + '"' : ""}`; };
      const off = [], clipped = [], small = [];
      const all = [...document.querySelectorAll("body *")].filter((el) => !el.closest("[aria-hidden=true]") && !el.closest("dialog:not([open])"));
      for (const el of all) {
        if (!vis(el)) continue;
        const r = el.getBoundingClientRect();
        if ((r.right > vw + 2 || r.left < -2) && el.children.length === 0 && (el.innerText || "").trim()) { const h = inHScroll(el); if (h !== true) off.push(desc(el) + (h === "clipped" ? " [cortado por overflow]" : "")); }
        if (/^(BUTTON|A|LABEL|H1|H2|H3|TH|TD|SPAN|P|SUMMARY)$/.test(el.tagName) && (el.innerText || "").trim()) {
          const s = getComputedStyle(el);
          if ((s.textOverflow === "ellipsis" || /(hidden|clip)/.test(s.overflow)) && (el.scrollWidth > el.clientWidth + 2 || el.scrollHeight > el.clientHeight + 4)) clipped.push(desc(el));
        }
        if (/^(BUTTON|A|SELECT|INPUT)$/.test(el.tagName) || el.getAttribute("role") === "button") { if (r.height < 40 && r.width < 300 && el.type !== "hidden" && el.type !== "checkbox" && el.type !== "radio") small.push(desc(el) + ` ${Math.round(r.width)}x${Math.round(r.height)}`); }
      }
      const fixed = all.filter((el) => { const s = getComputedStyle(el); return (s.position === "fixed" || s.position === "sticky") && vis(el); }).map((el) => { const r = el.getBoundingClientRect(); return { el: desc(el).slice(0, 40), pos: getComputedStyle(el).position, top: Math.round(r.top), bottom: Math.round(r.bottom), h: Math.round(r.height), w: Math.round(r.width) }; });
      const bodyOverflow = getComputedStyle(document.body).overflow + "/" + getComputedStyle(document.documentElement).overflow;
      return { docOverflow, off: [...new Set(off)].slice(0, 12), offCount: off.length, clipped: [...new Set(clipped)].slice(0, 12), clippedCount: clipped.length, small: [...new Set(small)].slice(0, 10), smallCount: small.length, fixed: fixed.slice(0, 8), bodyOverflow, scrollH: se.scrollHeight, vh, title: document.querySelector("h1")?.innerText?.trim() };
    });
    // rolagem até o fim e cobertura por barras fixas
    const bottom = await page.evaluate(async () => {
      window.scrollTo(0, document.scrollingElement.scrollHeight); await new Promise((r) => setTimeout(r, 300));
      const vh = window.innerHeight; const scrolled = window.scrollY;
      const fixedBottom = [...document.querySelectorAll("body *")].filter((el) => { const s = getComputedStyle(el); const r = el.getBoundingClientRect(); return s.position === "fixed" && r.height > 20 && r.bottom >= vh - 2 && r.top > vh / 2 && s.display !== "none" && s.visibility !== "hidden"; });
      const barTop = fixedBottom.length ? Math.min(...fixedBottom.map((e) => e.getBoundingClientRect().top)) : vh;
      const main = document.querySelector("main") || document.body;
      const items = [...main.querySelectorAll("a,button,input,select,textarea,p,h2,h3,li")].filter((el) => { const r = el.getBoundingClientRect(); return r.height > 0 && !fixedBottom.some((f) => f.contains(el)); });
      const last = items.length ? Math.max(...items.map((e) => e.getBoundingClientRect().bottom)) : 0;
      return { scrolled, canScroll: document.scrollingElement.scrollHeight > vh + 5, coveredPx: Math.round(last - barTop), barTop: Math.round(barTop) };
    });
    await page.evaluate(() => window.scrollTo(0, 0));
    const file = `${OUT}/${v.name}${r.replace(/[/?=&:]+/g, "_")}.png`;
    await page.screenshot({ path: file, fullPage: true }).catch(() => {});
    results.push({ view: v.name, route: r0, status, ms, ...info, bottom, errors: [...new Set(errors)].slice(0, 5), shot: file });
  }
  // gaveta do menu e diálogo de busca no celular
  if (v.mobile) {
    await page.goto(BASE + "/admin"); await page.waitForLoadState("networkidle").catch(() => {});
    const opener = page.locator('[aria-controls="admin-mobile-drawer"]').first();
    if (await opener.count()) { await opener.click().catch(() => {}); await page.waitForTimeout(500);
      const d = await page.evaluate(() => { const el = document.getElementById("admin-mobile-drawer"); if (!el) return null; const sc = [...el.querySelectorAll("*")].find((e) => /(auto|scroll)/.test(getComputedStyle(e).overflowY)); return { scrollable: !!sc, contentH: sc?.scrollHeight, boxH: sc?.clientHeight, links: [...el.querySelectorAll("a")].map((a) => a.innerText.trim()).filter(Boolean) }; });
      results.push({ view: v.name, route: "drawer", drawer: d }); await page.screenshot({ path: `${OUT}/${v.name}_drawer.png` }); }
  }
  await ctx.close();
}
await browser.close();
fs.writeFileSync(`${OUT}/report.json`, JSON.stringify(results, null, 1));
for (const r of results) {
  if (r.fatal) { console.log(`${r.view} ${r.route} FATAL ${r.fatal}`); continue; }
  if (r.drawer !== undefined) { console.log(`${r.view} drawer ${JSON.stringify(r.drawer)}`); continue; }
  console.log(`\n## ${r.view} ${r.route} [${r.status}] ${r.ms}ms h1="${r.title}" docOverflow=${r.docOverflow} body=${r.bodyOverflow} scroll=${JSON.stringify(r.bottom)}`);
  if (r.offCount) console.log(`  fora da tela (${r.offCount}): ${r.off.join(" | ")}`);
  if (r.clippedCount) console.log(`  texto cortado (${r.clippedCount}): ${r.clipped.join(" | ")}`);
  if (r.smallCount) console.log(`  alvo < 40px (${r.smallCount}): ${r.small.join(" | ")}`);
  if (r.errors.length) console.log(`  erros: ${r.errors.join(" | ")}`);
  console.log(`  fixos: ${r.fixed.map((f) => `${f.el}(${f.pos} ${f.top}-${f.bottom})`).join(" ; ")}`);
}
