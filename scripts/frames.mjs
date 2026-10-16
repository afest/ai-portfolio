// Кадры середины ходов: часы страницы останавливаются (page.clock), время двигается вручную, и кадр снимается
// ровно на нужной миллисекунде, а не когда успел скриншот (без видеокарты он идёт секундами, и ход успевает кончиться).
//   node scripts/frames.mjs [папка] [ширины через запятую]     по умолчанию: frames, 1440
// Главная (смена слайда из превью), главная → проекты, соседний проект, «на весь экран» туда и обратно.
// Порт 5189: 5186 — dev.bat, 5188 — shots.mjs.
import { createServer } from 'vite'
import { chromium } from 'playwright'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const out = process.argv[2] ?? 'frames'
const widths = (process.argv[3] ?? '1440').split(',').map(Number)
const HEIGHT = { 1440: 900, 1920: 1080, 2560: 1440 }
mkdirSync(out, { recursive: true })

const server = await createServer({ logLevel: 'error', server: { port: 5189, strictPort: true, host: '127.0.0.1' } })
await server.listen()
const base = 'http://127.0.0.1:5189/ai-portfolio/'
const browser = await chromium.launch({ args: ['--mute-audio'] })
const log = []
const errors = []
const wait = (ms) => new Promise((r) => setTimeout(r, ms))

