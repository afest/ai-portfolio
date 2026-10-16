// Главная — демо 01-04 из Linza (lab/src/sets/<набор>/demo/01-04.tsx): слайдер по кругу из шести слайдов.
// Тот же шейдер (kit/cornerZoom.ts), та же кривая и длительность из effects.json набора, подпись
// нового слайда — с той же задержкой. Управление: клик по превью, стрелки, автоплей.
// Отличия от лаборатории: сцена во всё окно (высота по пропорции окна — картинки рисуются под неё,
// превью держит пропорцию экрана), под подписью — полная строка. Подпись слайда с article ведёт в проект,
// у заголовка — стрелка (правка Павла 16.10: тестовое и «основа» кликабельны).
// Правки Павла 15.10: картинки во весь кадр с тенью слева под белый текст; подписи — текстом поверх
// шейдера, а не текстурой (текстура сцены 1920, пережатая под окно, мылила буквы): старую подпись
// каждый кадр обрезает растущая рамка нового слайда, новая появляется в момент LABEL_B_AT;
// в правом верхнем углу — «← 01 / 06 →» и стоп; шаг назад — тот же ход в обратную сторону.
// Правки Павла 15.10, круг 5: точка роста — anchorFor в kit/cornerZoom.ts; кадр стоит 7,5 с. Круг 6: превью —
// в левом нижнем углу, «← 01 / 06 →» и стоп — прямо на нём (тот же угол, что у галереи проектов); слайд растёт
// из угла слева направо и снизу вверх; снизу тень под нижнюю строку (переключатель, подписи).
// Узкое окно: сцена размером с окно, подпись внизу слева над подвалом, превью — 28% экрана в нижнем углу
// (сверху в узком окне — имя во всю ширину).
// Запись (?record): одна смена слайда в кадре trigger_frame, как в Linza, превью — в правом нижнем углу.
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import gsap from 'gsap'
import { Chrome, DemoStage, Foot, Logo, Menu, useStage } from '../demo/DemoStage'
import { ShaderCanvas, ShaderPlane } from '../lab/ShaderCanvas'
import { FPS, effect, isRecord, preload, registerScenario, tOf } from '../lab/harness'
import { easeOf } from '../lab/ease'
import { PREVIEW, anchorFor, cornerUniforms, frag, texture, vert, zoomRect } from '../kit/cornerZoom'
import { articles, img, slides } from '../demo/content'
import { AUTOPLAY_MS, Switch } from '../demo/Switch'
import { CAP } from '../demo/Marks'
import { readLock, saveLock } from '../demo/lock'
import { previewAt } from '../demo/previewAt'

const e = effect('motion', '01-04')
const LABEL_B_AT = (365.5 - e.trigger_frame) / FPS   // подпись нового слайда — через ≈ 0,57 с после триггера
// имя в две строки в узком окне: «ЮНУСОВ» на 85% ширины окна — делитель 5,4 (4,59 кегля Inter 900 / 0,85),
// строки по 0,86 — то же в styles.css, раздел узкого окна
const LOGO_EM = 5.4
const LOGO_LH = 0.86

/** Раскладка подписи, превью и навигации в пикселях сцены. */
type Geo = {
  w: number; h: number; narrow: boolean
  preview: [number, number]
  prevLo: [number, number]    // левый верхний угол превью
  anchor: [number, number]    // точка роста слайда (kit/cornerZoom.ts)
  label: CSSProperties       // где стоит подпись
  title: CSSProperties; text: CSSProperties
  nav: CSSProperties          // «← 01 / 06 →» и стоп
  head: number                // низ шапки (узкое окно — под ним кончается тень сверху)
  shade: number               // откуда начинается тень снизу (узкое окно)
}

