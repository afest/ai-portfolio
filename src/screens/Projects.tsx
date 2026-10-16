// Проекты — демо страницы проектов из Linza (lab/src/sets/<набор>/demo/03-01.tsx). Приёмы и кубики:
// - шаг колеса 834 px, кривая и длительность — эффект 03-01 из effects.json набора, kit/scrollStep.ts;
// - коллаж уходит в противоход курсору, карточки на разной глубине — kit/cursorParallax.ts;
// - наведение: новая картинка растёт из правого нижнего угла карточки, уход — сжимается в левый
//   верхний — kit/cornerHover.ts;
// - подпись карточки набирается перебором букв (≈ 400 мс) — kit/scramble.ts; рядом с курсором — «••».
// Цифры каждого приёма — в шапке его кубика.
// Попадание курсора в карточку считается на каждом кадре: карточки едут под неподвижной мышью.
// Отличия от лаборатории: 10 карточек проектов вместо 18 фото, клик по карточке открывает её разбор,
// число шагов прокрутки — от высоты окна.
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import gsap from 'gsap'
import { Chrome, DemoStage, useStage } from '../demo/DemoStage'
import { effect, isRecord, preload, registerScenario, tOf } from '../lab/harness'
import { easeOf } from '../lab/ease'
import { img, projects } from '../demo/content'
import { scramble } from '../kit/scramble'
import { stepTween, wheelSteps } from '../kit/scrollStep'
import { cursorParallax, depth } from '../kit/cursorParallax'
import { cornerHover } from '../kit/cornerHover'

const e = effect('motion', '03-01')
const STEP = 834
const CW = 900
const CH = 506
const COLS = [292, 944, -260, 433, 1247, 640, 40, 1100]
const cards = projects.map((c, k) => ({
  ...c,
  x: COLS[k % COLS.length],
  y: 40 + k * 330,
  z: depth(k),
}))

type CardEls = { root: HTMLDivElement; label: HTMLDivElement; hover: ReturnType<typeof cornerHover> }

export default function Projects() {
  const { h } = useStage()
  const maxStep = Math.max(0, Math.ceil((cards[cards.length - 1].y + CH - h + 40) / STEP))
  const [ready, setReady] = useState(false)
  const stage = useRef<HTMLDivElement>(null)
  const dots = useRef<HTMLDivElement>(null)
  const els = useRef<(CardEls | null)[]>([])
  const scroll = useRef({ v: 0 })
  const px = useRef(cursorParallax())
  const inside = useRef(false)
  const hovered = useRef<number | null>(null)

  useLayoutEffect(() => {
    preload([...new Set(cards.flatMap((c) => [c.img, c.hover]))].map(img)).then(() => setReady(true))
  }, [])

  /** Положение карточек: прокрутка × глубина + параллакс курсора × глубина. */
  const layout = () => {
    const [ox, oy] = px.current.offset()
    const rects: { x: number; y: number }[] = []
    cards.forEach((c, k) => {
      const el = els.current[k]
      if (!el) return
      const x = c.x + ox * c.z
      const y = c.y - scroll.current.v * c.z + oy * c.z
      el.root.style.transform = `translate3d(${x}px, ${y}px, 0)`
      rects[k] = { x, y }
    })
    return rects
  }

  const enter = (k: number) => {
    els.current[k]!.hover.enter()
    scramble(els.current[k]!.label, cards[k].title, { reveal: true })
  }
  const leave = (k: number) => {
    els.current[k]!.hover.leave()
    scramble(els.current[k]!.label, cards[k].title, { out: true })
  }

  // запись: шаг прокрутки в кадре trigger_frame, курсора нет
  useLayoutEffect(() => {
    if (!ready || !isRecord) return
    const { ease, duration } = easeOf(e)
    const master = gsap.timeline({ paused: true })
    master.set({}, {}, tOf(e, e.window[1]))
    master.add(stepTween(scroll.current, { v: STEP }, { ease, duration }), tOf(e, e.trigger_frame))
    return registerScenario(e, { timeline: master, render: () => void layout() })
  }, [ready])

  // живой режим: каждый кадр — догоняющий курсор, раскладка, попадание курсора в карточку
  useEffect(() => {
    if (!ready || isRecord) return
    const tick = (_t: number, dt: number) => {
      px.current.tick(dt)
      const m = px.current.state
      const rects = layout()
      let hit: number | null = null
      if (inside.current) {
        for (let k = cards.length - 1; k >= 0; k--) {     // сверху — карточка с большим номером
          const r = rects[k]
          if (r && m.x >= r.x && m.x < r.x + CW && m.y >= r.y && m.y < r.y + CH) {
            hit = k
            break
          }
        }
      }
      if (hit !== hovered.current) {
        if (hovered.current !== null) leave(hovered.current)
        if (hit !== null) enter(hit)
        hovered.current = hit
        if (stage.current) stage.current.style.cursor = hit === null ? '' : 'pointer'
      }
      if (dots.current) {
        dots.current.style.opacity = hit === null ? '0' : '1'
        dots.current.style.transform = `translate3d(${m.x + 26}px, ${m.y + 2}px, 0)`
      }
    }
    gsap.ticker.add(tick)
    return () => gsap.ticker.remove(tick)
  }, [ready])

  useEffect(() => {
    const el = stage.current
    if (!el || isRecord) return
    const move = (ev: MouseEvent) => {
      const r = el.getBoundingClientRect()
      const s = r.width / 1920
      px.current.pointer((ev.clientX - r.left) / s, (ev.clientY - r.top) / s)
      inside.current = true
    }
    const out = () => (inside.current = false)
    const click = () => {
      if (hovered.current !== null) location.hash = `#/projects/${cards[hovered.current].article}`
    }
    const { ease, duration } = easeOf(e)
    const offWheel = wheelSteps(el, {
      max: maxStep,
      onStep: (k) => stepTween(scroll.current, { v: k * STEP }, { ease, duration }),
    })
    el.addEventListener('mousemove', move)
    el.addEventListener('mouseleave', out)
    el.addEventListener('click', click)
    return () => {
      el.removeEventListener('mousemove', move)
      el.removeEventListener('mouseleave', out)
      el.removeEventListener('click', click)
      offWheel()
    }
  }, [ready])

  return (
    <DemoStage set="motion" id="03-01">
      {ready && (
        <div ref={stage} className="layer collage" style={{ background: '#0d0d0d' }}>
          {cards.map((c, k) => (
            <div
              key={c.title + k}
              className="card"
              style={{ width: CW, height: CH, zIndex: k, transform: `translate3d(${c.x}px, ${c.y}px, 0)` }}
              ref={(root) => {
                if (!root || els.current[k]?.root === root) return
                els.current[k] = {
                  root,
                  label: root.querySelector<HTMLDivElement>('.card-label')!,
                  hover: cornerHover(root.querySelector<HTMLDivElement>('.card-hover')!, { w: CW, h: CH }),
                }
              }}
            >
              <img src={img(c.img)} alt={c.title} />
              <div className="card-hover">
                <img src={img(c.hover)} alt="" />
              </div>
              <div className="card-label" />
            </div>
          ))}
          <Chrome active="projects" />
          {!isRecord && (
            <div ref={dots} className="cursor-dots">
              <i />
              <i />
            </div>
          )}
        </div>
      )}
    </DemoStage>
  )
}
