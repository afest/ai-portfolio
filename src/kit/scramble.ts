// Кубик «перебор букв в клетках»: текст собирается из случайных знаков (наведение на строку блога,
// подпись карточки коллажа).
//
// Как забрать: скопировать файл; зависимостей нет. Элемент с текстом — строчный или блочный, шрифт любой.
//   el.addEventListener('mouseenter', () => scramble(el, 'ВСЕ ПРОЕКТЫ'))
//   scramble(label, 'ИМЯ ПРОЕКТА', { reveal: true })       // набрать с нуля, знак за знаком
//   scramble(label, 'ИМЯ ПРОЕКТА', { out: true })          // перебрать и погасить
//   scramble(el, text, { mode: 'fonts' })                  // промежуточные знаки чужими шрифтами; 'matrix' — катаканой
// Повторный вызов на том же элементе сам останавливает прошлый перебор. Возвращает функцию остановки.
// Строка из 29 знаков собирается за ≈ 370–400 мс.
//
// Как устроено:
// - каждая буква меняется в своей клетке — длина строки и слов не меняется;
// - волна запуска идёт слева направо с разбросом: на первом кадре в слове меняются две-три буквы,
//   остальные ещё родные; вся строка втянута в перебор за ≈ 60 мс;
// - случайный знак держится 2–4 кадра, не мельтешит;
// - буквы встают на место по одной, тоже слева направо: первое слово ≈ 80–100 мс,
//   строка из 29 знаков ≈ 400 мс.
// Клетка держится так: родная буква остаётся в строке невидимой (цвет прозрачный) и задаёт ширину,
// высоту и базовую линию, а случайный знак рисуется поверх абсолютным слоем — на раскладку он не влияет.
// Знак другого шрифта шире клетки уменьшается пропорционально, без растяжения.
// Режимы: same — тот же шрифт и алфавит; fonts — каждый промежуточный знак своим
// шрифтом (эксперимент); matrix — катакана и цифры зелёным.
export type ScrambleMode = 'same' | 'fonts' | 'matrix'

const CYR = 'АБВГДЕЖЗИЙКЛМНОПРСТУФХЦЧШЩЬЫЭЮЯ'
const LAT = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
const MIX = CYR + LAT + '0123456789#%&@$*+=?'
const KANA = 'ｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃﾄﾅﾆﾇﾈﾉﾊﾋﾌﾍﾎﾏﾐﾑﾒﾓﾔﾕﾖﾗﾘﾙﾚﾛﾜﾝ0123456789'
const FONTS = ['Georgia', '"Times New Roman"', '"Courier New"', '"Arial Black"', 'Impact', 'Consolas', '"Segoe Script"',
  '"Trebuchet MS"', '"Palatino Linotype"', '"Comic Sans MS"']
const FRAME = 1000 / 60

const rnd = (a: number, b: number) => a + Math.random() * (b - a)
const pick = (s: string) => s[Math.floor(Math.random() * s.length)]

function glyph(ch: string, mode: ScrambleMode) {
  if (mode === 'matrix') return pick(KANA)
  if (mode === 'fonts') return pick(MIX)
  const pool = /[А-ЯЁ]/i.test(ch) ? CYR : /[A-Z]/i.test(ch) ? LAT : '0123456789'
  const g = pick(pool)
  return ch === ch.toLowerCase() ? g.toLowerCase() : g
}

let ctx: CanvasRenderingContext2D | null = null
/** Ширина знака в заданном шрифте — чтобы вписать чужой знак в клетку. */
function measure(text: string, font: string) {
  ctx ??= document.createElement('canvas').getContext('2d')
  ctx!.font = font
  return ctx!.measureText(text).width
}

type Opts = { mode?: ScrambleMode; reveal?: boolean; out?: boolean; onDone?: () => void }
type Slot = { ch: string; cell: HTMLSpanElement; mark: HTMLElement; start: number; settle: number; next: number; w: number }

