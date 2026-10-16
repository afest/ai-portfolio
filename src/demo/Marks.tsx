// Разметка 60 / 40 (правка Павла 15.10, круг 6): на границе картинки и панели проектов — метки, как метки приводки
// в типографии: крестики сверху и снизу (или линия с засечками — ?marks=line, вариант на сравнение). Один слой
// поверх обоих экранов (main.tsx): при ходах метки стоят на месте. С нижнего крестика начинаются ходы — главная →
// проекты (обратно — прячутся в него), «на весь экран» и обратно: растут масштабом из точки, как слайд на главной.
// Нижняя строка (переключатель в левом углу, подписи левее линии, сам крестик) — на одной высоте LINE от низа.
import gsap from 'gsap'
import { effect, isRecord } from '../lab/harness'
import { easeOf } from '../lab/ease'

export const SPLIT = 1152   // линия разметки — 60% ширины, px сцены
export const LINE = 56      // нижняя строка — центр от низа; верхняя — линия верха букв от верха (круг 7), px сцены
export const GAP = 40       // от линии до подписей слева и до белой панели справа (круг 7: крестики — на картинке, не на панели)
export const IMG_W = SPLIT + GAP   // картинка проектов; панель — от IMG_W до правого края
// Высота всех превью под курсором (круг 9) — высота заглавных «ЮНУСОВ»: 8,4% ширины сцены × 0,7275 (Inter) ≈ 117 px сцены.
// Ширина — по пропорции того, что из превью развернётся: главная — экран, проекты и галерея — картинка (IMG_W × высота)
export const CAP = 117
/** Масштаб превью к сцене высотой h: превью — это экран (или картинка), сжатый к точке в CAP / h раз. */
export const capScale = (h: number) => CAP / h
export const MARKS: 'cross' | 'line' = new URLSearchParams(location.search).get('marks') === 'line' ? 'line' : 'cross'

const T1 = effect('motion', '01-04')

/** Нижний крестик в координатах элемента шириной w и высотой h: x — 60% ширины, y — нижняя строка (k — px элемента в px сцены). */
export const origin = (w: number, h: number, k = 1): [number, number] => [w * (SPLIT / 1920), h - LINE * k]

/** Ход из точки: элемент растёт из точки F (in, масштаб from → 1) или прячется в неё (out, 1 → 0), кривая T1.
 *  F — в координатах самого элемента; from — с какого масштаба (превью раздела — с его размера, круг 7).
 *  После in масштаб снимается; после out элемент остаётся точкой — его убирают. */
export function grow(el: HTMLElement, F: [number, number], dir: 'in' | 'out', onDone?: () => void, from = 0,
  onScale?: (s: number) => void) {
  const { ease, duration } = easeOf(T1)
  const [a, b] = dir === 'in' ? [from, 1] : [1, 0]
  return gsap.fromTo(el, { scale: a, transformOrigin: `${F[0]}px ${F[1]}px` }, { scale: b, ease, duration,
    onUpdate: onScale && (() => onScale(gsap.getProperty(el, 'scale') as number)),
    onComplete: () => {
      if (dir === 'in') gsap.set(el, { clearProps: 'transform,transformOrigin' })
      onDone?.()
    } })
}

/** Клик по пункту меню (круг 7, demo/NavLayer.tsx): точка клика в px окна и масштаб превью раздела —
 *  переход (main.tsx) разворачивает страницу из этого превью, а не из крестика. */
export type Origin = { F: [number, number]; s0: number }
let pending: Origin | null = null
export const setOrigin = (o: Origin) => void (pending = o)
export function takeOrigin() {
  const o = pending
  pending = null
  return o
}

export function Marks() {
  if (isRecord) return null
  // слева — на линии 60 / 40 (всегда на картинке, белые); справа (круг 8) — у правого края, напротив «ПРОЕКТЫ» и последней
  // строки «О СЕБЕ»: рамка из четырёх крестиков. Правые стоят и на фото, и на белой панели — разностное наложение
  return (
    <>
      <div className={`marks ${MARKS}`} aria-hidden>
        <i className="m-top" />
        <i className="m-bot" />
      </div>
      <div className="marks marks-r" aria-hidden>
        <i className="m-top" />
        <i className="m-bot" />
      </div>
    </>
  )
}