function geo(w: number, h: number, narrow: boolean): Geo {
  // превью (круг 9): высота — высота букв «ЮНУСОВ» (CAP), ширина — по пропорции экрана; запись — ширина PREVIEW; узкое окно — 28%
  const preview: [number, number] = narrow ? [Math.round(w * 0.28), Math.round(h * 0.28)]
    : isRecord ? [PREVIEW[0], Math.round((PREVIEW[0] * h) / w)] : [(CAP * w) / h, CAP]
  const corner = { preview, prevLo: [w - preview[0], h - preview[1]] as [number, number], anchor: [w, h] as [number, number] }
  if (!narrow) {
    // середина строки заголовка подписи — y 535 из 1080, первая строка текста — на 44 ниже; по x подпись
    // прижата к левому краю, по меню (правка Павла 15.10)
    const y = Math.round((535 * h) / 1080)
    // превью — в левом нижнем углу (круг 6), навигация — на нём (styles.css, .gswitch.at-corner)
    const lo: [number, number] = [0, h - preview[1]]
    const at = isRecord ? corner : { preview, prevLo: lo, anchor: anchorFor(lo, [w, h], preview) }
    return { w, h, narrow, ...at, head: 0, shade: 0,
      label: { left: 40, top: y - 16, width: 560 },
      title: { font: '17px/32px var(--mono)', letterSpacing: 2 },
      text: { font: '17px/28px var(--mono)', marginTop: 14 },
      nav: {} }
  }
  const k = w / innerWidth   // пикселей сцены в пикселе окна
  const menuTop = (14 + 2 * LOGO_LH * (innerWidth - 32) / LOGO_EM + 18) * k
  return { w, h, narrow, ...corner, head: menuTop + 30 * k, shade: h - preview[1] - 200 * k,
    label: { left: 16 * k, bottom: preview[1] + 28 * k, width: w - 32 * k },
    title: { font: `${13 * k}px/${20 * k}px var(--mono)`, letterSpacing: 1.5 * k },
    text: { font: `${14 * k}px/${21 * k}px var(--mono)`, marginTop: 10 * k },
    nav: { right: 16 * k, top: menuTop - 4 * k, fontSize: 12 * k } }
}

/** Картинка слайда во весь кадр (как object-fit: cover) и тень под белым текстом: в широком окне — слева
 *  (у левого края темнее, справа картинка почти чистая), в узком — сверху под шапкой и снизу под подписью. */
function coverTexture(G: Geo, im: HTMLImageElement) {
  const c = document.createElement('canvas')
  c.width = G.w
  c.height = G.h
  const g = c.getContext('2d')!
  const k = Math.max(G.w / im.naturalWidth, G.h / im.naturalHeight)
  const w = im.naturalWidth * k
  const hh = im.naturalHeight * k
  g.drawImage(im, (G.w - w) / 2, (G.h - hh) / 2, w, hh)
  if (!G.narrow) {
    const left = g.createLinearGradient(0, 0, G.w, 0)
    left.addColorStop(0, 'rgba(0,0,0,0.82)')
    left.addColorStop(0.3, 'rgba(0,0,0,0.62)')
    left.addColorStop(0.55, 'rgba(0,0,0,0.28)')
    left.addColorStop(0.8, 'rgba(0,0,0,0.04)')
    left.addColorStop(1, 'rgba(0,0,0,0)')
    g.fillStyle = left
    g.fillRect(0, 0, G.w, G.h)
    // снизу — под нижнюю строку: переключатель на превью и подписи левее разметки 60 / 40 (круг 6)
    const bot = g.createLinearGradient(0, G.h - 320, 0, G.h)
    bot.addColorStop(0, 'rgba(0,0,0,0)')
    bot.addColorStop(1, 'rgba(0,0,0,0.55)')
    g.fillStyle = bot
    g.fillRect(0, G.h - 320, G.w, 320)
    return texture(c)
  }
  const top = g.createLinearGradient(0, 0, 0, G.head * 1.3)
  top.addColorStop(0, 'rgba(0,0,0,0.62)')
  top.addColorStop(1, 'rgba(0,0,0,0)')
  g.fillStyle = top
  g.fillRect(0, 0, G.w, G.h)
  const bot = g.createLinearGradient(0, G.shade, 0, G.h)
  bot.addColorStop(0, 'rgba(0,0,0,0)')
  bot.addColorStop(0.35, 'rgba(0,0,0,0.72)')
  bot.addColorStop(1, 'rgba(0,0,0,0.88)')
  g.fillStyle = bot
  g.fillRect(0, G.shade, G.w, G.h)
  return texture(c)
}

