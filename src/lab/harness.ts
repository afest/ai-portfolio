// Связка эффекта с записью и живым режимом.
//
// Эффект строит один GSAP-таймлайн сценария (на паузе): t = 0 — первый кадр окна записи (window[0]),
// триггер — в кадре trigger_frame из effects.json набора. Дальше два режима:
// - запись (?record): скрипт Playwright зовёт window.__linza.seek(k / 60) и снимает кадр, так что
//   кадр k — ровно момент k/60 с, сколько бы ни шёл сам снимок. Всё состояние сцены — функция
//   времени таймлайна, поэтому две записи подряд совпадают;
// - живой: тот же таймлайн играет в реальном времени, ползунок перематывает.
import gsap from 'gsap'
import { sets, type EffectConfig } from './sets'

export { effect, type EffectConfig } from './sets'

// сцена и запись — 1920×1080, 60 fps у всех наборов: номера кадров в effects.json — в этой сетке
export const FPS = 60
export const W = 1920
export const H = 1080
for (const s of sets) {
  if (s.fps !== FPS || s.width !== W || s.height !== H)
    throw new Error(`набор ${s.name}: лаборатория пишет ${W}×${H} при ${FPS} fps, в effects.json другое`)
}

export const isRecord = new URLSearchParams(location.search).has('record')

/** Время сценария (с) для кадра frame: отсчёт от window[0]. */
export function tOf(e: EffectConfig, frame: number): number {
  return (frame - e.window[0]) / FPS
}

/** Длительность окна: кадров window[1] − window[0] + 1, последний — в момент (N − 1) / 60. */
export function frameCount(e: EffectConfig): number {
  return e.window[1] - e.window[0] + 1
}

export type Scenario = {
  timeline: gsap.core.Timeline
  /** Перерисовать то, что не DOM (WebGL), по текущему времени таймлайна. */
  render?: () => void
}

type Bridge = {
  ready: boolean
  frames: number
  fps: number
  seek: (t: number) => Promise<void>
}

declare global {
  interface Window {
    __linza?: Bridge
  }
}

const listeners = new Set<(s: Scenario | null) => void>()
let current: Scenario | null = null

export function onScenario(fn: (s: Scenario | null) => void): () => void {
  listeners.add(fn)
  fn(current)
  return () => listeners.delete(fn)
}

const nextPaint = () =>
  new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())))

/** Эффект зовёт, когда картинки загружены и таймлайн собран. */
export function registerScenario(e: EffectConfig, s: Scenario): () => void {
  current = s
  s.timeline.pause(0)
  s.render?.()
  listeners.forEach((fn) => fn(s))
  if (isRecord) {
    window.__linza = {
      ready: false,
      frames: frameCount(e),
      fps: FPS,
      seek: async (t: number) => {
        s.timeline.pause(t, false)
        s.render?.()
        await nextPaint()
      },
    }
    const images = Array.from(document.images).map((i) => i.decode().catch(() => undefined))
    Promise.all([document.fonts.ready, ...images]).then(nextPaint).then(() => {
      if (window.__linza) window.__linza.ready = true
    })
  }
  return () => {
    if (current === s) current = null
    listeners.forEach((fn) => fn(null))
    delete window.__linza
  }
}

/** Загрузить картинки до старта: запись не должна снять кадр с недорисованной картинкой. */
export function preload(urls: string[]): Promise<HTMLImageElement[]> {
  return Promise.all(
    urls.map(
      (u) =>
        new Promise<HTMLImageElement>((res, rej) => {
          const img = new Image()
          img.onload = () => img.decode().then(() => res(img), () => res(img))
          img.onerror = () => rej(new Error(`не загрузилась ${u} — python -m linza prep <набор>`))
          img.src = u
        }),
    ),
  )
}

/** Картинка сцены эффекта: /<набор>/<id>/<name> (готовит prep_assets.py набора). */
export const asset = (e: EffectConfig, name: string) => `/${e.set}/${e.id}/${name}`

/** Геометрия сцен, которую посчитал prep_assets.py набора (границы, координаты карточек). */
export async function loadScene<T>(e: EffectConfig): Promise<T> {
  const r = await fetch(`/${e.set}/scenes.json`)
  if (!r.ok) throw new Error(`нет /${e.set}/scenes.json — python -m linza prep ${e.set}`)
  return (await r.json())[e.id] as T
}

/** Живой режим: действие пользователя (клик, колесо) — проиграть сценарий с момента триггера. */
export function trigger() {
  window.dispatchEvent(new CustomEvent('linza:trigger'))
}
