// Скриншоты и проверка движения: dev-сервер Vite и браузер в одном процессе, браузер без окна.
//   node scripts/shots.mjs [папка] [ширины через запятую]     по умолчанию: shots, 1440,1920
// Снимает каждый экран, проходит взаимодействия, собирает ошибки консоли, проверяет горизонтальный
// скролл и пишет _отчёт.txt. Код возврата 1 — если ошибки были. Порт 5188: 5186 — dev.bat, стенд может быть открыт.
// Широкое окно (от 1024): главная — превью, стрелки, стоп; проекты — быстрый проход курсора (линии не остаются),
// проект, прокрутка, кадры галереи, «на весь экран» (кадр дорос), соседний проект (снимок прежнего текста убран),
// у каких проектов текст длиннее окна, возврат к списку, наведение на меню.
// Узкое (меньше 1024, плотность 2×, касания): то же касаниями, без наведения.
import { createServer } from 'vite'
import { chromium } from 'playwright'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const out = process.argv[2] ?? 'shots'
const widths = (process.argv[3] ?? '1440,1920').split(',').map(Number)
const HEIGHT = { 390: 844, 768: 1024, 1440: 900, 1920: 1080, 2560: 1440 }
mkdirSync(out, { recursive: true })

const server = await createServer({ logLevel: 'error', server: { port: 5188, strictPort: true, host: '127.0.0.1' } })
await server.listen()
const base = 'http://127.0.0.1:5188/ai-portfolio/'
const browser = await chromium.launch({ args: ['--mute-audio'] })
const log = []
const errors = []
const wait = (ms) => new Promise((r) => setTimeout(r, ms))

