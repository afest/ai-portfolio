// Кубик «въезд картинки со встречной подписью» — открытие статьи блога.
// Картинка въезжает из-за края целиком (translateX distance → 0) внутри контейнера с overflow: hidden;
// подпись внутри картинки едет встречно (−distance → 0) и потому стоит в экранных координатах —
// её открывает край картинки. Соседи (панель статьи) — тем же ходом, своим путём.
// Это въезд, а не маска: содержимое едет вместе с границей.
//
// Как забрать: скопировать файл; нужен gsap (и ./ease.ts, если кривая — cubic-bezier).
//   <div style="position:relative; width:1192px; overflow:hidden">      ← окно
//     <div class="wrap" style="position:absolute; inset:0">             ← едет
//       <img …> <div class="label" style="position:absolute; left:360px; top:520px">ПОДПИСЬ</div>
//   const tl = gsap.timeline()
//   slideIn(tl, { wrap, label, distance: 1192, companions: [[panel, 728, 0]] })
// Цифры по умолчанию: cubic-bezier(0.66, 0.07, 0.329, 0.895) за 852 мс — почти токен T1.
// Панель статьи и картинка идут одной долей пути — один ход.
import gsap from 'gsap'
import { bezierEase } from './ease'

export const SLIDE_IN = { bezier: [0.66, 0.07, 0.329, 0.895], duration: 0.852 }

type Opts = {
  wrap: gsap.TweenTarget
  label?: gsap.TweenTarget
  /** путь въезда, px: положительный — справа налево */
  distance: number
  /** соседи тем же ходом: [элемент, x от, x до] */
  companions?: [gsap.TweenTarget, number, number][]
  ease?: string | gsap.EaseFunction
  duration?: number
  at?: gsap.Position
  /** false — не ставить начальные положения сразу (их ставит вызывающий: переход «по требованию») */
  immediateRender?: boolean
}

let defaultEase: gsap.EaseFunction | null = null

/** Добавить въезд в таймлайн. */
export function slideIn(tl: gsap.core.Timeline, { wrap, label, distance, companions = [], ease, duration = SLIDE_IN.duration, at = 0, immediateRender }: Opts) {
  ease ??= defaultEase ??= bezierEase(SLIDE_IN.bezier, 'linza-slide-in')
  const ir = immediateRender === false ? { immediateRender: false } : {}
  tl.fromTo(wrap, { x: distance }, { x: 0, duration, ease, ...ir }, at)
  if (label) tl.fromTo(label, { x: -distance }, { x: 0, duration, ease, ...ir }, at)
  for (const [el, from, to] of companions) tl.fromTo(el, { x: from }, { x: to, duration, ease, ...ir }, at)
  return tl
}
