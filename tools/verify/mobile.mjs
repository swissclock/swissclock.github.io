// Mobile pass: iPhone 14 Pro profile in Playwright's WebKit build, against the
// dev server. Scrolls every section like a thumb, records frame timing (on this
// Mac's GPU, so not a measure of iPhone speed), horizontal overflow, the model's
// presence, console errors, the For fun auto-cycle, a light hold, and a tap on
// Connect. Screenshots land in tools/verify/out/.
//
//   npm i --no-save playwright-core && npx playwright-core install webkit
//   npm run dev &            # http://localhost:5173
//   node tools/verify/mobile.mjs
//
// WEBKIT=/path/to/pw_run.sh uses an already-installed WebKit build instead.
import { mkdirSync } from 'node:fs'
import { webkit, devices } from 'playwright-core'
const OUT = new URL('./out/', import.meta.url).pathname
mkdirSync(OUT, { recursive: true })
const browser = await webkit.launch(process.env.WEBKIT ? { executablePath: process.env.WEBKIT } : {})
const ctx = await browser.newContext({ ...devices['iPhone 14 Pro'] })
const page = await ctx.newPage()
const problems = []
page.on('pageerror', (e) => problems.push('pageerror: ' + e.message))
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') problems.push(`${m.type()}: ${m.text().slice(0, 160)}`) })
await page.goto('http://localhost:5173/')
await page.waitForFunction(() => document.getElementById('gl').classList.contains('is-loaded'), null, { timeout: 60000 })

const frames = () => page.evaluate(() => new Promise((res) => {
  const t = []; let last = performance.now(); const t0 = last
  const f = (now) => { t.push(now - last); last = now; if (now - t0 < 2500) requestAnimationFrame(f); else res(t) }
  requestAnimationFrame(f)
}))
const stats = (t) => { const s = [...t].sort((a, b) => a - b); return { fps: Math.round(1000 / (t.reduce((a, b) => a + b, 0) / t.length)), p95: +s[Math.floor(s.length * 0.95)].toFixed(1), worst: +s[s.length - 1].toFixed(1) } }

const ids = await page.evaluate(() => [...document.querySelectorAll('main > section')].map((s) => s.id))
const report = []
for (const id of ids) {
  // Scroll there gradually, the way a thumb does, so lazy loads and transitions run.
  const target = await page.evaluate((id) => document.getElementById(id).offsetTop, id)
  for (let k = 0; k < 8; k++) {
    await page.evaluate(([y, k]) => window.scrollTo(0, window.scrollY + (y - window.scrollY) * ((k + 1) / 8)), [target, k])
    await page.waitForTimeout(90)
  }
  await page.waitForTimeout(2500)
  const t = await frames()
  const info = await page.evaluate(() => ({
    overflow: document.documentElement.scrollWidth - innerWidth,
    nav: document.querySelector('#nav a.on')?.textContent,
    presence: getComputedStyle(document.documentElement).getPropertyValue('--gl-presence').trim(),
    canvas: getComputedStyle(document.getElementById('gl')).opacity
  }))
  report.push({ id, ...stats(t), ...info })
  await page.screenshot({ path: `${OUT}${id}.png` })
}
// For fun: the view takes turns on its own with no hover.
await page.evaluate(() => window.scrollTo(0, document.getElementById('fun').offsetTop))
await page.waitForTimeout(500)
const showing = []
for (let k = 0; k < 3; k++) { showing.push(await page.evaluate(() => document.querySelector('.project.showing h3')?.textContent || 'rest')); await page.screenshot({ path: `${OUT}fun-turn-${k}.png` }); await page.waitForTimeout(8200) }
// Light: press and hold the control.
await page.evaluate(() => window.scrollTo(0, document.getElementById('research').offsetTop))
await page.waitForTimeout(3000)
const stim = await page.locator('#stim').boundingBox()
await page.mouse.move(stim.x + stim.width / 2, stim.y + stim.height / 2)
await page.mouse.down(); await page.waitForTimeout(2500)
const lit = await page.evaluate(() => [document.documentElement.classList.contains('is-lit'), getComputedStyle(document.getElementById('gl')).opacity])
await page.screenshot({ path: `${OUT}research-lit.png` })
await page.mouse.up(); await page.waitForTimeout(600)
const after = await page.evaluate(() => document.documentElement.className)
// Connect: a touch drag must scroll, not turn or light.
await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight)); await page.waitForTimeout(3000)
const before = await page.evaluate(() => window.scrollY)
await page.touchscreen.tap(300, 400)
const tapClass = await page.evaluate(() => document.documentElement.className)
console.log(JSON.stringify({ report, showing, lit, after, tapClass, scrollY: before, problems: [...new Set(problems)] }, null, 1))
await browser.close()
