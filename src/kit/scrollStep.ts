// Кубик «шаг прокрутки» (коллаж проектов, статья, список): щелчок
// колеса запускает весь шаг сразу, одной кривой, инерции нет; пока шаг идёт, колесо не копится.
// Профиль скорости симметричный — это прокрутка шагом (как ScrollTo / Lenis с фиксированным
// шагом), а не догоняющее движение: lerp описывает ряд хуже кривой.
//
// Как забрать: скопировать файл; нужен gsap (и ./ease.ts).
//   const scroll = { v: 0 }                                   // что двигаем: значение или сам слой
//   const off = wheelSteps(el, { max: 6, onStep: (k) => stepTween(scroll, { v: k * 834 }) })
//   // в кадре: layer.style.transform = `translateY(${-scroll.v}px)`;   off() — снять обработчик
// Цифры по умолчанию: кривая — cubic-bezier(0.813, 0, 0.231, 0.907) за 943 мс (токен T2), шаг коллажа 834 px.
import gsap from 'gsap'
import { bezierEase } from './ease'

export const SCROLL_STEP = { bezier: [0.813, 0, 0.231, 0.907], duration: 0.943, distance: 834 }

let defaultEase: gsap.EaseFunction | null = null

type Curve = { ease?: string | gsap.EaseFunction; duration?: number }

/** Один шаг: весь ход сразу, одной кривой. from — начальные значения (fromTo), иначе от текущих. */
export function stepTween(target: gsap.TweenTarget, to: gsap.TweenVars, { ease, duration = SCROLL_STEP.duration }: Curve = {}, from?: gsap.TweenVars) {
  ease ??= defaultEase ??= bezierEase(SCROLL_STEP.bezier, 'linza-scroll-step')
  return from ? gsap.fromTo(target, from, { ...to, duration, ease }) : gsap.to(target, { ...to, duration, ease })
}

type WheelOpts = {
  /** последний номер шага; шаги 0…max */
  max: number
  start?: number
  /** шаг k начат: вернуть твин — пока он идёт, колесо не слушается */
  onStep: (k: number) => gsap.core.Tween | gsap.core.Timeline | void
  /** меньше этого |deltaY| — дрожь тачпада, не шаг */
  threshold?: number
}

/** Колесо → шаги ±1 без инерции. Возвращает функцию, снимающую обработчик. */
export function wheelSteps(el: HTMLElement, { max, start = 0, onStep, threshold = 4 }: WheelOpts) {
  let cur = start
  let busy = false
  const wheel = (ev: WheelEvent) => {
    ev.preventDefault()
    if (busy || Math.abs(ev.deltaY) < threshold) return
    const k = Math.max(0, Math.min(max, cur + Math.sign(ev.deltaY)))
    if (k === cur) return
    busy = true
    cur = k
    const t = onStep(k)
    if (t) t.eventCallback('onComplete', () => void (busy = false))
    else busy = false
  }
  el.addEventListener('wheel', wheel, { passive: false })   // passive: false — чтобы колесо не листало саму страницу
  return () => el.removeEventListener('wheel', wheel)
}