/** Пустая подпись для шейдера: подписи теперь текстом поверх него. */
function emptyTexture() {
  const t = new THREE.DataTexture(new Uint8Array(4), 1, 1)
  t.needsUpdate = true
  return t
}

type Api = { next: () => void; prev: () => void }
type Rect = { x: number; y: number; w: number; h: number }

type Pt = [number, number]

/** Превью: за курсором (широкое окно, круг 8 — единственный вариант) или в углу (узкое окно и запись ?record).
 *  За курсором точка роста — сам курсор: превью — экран, сжатый к нему, курсор внутри превью там же, где на экране;
 *  по клику слайд растёт ровно из точки клика (круг 7: «всегда от центра клика»). */
type Mode = 'corner' | 'cursor'

// текстуры слайдов под размер сцены — между заходами на главную не рисуются заново (круг 7: подвисание при переходе)
let texCache: { key: string; tex: THREE.Texture[] } | null = null

function Scene({ T, G, api, labels, onSlide, anchor, target, follow, onDrawn }: {
  T: THREE.Texture[]; G: Geo; api: React.MutableRefObject<Api | null>
  labels: React.MutableRefObject<(HTMLElement | null)[]>; onSlide: (i: number | null, target: number) => void
  anchor: React.MutableRefObject<Pt>; target: React.MutableRefObject<Pt>; follow: React.MutableRefObject<boolean>
  onDrawn: () => void   // первый кадр нарисован — текстуры уже в видеокарте, переходу можно начинать (main.tsx, .lp-ready)
}) {
  const { gl, scene, camera, invalidate } = useThree()
  const mat = useRef<THREE.ShaderMaterial>(null)
  const drawn = useRef<Pt | null>(null)   // точка роста в последнем нарисованном кадре
  const [blank] = useState(emptyTexture)
  const [uniforms] = useState(() => cornerUniforms(T[0], T[1], T[2], blank, blank, { res: [G.w, G.h], preview: G.preview, anchor: G.anchor }))
  const st = useRef({ i: 0, p: 0, labelB: 0, tl: null as gsap.core.Timeline | null })
  const rects = useRef<Rect[]>([])
  const { ease, duration } = easeOf(e)
  const n = T.length
  const s0 = G.preview[0] / G.w

  /** Подписи поверх шейдера: старая — всё, кроме части под рамкой нового слайда; новая — только внутри рамки. */
  const placeLabels = () => {
    const s = st.current
    const iA = s.i % n
    const iB = (s.i + 1) % n
    const [fl, ft, fr, fb] = zoomRect(s0 + (1 - s0) * s.p, anchor.current, [G.w, G.h])
    labels.current.forEach((el, k) => {
      if (!el) return
      const r = (rects.current[k] ??= { x: el.offsetLeft, y: el.offsetTop, w: el.offsetWidth, h: el.offsetHeight })
      // рамка в координатах подписи, обрезанная по подписи
      const x1 = Math.max(0, fl - r.x)
      const y1 = Math.max(0, ft - r.y)
      const x2 = Math.min(r.w, fr - r.x)
      const y2 = Math.min(r.h, fb - r.y)
      const empty = x1 >= x2 || y1 >= y2
      if (k === iA) {
        if (s.p === 0 || empty) el.style.clipPath = 'none'
        else if (x1 <= 0 && y1 <= 0 && x2 >= r.w && y2 >= r.h) el.style.clipPath = 'inset(100%)'
        // подпись без прямоугольника рамки: контур подписи и контур рамки, evenodd вырезает второй из первого
        else el.style.clipPath = `polygon(evenodd, 0 0, 100% 0, 100% 100%, 0 100%, 0 0, ${x1}px ${y1}px, ${x2}px ${y1}px, ${x2}px ${y2}px, ${x1}px ${y2}px, ${x1}px ${y1}px)`
        el.style.visibility = 'visible'
      } else if (k === iB && s.labelB > 0) {
        el.style.clipPath = empty ? 'inset(100%)' : `inset(${y1}px ${r.w - x2}px ${r.h - y2}px ${x1}px)`
        el.style.visibility = 'visible'
      } else el.style.visibility = 'hidden'
    })
  }

  const apply = () => {
    const s = st.current
    const u = mat.current?.uniforms ?? uniforms
    u.uA.value = T[s.i % n]
    u.uB.value = T[(s.i + 1) % n]
    u.uC.value = T[(s.i + 2) % n]
    // размытие движения выключено (круг 9): прогресс в начале выдержки кадра = прогрессу сейчас
    const prev = s.p   // без размытия (решение Павла, круг 9): выдержка нулевая — одна выборка на пиксель
    u.uP.value.set(s.p, prev)
    u.uF.value.set(...anchor.current)
    drawn.current = anchor.current
    previewAt.F = anchor.current   // превью меню появляется отсюда (demo/previewAt.ts)
    placeLabels()
  }

  /** Точка роста догоняет цель плавно (курсор; с замочком — левый нижний угол, круг 9); во время хода стоит —
   *  слайд растёт оттуда, где было превью. */
  const chase = (dt: number) => {
    if (st.current.tl) return
    const k = 1 - Math.exp(-Math.min(dt, 1 / 30) * 14)   // после простоя первый кадр приходит с большим dt
    const a = anchor.current
    const t = target.current
    anchor.current = [a[0] + (t[0] - a[0]) * k, a[1] + (t[1] - a[1]) * k]
  }

  /** Одна смена слайда: таймлайн на паузе, t = 0 — старт хода. */
  const transition = () => {
    const s = st.current
    const tl = gsap.timeline({ paused: true })
    tl.fromTo(s, { p: 0 }, { p: 1, duration, ease, immediateRender: false }, 0)
    tl.set(s, { labelB: 0 }, 0)
    tl.set(s, { labelB: 1 }, LABEL_B_AT)
    return tl
  }

  useLayoutEffect(() => {
    if (isRecord) {
      const master = gsap.timeline({ paused: true })
      master.set({}, {}, tOf(e, e.window[1]))
      const tl = transition()
      st.current.tl = tl
      master.add(tl.paused(false), tOf(e, e.trigger_frame))
      return registerScenario(e, { timeline: master, render: () => { apply(); gl.render(scene, camera) } })
    }
    onSlide(st.current.i, st.current.i)
    api.current = {
      next: () => {
        const s = st.current
        if (s.tl) return
        const tl = transition()
        s.tl = tl
        onSlide(null, (s.i + 1) % n)   // пока идёт ход, подпись не кликается
        tl.eventCallback('onComplete', () => {
          // после хода новый слайд — текущий, превью — следующий: картинка та же, меняются роли
          s.i = (s.i + 1) % n
          s.p = 0
          s.labelB = 0
          s.tl = null
          onSlide(s.i, s.i)
        })
        tl.play(0)
      },
      // назад — тот же ход в обратную сторону: текущий слайд уходит в превью, открывая предыдущий
      prev: () => {
        const s = st.current
        if (s.tl) return
        s.i = (s.i - 1 + n) % n
        const tl = transition()
        s.tl = tl
        tl.progress(1)
        onSlide(null, s.i)
        tl.eventCallback('onReverseComplete', () => {
          s.p = 0
          s.labelB = 0
          s.tl = null
          onSlide(s.i, s.i)
        })
        tl.reverse()
      },
    }
    return () => {
      api.current = null
    }
  }, [])

  const first = useRef(true)
  useFrame((_, dt) => {
    if (first.current) {
      first.current = false
      requestAnimationFrame(onDrawn)
    }
    chase(dt)
    apply()
  })

  // кадр по запросу (ShaderCanvas, frameloop 'demand'): пока идёт ход, пока превью догоняет курсор, ещё один кадр после хода
  // и когда точка роста сменилась (переключили вариант превью). В покое видеокарта не занята
  useEffect(() => {
    if (isRecord) return
    let tail = false
    const tick = () => {
      const s = st.current
      const a = anchor.current
      const t = target.current
      const d = drawn.current
      const moving = follow.current && Math.hypot(a[0] - t[0], a[1] - t[1]) > 0.3
      const moved = !d || d[0] !== a[0] || d[1] !== a[1]
      if (s.tl || moving || moved || tail) invalidate()
      tail = !!s.tl
    }
    gsap.ticker.add(tick)
    invalidate()
    return () => {
      gsap.ticker.remove(tick)
      previewAt.F = null
    }
  }, [])

  return <ShaderPlane ref={mat} vert={vert} frag={frag} uniforms={uniforms} />
}