for (const w of widths) {
  const h = HEIGHT[w] ?? Math.round(w * 0.5625)
  const page = await browser.newPage({ viewport: { width: w, height: h } })
  page.on('console', (m) => m.type() === 'error' && errors.push(`${w}: ${m.text()}`))
  page.on('pageerror', (e) => errors.push(`${w}: ${e.message}`))
  const shot = async (name) => {
    await page.screenshot({ path: join(out, `${w}-${name}.png`) })
    log.push(`${w}-${name}.png`)
  }
  // открыть адрес полной загрузкой, дождаться картинок по живым часам, потом остановить часы
  // (pauseAt — с запасом в секунду: пока идёт вызов, живые часы уходят вперёд, а назад их не перевести)
  let installed = false
  const open = async (hash, query = '') => {
    if (!installed) await page.clock.install()
    else await page.clock.resume()
    installed = true
    await page.goto(base + '?nolag&t=' + Date.now() + query + hash)
    await wait(2500)
    await page.clock.pauseAt(await page.evaluate(() => Date.now() + 1000))
  }
  // кадры хода: после действия — шаги по ms (сумма от начала), картинки грузятся по живым часам
  const frames = async (name, steps, settle = 0) => {
    if (settle) await wait(settle)
    let t = 0
    for (const ms of steps) {
      await page.clock.runFor(ms - t)
      t = ms
      await shot(`${name}-${String(ms).padStart(4, '0')}`)
    }
  }

  // главная, превью в углу: стоп, клик по превью в левом нижнем углу — слайд растёт из угла вправо и вверх
  await open('#/', '&preview=corner')
  await page.locator('.snav button[aria-label="стоп"]').click()
  await page.locator('.hit').click()
  await frames('a-slide', [150, 350, 550, 1000])

  // меню (круг 7): наведение — превью раздела под курсором; клик — страница раздела разворачивается из превью
  // (у проектов картинка растёт из превью, панель — из правого верхнего угла); обратно — главная из превью «Главная»
  await page.locator('nav a').nth(1).hover()
  await page.clock.runFor(400)
  await shot('b0-hover-projects')
  await page.locator('nav a').nth(1).click()
  await frames('b-home-to-projects', [150, 350, 550, 1100], 1500)
  log.push(`${w}: после перехода на проекты — обёрток экранов ${await page.locator('.pwrap').count()}`)
  await page.locator('nav a').first().hover()
  await page.clock.runFor(400)
  await shot('b1-hover-home')
  await page.locator('nav a').first().click()
  await frames('b2-projects-to-home', [150, 350, 550, 1100], 1500)
  log.push(`${w}: после перехода на главную — обёрток экранов ${await page.locator('.pwrap').count()}`)

  // главная, превью за курсором: курсор в середине и у края — клик там, слайд растёт оттуда
  for (const [name, x, y] of [['a2-cursor-center', w / 2, h / 2], ['a3-cursor-edge', w - 120, 140]]) {
    await open('#/', '&preview=cursor')
    await page.locator('.snav button[aria-label="стоп"]').click()
    await page.mouse.move(x, y)
    await page.clock.runFor(600)        // превью догоняет курсор (кадры идут только по остановленным часам)
    await shot(`${name}-0000`)
    await page.mouse.click(x, y)
    await frames(name, [150, 350, 550, 1000])
  }

  // галерея проекта как на главной (круг 8): превью следующего кадра за курсором, клик — кадр растёт из точки клика
  await open('#/projects/0')
  await page.locator('.stage > .gswitch .ico').first().click()   // стоп автосмены
  const gx = Math.round(w * 0.32)
  const gy = Math.round(h * 0.4)
  await page.mouse.move(gx, gy)
  await page.clock.runFor(600)
  await shot('g-gallery-0000')
  await page.mouse.click(gx, gy)
  await frames('g-gallery', [150, 350, 550, 1000], 300)
  log.push(`${w}: галерея после клика — ${(await page.locator('.stage > .gswitch .pg .t').first().textContent())?.trim()}`)

  // замочек (круг 9): превью уезжает в левый нижний угол и стоит там; второе нажатие — снова за курсором
  await page.locator('.stage > .gswitch button[aria-label="превью в угол"]').click()
  await page.mouse.move(gx, gy)
  await page.clock.runFor(900)
  await shot('h-lock')
  await page.locator('.stage > .gswitch button[aria-label="превью за курсором"]').click()

  // соседний проект: верхняя строка стоит, страница текста и картинка въезжают справа и накрывают превью (круг 9),
  // потом превью вырастает из левого нижнего угла
  await page.mouse.move(gx, gy)
  await page.clock.runFor(600)
  await page.locator('.blog-panel-top .pg').nth(1).click()
  await frames('c-next-project', [200, 400, 1000, 1400, 2000], 600)
  log.push(`${w}: страниц текста после листания — ${await page.locator('.blog-panel-in').count()}`)
  // первая смена кадра сразу после листания проекта (круг 10) — тоже из превью (шейдер), а не въездом сбоку
  await page.mouse.move(gx, gy)
  await page.clock.runFor(300)
  await page.mouse.click(gx, gy)
  await frames('i-first-after-step', [150, 350, 550], 300)
  log.push(`${w}: первая смена после листания — холст шейдера ${(await page.evaluate(() => getComputedStyle(document.querySelector('.gcanvas') ?? document.body).visibility))}`)

  // «на весь экран» и обратно: наведение — маленькое превью под курсором; кадр растёт из точки нажатия и накрывает шапку,
  // закрытие — сжимается в точку нажатия «свернуть»
  await page.locator('.stage > .gswitch button[aria-label="на весь экран"]').hover()
  await page.clock.runFor(400)
  await shot('d-zoom-0000-hover')
  await page.locator('.stage > .gswitch button[aria-label="на весь экран"]').click()
  await frames('d-zoom-open', [200, 400, 1000], 300)
  // глазик (круг 9): подпись сворачивается справа налево в значок и разворачивается обратно
  await page.locator('.geye').click()
  await frames('f-eye-hide', [250, 700])
  await page.locator('.geye').click()
  await frames('f-eye-show', [700])
  await page.locator('.geye').click()   // снова свернуть: закрытие со свёрнутой подписью — она гаснет, под кадром название
  await page.clock.runFor(700)
  await page.locator('button[aria-label="свернуть"]').click()
  await frames('e-zoom-close', [200, 400, 1000])
  log.push(`${w}: просмотр закрыт — ${(await page.locator('.zoom').count()) === 0 ? 'да' : 'НЕТ'}`)
  await page.close()
}

writeFileSync(join(out, '_отчёт.txt'), [...log, '', `ошибок консоли: ${errors.length}`, ...errors].join('\n'), 'utf8')
console.log(log.filter((l) => !l.endsWith('.png')).join('\n'))
console.log(`ошибок консоли: ${errors.length}`)
errors.forEach((e) => console.log('  ' + e))
await browser.close()
await server.close()
process.exit(errors.length ? 1 : 0)
