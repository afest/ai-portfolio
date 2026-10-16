// Узкое окно (телефон, планшет стоя): проекты обычной страницей с прокруткой.
// Сцена 1920 здесь уменьшалась бы в 2–5 раз, поэтому раскладка своя, а движение — те же кубики и кривые:
// - коллаж проектов (скрыт с 15.10, в адресах его нет): карточки в одну колонку; наведения на телефоне нет —
//   его место занимает карточка в середине
//   экрана: тот же рост картинки из угла (kit/cornerHover.ts) и перебор подписи (kit/scramble.ts).
//   Параллакса за курсором и шага колеса нет — на телефоне нет ни курсора, ни колеса, прокрутка своя;
// - проекты (бывшие разборы): обложка, список (название слева, статус справа); проект наезжает поверх списка
//   справа той же кривой, что на широком экране (effects.json, 02-03), «к списку» — обратный ход; сверху —
//   соседние проекты с номерами; над текстом — галерея кадров с тем же въездом, стопом и «на весь экран».
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import gsap from 'gsap'
import { NarrowPage } from '../demo/DemoStage'
import { effect } from '../lab/harness'
import { easeOf } from '../lab/ease'
import { COVER_LABEL, RAZBORY_HEAD, articles, blogCover, img, projects } from '../demo/content'
import { scramble } from '../kit/scramble'
import { cornerHover } from '../kit/cornerHover'
import { ArticleLinks, BlockView, PanelTop, fromHash } from './Razbory'
import { clearUnderlines, hoverIn, hoverOut } from '../demo/fx'
import { AUTOPLAY_MS, Switch } from '../demo/Switch'

type Card = { root: HTMLDivElement; label: HTMLDivElement; hover: ReturnType<typeof cornerHover> }

export function ProjectsNarrow() {
  const els = useRef<(Card | null)[]>([])
  const active = useRef<number | null>(null)

  useEffect(() => {
    const scroller = document.querySelector<HTMLElement>('.npage')!
    let raf = 0
    // в фокусе — карточка, чей центр ближе всего к середине экрана (и не дальше половины её высоты)
    const pick = () => {
      raf = 0
      const mid = innerHeight / 2
      let best: number | null = null
      let dist = Infinity
      els.current.forEach((c, k) => {
        if (!c) return
        const r = c.root.getBoundingClientRect()
        const d = Math.abs(r.top + r.height / 2 - mid)
        if (d < r.height / 2 + 24 && d < dist) {
          best = k
          dist = d
        }
      })
      if (best === active.current) return
      if (active.current !== null) {
        const c = els.current[active.current]!
        c.hover.leave()
        scramble(c.label, projects[active.current].title, { out: true })
      }
      if (best !== null) {
        const c = els.current[best]!
        c.hover.enter()
        scramble(c.label, projects[best].title, { reveal: true })
      }
      active.current = best
    }
    const on = () => void (raf ||= requestAnimationFrame(pick))
    // первая карточка — после загрузки картинок, чтобы рост был виден
    const t = setTimeout(pick, 300)
    scroller.addEventListener('scroll', on, { passive: true })
    return () => {
      clearTimeout(t)
      cancelAnimationFrame(raf)
      scroller.removeEventListener('scroll', on)
    }
  }, [])

  return (
    <NarrowPage active="projects">
      <div className="ncards">
        {projects.map((c, k) => (
          <a
            key={c.title + k}
            className="ncard"
            href={`#/projects/${c.article}`}
            aria-label={c.title}
          >
            <div
              className="ncard-in"
              ref={(root) => {
                if (!root || els.current[k]?.root === root) return
                const r = root.getBoundingClientRect()
                els.current[k] = {
                  root,
                  label: root.querySelector<HTMLDivElement>('.card-label')!,
                  hover: cornerHover(root.querySelector<HTMLDivElement>('.card-hover')!, { w: r.width, h: r.height }),
                }
              }}
            >
              <img src={img(c.img)} alt="" />
              <div className="card-hover">
                <img src={img(c.hover)} alt="" />
              </div>
              <div className="card-label" />
            </div>
          </a>
        ))}
      </div>
    </NarrowPage>
  )
}

const e = effect('motion', '02-03')

