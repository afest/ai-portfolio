// Кривая cubic-bezier → функция для GSAP.
//
// Как забрать: скопировать файл; нужен gsap (CustomEase в нём бесплатен с 2025 года).
//   import { bezierEase } from './ease'
//   gsap.to(el, { x: 0, duration: 0.852, ease: bezierEase([0.66, 0.07, 0.329, 0.895]) })
// Откуда цифры: motion-spec.json разбора Linza → measurements[].easing. Брать кривую «с хвостами»
// (joint): стандартная GSAP с той же ошибкой подбора может иметь хвост на десяток кадров длиннее
// (T-486: power3.inOut на смене слайда).
import gsap from 'gsap'
import { CustomEase } from 'gsap/CustomEase'

gsap.registerPlugin(CustomEase)

let n = 0

/** cubic-bezier(x1, y1, x2, y2) → функция кривой GSAP. */
export function bezierEase([x1, y1, x2, y2]: number[], name = `linza-bezier-${++n}`): gsap.EaseFunction {
  return CustomEase.create(name, `M0,0 C${x1},${y1} ${x2},${y2} 1,1`) as gsap.EaseFunction
}