export default function Slider() {
  const { w, h, narrow } = useStage()
  const [G] = useState(() => geo(w, h, narrow))
  const [tex, setTex] = useState<THREE.Texture[] | null>(null)
  const [cur, setCur] = useState<number | null>(null)   // слайд, когда не идёт ход
  const [idx, setIdx] = useState(0)                     // номер в навигации: куда идём
  const [hover, setHover] = useState(false)
  const [paused, setPaused] = useState(false)
  const [drawn, setDrawn] = useState(false)   // первый кадр шейдера нарисован — метка готовности для перехода
  const api = useRef<Api | null>(null)
  const labels = useRef<(HTMLElement | null)[]>([])
  // широкое окно — превью за курсором, с замочком (круг 9, demo/lock.ts) — прилипает к левому нижнему углу;
  // узкое окно и запись — в углу (до первого движения мыши — тоже в углу)
  const [locked, setLocked] = useState(readLock)
  const mode: Mode = narrow || isRecord || locked ? 'corner' : 'cursor'
  const anchor = useRef<Pt>(G.anchor)
  const target = useRef<Pt>(G.anchor)
  const follow = useRef(mode === 'cursor')
  follow.current = mode === 'cursor'

  useEffect(() => {
    if (mode === 'corner') return void (target.current = G.anchor)   // замочек: превью уезжает в угол
    const move = (ev: PointerEvent) => void (target.current = toStage(ev))
    window.addEventListener('pointermove', move)
    return () => window.removeEventListener('pointermove', move)
  }, [mode])
  const toggleLock = () => {
    saveLock(!locked)
    setLocked(!locked)
  }
  const toStage = (ev: { clientX: number; clientY: number }): Pt => [(ev.clientX * G.w) / innerWidth, (ev.clientY * G.h) / innerHeight]
  // клик за курсором: точка роста — ровно точка клика, даже если превью ещё не догнало курсор
  const nextFrom = (ev: React.MouseEvent) => {
    if (mode === 'cursor') {
      const p = toStage(ev)
      anchor.current = p
      target.current = p
    }
    api.current?.next()
  }

  useLayoutEffect(() => {
    const key = `${G.w}x${G.h}${narrow ? 'n' : ''}`
    if (texCache?.key === key) return setTex(texCache.tex)
    Promise.all([preload(slides.map((s) => img(narrow ? s.portrait : s.img))), document.fonts.ready]).then(([imgs]) => {
      const t = imgs.map((im) => coverTexture(G, im))
      texCache = { key, tex: t }
      setTex(t)
    })
  }, [])


  // автоплей; стоит, пока курсор на подписи со ссылкой или нажат стоп; ручной переход начинает отсчёт заново
  useEffect(() => {
    if (isRecord || hover || paused) return
    const id = setInterval(() => api.current?.next(), AUTOPLAY_MS)
    return () => clearInterval(id)
  }, [hover, paused, idx])

  useEffect(() => {
    const key = (ev: KeyboardEvent) => {
      if (ev.key === 'ArrowRight') api.current?.next()
      if (ev.key === 'ArrowLeft') api.current?.prev()
    }
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  }, [])

  const onSlide = (i: number | null, target: number) => {
    setCur(i)
    setIdx(target)
  }

  return (
    <DemoStage set="motion" id="01-04">
      {tex && (
        <>
          {drawn && <i className="lp-ready" hidden />}
          <ShaderCanvas>
            <Scene T={tex} G={G} api={api} labels={labels} onSlide={onSlide} anchor={anchor} target={target} follow={follow}
              onDrawn={() => setDrawn(true)} />
          </ShaderCanvas>
          {slides.map((s, k) => {
            const to = s.article === undefined || isRecord ? -1 : articles.findIndex((a) => a.slug === s.article)
            const body = (
              <>
                <div className="sl-title" style={G.title}>{s.title}{to >= 0 && <span className="sl-arrow">→</span>}</div>
                <div className="sl-text" style={G.text}>{s.text}</div>
              </>
            )
            const ref = (el: HTMLElement | null) => void (labels.current[k] = el)
            const style = { ...G.label, visibility: k === 0 ? 'visible' : 'hidden' } as CSSProperties
            // ссылки под текстом слайда (Павел 16.10): ссылка внутри ссылки нельзя — подпись делится на переход в проект и строку ссылок
            if (to >= 0 && s.links?.length) return (
              <div key={k} ref={ref} className={`sl ${cur === k ? 'on' : ''}`} style={style}>
                <a className="sl-link" href={`#/projects/${to}`} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}>
                  {body}
                </a>
                <div className="sl-links" style={G.text}>
                  {s.links.map((l) => <a key={l.href} href={l.href} target="_blank" rel="noreferrer">{l.text} ↗</a>)}
                </div>
              </div>
            )
            return to >= 0 ? (
              <a key={k} ref={ref} className={`sl sl-link ${cur === k ? 'on' : ''}`} style={style} href={`#/projects/${to}`}
                onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}>
                {body}
              </a>
            ) : (
              <div key={k} ref={ref} className="sl" style={style}>{body}</div>
            )
          })}
          {/* широкое окно: имя, меню и подписи — один слой поверх экранов (main.tsx), при переходах стоят на месте */}
          {narrow ? (
            <div className="chrome nchrome">
              <Logo />
              <Menu active="home" />
              <Foot />
            </div>
          ) : (
            isRecord && <Chrome active="home" />
          )}
          {!isRecord && (
            <>
              {/* следующий слайд: в углу — клик по превью; за курсором — клик в любом месте фона (под подписями и меню) */}
              <button
                className={`hit ${mode === 'cursor' ? 'hit-all' : ''}`}
                title="следующий слайд"
                style={mode === 'cursor' ? undefined : { left: G.prevLo[0], top: G.prevLo[1], width: G.preview[0], height: G.preview[1] }}
                onClick={nextFrom}
              />
              <Switch className={`snav ${narrow ? '' : 'at-corner'}`} i={idx} n={slides.length} style={G.nav} paused={paused}
                onGo={(d) => (d > 0 ? api.current?.next() : api.current?.prev())} onPause={() => setPaused((p) => !p)}
                locked={narrow ? undefined : locked} onLock={narrow ? undefined : toggleLock} />
            </>
          )}
        </>
      )}
    </DemoStage>
  )
}