/** Галерея проекта в узком окне: кадры 16:9 (<имя>-n.jpg), сменяются сами тем же въездом, стоп, «на весь экран». */
function NarrowGallery({ gallery, title }: { gallery: string[]; title: string }) {
  const [i, setI] = useState(0)
  const [paused, setPaused] = useState(false)
  const [zoom, setZoom] = useState(false)
  const box = useRef<HTMLDivElement>(null)
  const zoomEl = useRef<HTMLDivElement>(null)
  const busy = useRef(false)
  const shift = (dir: 1 | -1) => {
    const el = box.current
    if (!el || busy.current) return
    busy.current = true
    const n = (i + dir + gallery.length) % gallery.length
    const next = el.children[n] as HTMLElement
    const { ease, duration } = easeOf(e)
    next.style.zIndex = String(Number(el.dataset.z ?? 1) + 1)
    el.dataset.z = next.style.zIndex
    gsap.fromTo(next, { x: el.offsetWidth * dir }, { x: 0, ease, duration, onComplete: () => void (busy.current = false) })
    setI(n)
  }
  useEffect(() => {
    if (gallery.length < 2 || paused) return
    const t = setTimeout(() => shift(1), AUTOPLAY_MS)
    return () => clearTimeout(t)
  }, [i, paused])
  // «на весь экран»: просмотр раскрывается из кадра галереи на весь экран той же кривой, закрывается обратно
  const from = () => {
    const r = box.current!.getBoundingClientRect()
    return `inset(${r.top}px ${innerWidth - r.right}px ${innerHeight - r.bottom}px ${r.left}px)`
  }
  useLayoutEffect(() => {
    if (!zoom || !zoomEl.current || !box.current) return
    const { ease, duration } = easeOf(e)
    gsap.fromTo(zoomEl.current, { clipPath: from() }, { clipPath: 'inset(0px 0px 0px 0px)', ease, duration })
  }, [zoom])
  const closeZoom = () => {
    if (!zoomEl.current || !box.current) return
    const { ease, duration } = easeOf(e)
    gsap.to(zoomEl.current, { clipPath: from(), ease, duration, onComplete: () => setZoom(false) })
  }
  const props = { i, n: gallery.length, onGo: shift, paused, onPause: () => setPaused((p) => !p) }
  return (
    <>
      <div ref={box} className="ngallery">
        {gallery.map((g, k) => (
          <img key={g} src={img(`${g}-n.jpg`)} alt="" style={{ zIndex: k === 0 ? 1 : 0 }} />
        ))}
      </div>
      {gallery.length > 1 && <Switch {...props} onExpand={() => setZoom(true)} />}
      {zoom && (
        <div ref={zoomEl} className="zoom nzoom">
          <img key={gallery[i]} src={img(`${gallery[i]}-n.jpg`)} alt="" />
          <div className="zoom-label">{title}</div>
          <Switch {...props} expanded onExpand={closeZoom} />
        </div>
      )}
    </>
  )
}

export function RazboryNarrow() {
  const first = useRef(fromHash())
  const [open, setOpen] = useState<number | null>(first.current)
  const panel = useRef<HTMLDivElement>(null)
  const busy = useRef(false)
  const animIn = useRef(false)

  // переход между экранами (main.tsx): узкой странице ждать нечего — метка готовности стоит сразу (.lp-ready)

  // проект открылся кликом — въезд справа; по прямому адресу — сразу на месте; каждый новый — с начала текста
  useLayoutEffect(() => {
    const el = panel.current
    if (!el || open === null) return
    el.scrollTop = 0
    if (!animIn.current) return
    animIn.current = false
    const { ease, duration } = easeOf(e)
    gsap.fromTo(el, { x: el.offsetWidth }, { x: 0, ease, duration, onComplete: () => void (busy.current = false) })
  }, [open])

  const go = (k: number | null) => {
    if (busy.current) return
    busy.current = true
    clearUnderlines()
    history.replaceState(null, '', k === null ? '#/projects' : `#/projects/${k}`)
    if (k !== null) {
      animIn.current = true
      setOpen(k)
      return
    }
    const el = panel.current!
    const { ease, duration } = easeOf(e)
    gsap.to(el, { x: el.offsetWidth, ease, duration, onComplete: () => {
      busy.current = false
      setOpen(null)
    } })
  }

  /** Соседний проект: текст сменяется на месте и проявляется, прокрутка — к началу. */
  const step = (dir: 1 | -1) => {
    if (open === null || busy.current) return
    const k = (open + dir + articles.length) % articles.length
    history.replaceState(null, '', `#/projects/${k}`)
    setOpen(k)
    requestAnimationFrame(() => {
      const el = panel.current?.querySelector('.npanel-in')
      if (el) gsap.fromTo(el, { opacity: 0 }, { opacity: 1, duration: 0.4, ease: 'power1.out' })
    })
  }

  const a = open === null ? null : articles[open]

  return (
    <NarrowPage active="projects">
      <i className="lp-ready" hidden />
      <div className="ncover">
        <img src={img(`${blogCover}-n.jpg`)} alt="" />
        <div className="ncover-label">{COVER_LABEL}</div>
      </div>
      <div className="blog nblog">
        <div className="nblog-head">{RAZBORY_HEAD}</div>
        <ul className="blog-list nlist">
          {articles.map((x, k) => (
            <li key={x.slug} onClick={() => go(k)} onMouseEnter={(ev) => hoverIn(ev.currentTarget, x.title)} onMouseLeave={(ev) => hoverOut(ev.currentTarget)}>
              <b>
                <span className="t" ref={(el) => void (el && !el.textContent && (el.textContent = x.title))} />
                <i className="ul" />
              </b>
              <span className="rubric">{x.rubric}</span>
            </li>
          ))}
        </ul>
      </div>
      {a && open !== null && (
        <div ref={panel} className="blog npanel">
          <PanelTop className="npanel-top" open={open} onStep={step} onBack={() => go(null)} />
          <div key={open} className="ncol npanel-in">
            <NarrowGallery key={a.slug} gallery={a.gallery} title={a.title} />
            <h2>{a.title}</h2>
            <ArticleLinks links={a.links} />
            <p className="lead">{a.lead}</p>
            {a.body.map((b, i) => (
              <BlockView key={i} b={b} />
            ))}
          </div>
        </div>
      )}
    </NarrowPage>
  )
}