for (const w of widths) {
  const h = HEIGHT[w] ?? Math.round(w * 0.5625)
  const narrow = w < 1024
  const page = await browser.newPage(narrow
    ? { viewport: { width: w, height: h }, deviceScaleFactor: 2, hasTouch: true, isMobile: true }
    : { viewport: { width: w, height: h } })
  page.on('console', (m) => m.type() === 'error' && errors.push(`${w}: ${m.text()}`))
  page.on('pageerror', (e) => errors.push(`${w}: ${e.message}`))
  const shot = async (name) => {
    await page.screenshot({ path: join(out, `${w}-${name}.png`) })
    log.push(`${w}-${name}.png`)
  }
  const tap = async (loc) => (narrow ? loc.tap() : loc.click())
  // горизонтальный скролл: у документа и у прокручиваемых слоёв узкой страницы
  const hscroll = async (where) => {
    const r = await page.evaluate(() => {
      const els = [document.documentElement, ...document.querySelectorAll('.npage, .npanel')]
      return els.map((e) => [e.className || 'html', e.scrollWidth, e.clientWidth])
    })
    for (const [name, sw, cw] of r) log.push(`${w} ${where}: ${name} scrollWidth ${sw} / ${cw}${sw > cw ? '  ГОРИЗОНТАЛЬНЫЙ СКРОЛЛ' : ''}`)
  }
  const sx = (x) => (x * w) / 1920                   // координаты сцены → окна
  // номер — в кнопке «← 01»: первая цифровая клетка переключателя
  const counter = async (sel) => (await page.locator(`${sel} .pg .t`).first().textContent())?.trim()

  // ---------- главная: превью (широкое окно — под навигацией справа сверху), стрелки и стоп ----------
  await page.goto(base + '?nolag&t=' + Date.now() + '#/')
  await page.waitForSelector('.snav', { timeout: 60000 })   // после тяжёлой ширины страница грузится дольше фиксированной паузы
  await wait(1500)
  await shot('01-home')
  // сначала стоп: без видеокарты скриншот снимается секундами, и автоплей сбивал бы номера
  await tap(page.locator('.snav button[aria-label="стоп"]'))
  const start = await counter('.snav')
  await tap(page.locator('.hit'))
  await wait(450)
  await shot('02-home-mid')
  await wait(1200)
  await shot('03-home-slide2')
  await tap(page.locator('.snav button').nth(1))           // →
  await wait(1400)
  log.push(`${w}: главная, с ${start} после превью и «→» — ${await counter('.snav')}`)
  await tap(page.locator('.snav button').nth(0))           // ←
  await wait(1400)
  log.push(`${w}: главная, после «←» — ${await counter('.snav')}`)
  const before = await counter('.snav')
  await wait(6000)
  const after = await counter('.snav')
  log.push(`${w}: стоп — номер ${before} → ${after} через 6 с${before !== after ? '  СЛАЙД СМЕНИЛСЯ ПРИ СТОПЕ' : ''}`)
  await shot('04-home-paused')
  await hscroll('главная')
  if (!narrow) {
    await page.locator('.chrome nav a').nth(1).hover()
    await wait(120)
    await shot('05-menu-hover')
  }

  // ---------- проекты: список, проект, галерея, «на весь экран», соседний проект, возврат ----------
  await page.goto(base + '?nolag&t=' + Date.now() + '#/projects')
  await page.waitForSelector(narrow ? '.npage .nlist' : '.blog-list', { timeout: 60000 })
  await wait(1300)
  await shot('08-projects')
  if (narrow) {
    await page.evaluate(() => document.querySelector('.npage').scrollBy(0, 300))
    await wait(300)
    await shot('09-projects-list')
  } else {
    const rows = page.locator('.blog-list li')
    for (let k = 0; k < 6; k++) {
      await rows.nth(k).hover()
      await wait(60)
    }
    await page.mouse.move(sx(400), sx(200))
    await wait(700)
    const lines = await page.evaluate(() => [...document.querySelectorAll('.blog-list .ul')]
      .filter((u) => new DOMMatrix(getComputedStyle(u).transform).a > 0.01).length)
    log.push(`${w}: подчёркнутых строк после быстрого прохода курсора — ${lines}${lines ? '  ОСТАЛОСЬ ПОДЧЁРКИВАНИЕ' : ''}`)
    await rows.first().hover()
    await wait(150)
    await shot('09-projects-hover-mid')
  }
  await tap(page.locator('.blog-list li').first())
  await wait(400)
  await shot('10-project-mid')
  await wait(900)
  await shot('11-project')
  await hscroll('проект')
  const scroller = narrow ? '.npanel' : '.blog-panel-in'
  if (!narrow) {
    await page.mouse.move(sx(1700), h / 2)
    await page.mouse.wheel(0, 900)
    await wait(900)
  } else await page.evaluate((s) => document.querySelector(s).scrollBy(0, 900), scroller)
  log.push(`${w}: прокрутка текста — scrollTop ${await page.evaluate((s) => document.querySelector(s).scrollTop, scroller)}`)
  await shot('12-project-scrolled')
  const gap = await page.evaluate((s) => {
    const el = document.querySelector(s)
    el.scrollTop = el.scrollHeight
    const inner = el.matches('.npanel') ? el.querySelector('.npanel-in') : el
    const last = inner.lastElementChild.getBoundingClientRect()
    return Math.round(el.getBoundingClientRect().bottom - last.bottom)
  }, scroller)
  log.push(`${w}: отступ под последним абзацем — ${gap} px окна`)
  await page.evaluate((s) => (document.querySelector(s).scrollTop = 0), scroller)
  await wait(300)
  const gal = narrow ? '.npanel-in .gswitch' : '.stage > .gswitch'
  await tap(page.locator(`${gal} button`).nth(1))
  await wait(1300)
  log.push(`${w}: галерея после «→» — ${await counter(gal)}`)
  await shot('13-gallery-next')
  await tap(page.locator(`${gal} button[aria-label="на весь экран"]`))
  await wait(450)
  await shot('14-zoom-mid')
  await wait(900)
  await shot('15-zoom')
  if (!narrow) {
    const m = await page.evaluate(() => getComputedStyle(document.querySelector('.zoom')).transform)
    log.push(`${w}: кадр «на весь экран» после хода — ${m}${m === 'none' || m.startsWith('matrix(1,') ? '' : '  КАДР НЕ ДОРОС'}`)
  }
  await tap(page.locator('button[aria-label="свернуть"]'))
  if (!narrow) {
    await wait(450)
    await shot('15a-zoom-closing-mid')
  }
  await wait(1300)
  log.push(`${w}: просмотр закрыт — ${(await page.locator('.zoom').count()) === 0 ? 'да' : 'НЕТ'}`)
  await tap(page.locator('.blog-panel-top .pg, .npanel-top .pg').nth(1))
  if (!narrow) {
    await wait(400)
    await shot('16a-next-project-mid')
  }
  await wait(1400)
  log.push(`${w}: соседний проект — адрес ${await page.evaluate(() => location.hash)}, номер ${await counter(narrow ? '.npanel-top' : '.blog-panel-top')}`)
  await shot('16-next-project')
  if (!narrow) {
    // после листания: снимок прежнего текста убран, страница на месте; у каких проектов текст правда длиннее окна
    const pages = await page.evaluate(() => [...document.querySelectorAll('.blog-panel-in')].map((e) => getComputedStyle(e).transform))
    log.push(`${w}: страниц текста после листания — ${pages.length} (${pages.join('; ')})${pages.length !== 1 ? '  СНИМОК НЕ УБРАН' : ''}`)
    const over = []
    for (let k = 0; k < 10; k++) {
      over.push(await page.evaluate(() => {
        const e = document.querySelector('.blog-panel-in')
        return `${location.hash.split('/').pop()}:${e.scrollHeight > e.clientHeight ? '+' + (e.scrollHeight - e.clientHeight) : '—'}`
      }))
      await tap(page.locator('.blog-panel-top .pg').nth(1))
      await wait(1300)
    }
    log.push(`${w}: прокрутка текста по проектам (лишние px сцены; — нет прокрутки): ${over.join(' ')}`)
  }
  await tap(page.locator('.back'))
  await wait(1300)
  await shot('17-back-to-list')

  // переход между экранами: главная → проекты по меню и обратно — новый экран растёт из угла, панель въезжает
  // полная загрузка (запрос ?t=…), а не смена хеша: смена хеша сама запускает переход и наложилась бы на проверяемый
  await page.goto(base + '?nolag&t=' + Date.now() + '#/')
  await page.waitForSelector('.snav', { timeout: 60000 })
  await wait(2500)
  await tap(page.locator('nav a').nth(1))
  await wait(450)
  await shot('19-home-to-projects-mid')
  await wait(2500)
  await shot('20-projects-after')
  log.push(`${w}: после перехода на проекты — обёрток экранов ${await page.locator('.pwrap').count()}, адрес ${await page.evaluate(() => location.hash)}`)
  await tap(page.locator('nav a').first())
  await wait(450)
  await shot('21-projects-to-home-mid')
  await wait(2800)
  await shot('22-home-after')
  log.push(`${w}: после перехода на главную — обёрток экранов ${await page.locator('.pwrap').count()}`)

  // прямой адрес проекта
  await page.goto(base + '?nolag&t=' + Date.now() + '#/projects/6')
  await page.waitForSelector(narrow ? '.npanel' : '.blog-panel-in', { timeout: 60000 })
  await wait(1200)
  await shot('18-project-direct')
  await hscroll('прямой адрес проекта')
  await page.close()
}

writeFileSync(join(out, '_отчёт.txt'), [...log, '', `ошибок консоли: ${errors.length}`, ...errors].join('\n'), 'utf8')
console.log(log.filter((l) => !l.endsWith('.png')).join('\n'))
console.log(`ошибок консоли: ${errors.length}`)
errors.forEach((e) => console.log('  ' + e))
await browser.close()
await server.close()
process.exit(errors.length ? 1 : 0)