/** Запустить перебор в элементе; вернёт функцию остановки (текст встаёт в конечное состояние). */
export function scramble(el: HTMLElement, text: string, { mode = 'same', reveal = false, out = false, onDone }: Opts = {}) {
  const prev = (el as HTMLElement & { __scramble?: () => void }).__scramble
  prev?.()
  const cs = getComputedStyle(el)
  const size = parseFloat(cs.fontSize)
  const color = cs.color
  const chars = [...text]
  const n = chars.filter((c) => c !== ' ').length
  el.textContent = ''
  const slots: Slot[] = []
  let j = 0                                   // номер знака без пробелов — по нему идёт волна
  for (const ch of chars) {
    if (ch === ' ') {
      el.appendChild(document.createTextNode(' '))   // по пробелу строка может переноситься
      continue
    }
    const cell = document.createElement('span')
    cell.style.position = 'relative'
    cell.textContent = ch
    cell.style.color = 'transparent'          // родная буква держит клетку, но не видна
    const mark = document.createElement('i')
    // line-height: normal — та же высота, что у строчной коробки родной буквы: базовые линии совпадают
    mark.style.cssText = 'position:absolute;left:50%;top:0;line-height:normal;font-style:normal;white-space:pre;' +
      'pointer-events:none;transform-origin:50% 60%;'
    cell.appendChild(mark)
    el.appendChild(cell)
    let start: number
    let settle: number
    if (reveal) {                             // подпись карточки: знак за знаком, ≈ кадр на знак
      start = j * 17
      settle = start + rnd(160, 240)
    } else if (out) {                         // уход: знаки перебираются и гаснут слева направо
      start = j * 2.5 + rnd(0, 20)
      settle = 60 + j * 9 + rnd(0, 20)
    } else {                                  // наведение: волна запуска и волна сборки
      start = 17 + j * 2.5 + rnd(0, 30)
      settle = 80 + j * Math.min(12, 450 / Math.max(1, n)) + rnd(0, 25)
    }
    slots.push({ ch, cell, mark, start, settle: Math.max(settle, start + FRAME), next: 0, w: 0 })
    j++
  }
  slots.forEach((s) => (s.w = s.cell.getBoundingClientRect().width))   // клетка меряется один раз
  const show = (s: Slot, g: string | null) => {
    if (g === null) {                         // родная буква на месте
      s.cell.style.color = ''
      s.mark.textContent = ''
      return
    }
    s.cell.style.color = 'transparent'
    s.mark.textContent = g
    s.mark.style.color = color               // иначе знак унаследует прозрачность родной буквы
    let font = `${cs.fontStyle} ${cs.fontWeight} ${size}px ${cs.fontFamily}`
    if (mode === 'fonts') {
      const fam = FONTS[Math.floor(Math.random() * FONTS.length)]
      const it = Math.random() < 0.3 ? 'italic' : 'normal'
      s.mark.style.fontFamily = fam
      s.mark.style.fontStyle = it
      font = `${it} ${cs.fontWeight} ${size}px ${fam}`
    } else if (mode === 'matrix') {
      s.mark.style.color = '#3cff7a'
      s.mark.style.textShadow = '0 0 8px rgba(60,255,122,.7)'
    }
    // вписать в клетку: только пропорциональное уменьшение, растягивать знаки нельзя
    const k = Math.min(1, s.w / Math.max(1, measure(g, font)))
    s.mark.style.transform = `translateX(-50%) scale(${k.toFixed(3)})`
  }
  slots.forEach((s) => {
    if (reveal) show(s, '')
    else show(s, null)
  })
  const t0 = performance.now()
  let raf = 0
  let done = false
  const finish = () => {
    if (done) return
    done = true
    cancelAnimationFrame(raf)
    el.textContent = out ? '' : text
    onDone?.()
  }
  ;(el as HTMLElement & { __scramble?: () => void }).__scramble = finish
  const tick = () => {
    const t = performance.now() - t0
    let busy = false
    for (const s of slots) {
      if (t >= s.settle) {
        if (s.next !== -1) {
          show(s, out ? '' : null)
          s.next = -1
        }
        continue
      }
      busy = true
      if (t < s.start) continue               // ещё родная (или ещё не появилась — reveal)
      if (t >= s.next) {                       // новый случайный знак держится 2–4 кадра
        show(s, glyph(s.ch, mode))
        s.next = t + rnd(2, 4) * FRAME
      }
    }
    if (busy) raf = requestAnimationFrame(tick)
    else finish()
  }
  raf = requestAnimationFrame(tick)
  return finish
}
