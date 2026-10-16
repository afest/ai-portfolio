// Проекты (бывшие разборы) — демо блога из Linza (lab/src/sets/<набор>/demo/02-03.tsx): список справа,
// картинка слева. Клик по проекту — картинка въезжает справа целиком, подпись стоит в экранных координатах
// (встречный сдвиг), панель текста наезжает на список тем же твином (kit/slideIn.ts). «к списку» —
// обратный переход той же кривой. Слева два слоя по очереди: входящий всегда поверх, src видимой
// картинки не меняется — без мигания. Наведение — перебор букв (kit/scramble.ts) и линия.
// Правки Павла 15.10: картинка 60%, текст 40% с воздухом по бокам; строка списка — название слева, статус справа, тише;
// текст прокручивается обычной прокруткой; слева — галерея кадров проекта: сменяются сами тем же въездом
// (02-03), переключатель с номерами, стоп и «на весь экран» — просмотр раскрывается вправо поверх текста
// той же кривой: текст уезжает вправо, подписи и шапка — влево, интерфейс просмотра въезжает слева;
// подпись и переключатель — у левого края; сверху — «ПРОЕКТЫ ← 02 / 10 →» постоянной ширины.
// Круг 5: соседний проект — верхняя строка стоит, текст нового проекта наезжает страницей поверх прежнего
// с той же стороны, что картинка (прежний остаётся снимком под ним, как список под проектом).
// Круг 6: переключатель галереи — в левом нижнем углу, там же, где на главной; «на весь экран» — кадр во весь
// экран растёт масштабом из нижнего крестика разметки (demo/Marks.tsx), переключатель стоит на месте, остальное
// скрывается под кадром; закрытие — экран проекта (группа pgroup) растёт из того же крестика поверх кадра,
// как переход главная → проекты.
// Адрес #/projects/<n> открывает проект сразу; список поднят, если не помещается по высоте окна.
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import gsap from 'gsap'
import { Chrome, DemoStage, useStage } from '../demo/DemoStage'
import { effect, isRecord, preload, registerScenario, tOf } from '../lab/harness'
import { easeOf } from '../lab/ease'
import { ABOUT_HEAD, COVER_LABEL, RAZBORY_HEAD, articles, blogCover, img, type Block, type Link } from '../demo/content'
import { slideIn } from '../kit/slideIn'
import { Fx, clearUnderlines, fx, hoverIn, hoverOut } from '../demo/fx'
import { AUTOPLAY_MS, Icon, Pager, Switch } from '../demo/Switch'
import { IMG_W, LINE, capScale, grow } from '../demo/Marks'
import { readLock, saveLock } from '../demo/lock'
import { previewAt } from '../demo/previewAt'
import type * as THREE from 'three'
import { GalleryCanvas, galleryTextures, previewOf, type GalleryRun } from './gallery'

const e = effect('motion', '02-03')
const t1 = easeOf(effect('motion', '01-04'))   // кривая T1 — появление превью из угла, как рост превью на главной
export const PANEL = 1920 - IMG_W  // текст — правее линии разметки 60 / 40 на GAP (круг 7; до этого 60 / 40 ровно)
const LABEL_X = 40                // подпись — у левого края, по меню
const LIST_ROW = 16 * 1.45 + 32   // строка списка в пикселях окна: 16 px × 1,45 + отступ 32 (styles.css, .blog-list)
const ABOUT = articles.findIndex((a) => a.rubric === 'О СЕБЕ')   // первые ABOUT статей — проекты, дальше «о себе» (круг 7)


type Pt = [number, number]
/** Ждать условия (каждый кадр), не дольше ms; true — дождались. */
const waitFor = (ok: () => boolean, ms: number) => new Promise<boolean>((r) => {
  const t0 = performance.now()
  const f = () => (ok() ? r(true) : performance.now() - t0 > ms ? r(false) : requestAnimationFrame(f))
  f()
})
/** Дождаться n отрисовок браузера. */
const frames = (n: number) => new Promise<void>((r) => {
  const f = (k: number) => (k <= 0 ? r() : requestAnimationFrame(() => f(k - 1)))
  f(n)
})

type Layer = { wrap: HTMLDivElement; img: HTMLImageElement; label: HTMLDivElement }

/** **жирный**, [ссылка](адрес), [!ссылка](адрес) — синяя жирная, {заглушка} */
export function rich(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*|\[[^\]]+\]\([^)]+\)|\{[^}]+\})/g).map((t, k) => {
    if (t.startsWith('**')) return <b key={k}>{t.slice(2, -2)}</b>
    const a = t.match(/^\[(!?)([^\]]+)\]\(([^)]+)\)$/)
    if (a) return <a key={k} className={a[1] ? 'hl' : undefined} href={a[3]} target="_blank" rel="noreferrer" {...fx}><Fx text={a[2]} /></a>
    if (t.startsWith('{')) return <span key={k} className="todo">{t.slice(1, -1)}</span>
    return t
  })
}

/** Ссылки сразу под заголовком статьи — синие жирные, со стрелкой (Павел 16.10: «в конце текста не заметят»). */
export function ArticleLinks({ links }: { links?: Link[] }) {
  if (!links?.length) return null
  return (
    <p className="hlinks">
      {links.map((l, k) => (
        <a key={k} className="hl" href={l.href} target="_blank" rel="noreferrer" {...fx}><Fx text={l.text} /> ↗</a>
      ))}
    </p>
  )
}

export function BlockView({ b }: { b: Block }) {
  if ('h' in b) return <p className="sub">{b.h}</p>
  if ('ul' in b) return <ul>{b.ul.map((t, k) => <li key={k}>{rich(t)}</li>)}</ul>
  return <p>{rich(b.p)}</p>
}

export const fromHash = () => {
  const m = location.hash.match(/^#\/(?:projects|razbory)\/(\d+)/)
  const k = m ? Number(m[1]) : NaN
  return k >= 0 && k < articles.length ? k : null
}

const two = (n: number) => String(n).padStart(2, '0')
/** Верх панели проекта: «ПРОЕКТЫ ← 02 / 10 →» (статус не пишем — ширина постоянная, ничего не прыгает),
 *  «к списку» — тихой ссылкой со значком, рамка при наведении. В подсказках стрелок — названия соседних проектов. */
export function PanelTop({ open, onStep, onBack, className }: { open: number; onStep: (d: 1 | -1) => void; onBack: () => void; className?: string }) {
  const n = articles.length
  const prev = articles[(open - 1 + n) % n]
  const next = articles[(open + 1) % n]
  return (
    <div className={className}>
      <span className="crumb">{RAZBORY_HEAD}</span>
      <Pager i={open} n={n} onGo={onStep} titles={[prev.title, next.title]} />
      <button className="back" onClick={onBack} {...fx}>
        <span className="fx">{Icon.list}<span className="t" data-text="к списку" ref={(el) => void (el && !el.textContent && (el.textContent = 'к списку'))} /><i className="ul" /></span>
      </button>
    </div>
  )
}

export default function Razbory() {
  const { h, scale } = useStage()
  const first = useRef(isRecord ? null : fromHash())
  const [ready, setReady] = useState(false)
  const [open, setOpen] = useState<number | null>(first.current)
  const [gi, setGi] = useState(0)              // кадр галереи открытого проекта
  const [paused, setPaused] = useState(false)
  const [zoom, setZoom] = useState(false)       // просмотр «на весь экран» на странице (живёт до конца хода закрытия)
  const [zoomOn, setZoomOn] = useState(false)   // нажато «на весь экран»: значок и шапка меняются сразу по клику (круг 7)
  const layers = useRef<(Layer | null)[]>([null, null])
  const top = useRef(0)            // какой слой сейчас видимый
  const panel = useRef<HTMLDivElement>(null)
  const inner = useRef<HTMLDivElement>(null)
  const zoomEl = useRef<HTMLDivElement>(null)
  const busy = useRef(false)
  const enterDir = useRef<0 | 1 | -1>(0)   // соседний проект: с какой стороны въезжает текст
  const z = useRef(1)
  const [moving, setMoving] = useState(false)   // идёт въезд (проект, список, кадр без шейдера) — превью кадра прячется

  // ---- галерея как на главной (круг 8, screens/gallery.tsx): превью следующего кадра за курсором по картинке, клик —
  // кадр растёт из точки клика; кадры для шейдера — на открытый проект, точка превью — до первого движения в левом нижнем углу
  const gSize: Pt = [IMG_W, h]
  const gPrevSize = previewOf(gSize)
  const gS0 = gPrevSize[0] / IMG_W
  const [gTex, setGTex] = useState<{ slug: string; T: THREE.Texture[] } | null>(null)
  const [gMoving, setGMoving] = useState(false)  // идёт ход галереи — виден холст, подпись проекта поверх него
  const gRun = useRef<GalleryRun | null>(null)
  const gCanvas = useRef<HTMLDivElement>(null)
  // превью — внутри слоя картинки, под подписью (круг 9: подпись поверх превью; новая картинка при листании проектов
  // накрывает превью вместе со своим слоем). Видимость и кадр — вручную (gSync): на время листания превью замирает
  const gPrevs = useRef<(HTMLDivElement | null)[]>([null, null])
  const gF = useRef<Pt>([0, h])
  const gGoal = useRef<Pt>([0, h])
  const [locked, setLocked] = useState(readLock)   // замочек (demo/lock.ts): превью прилипает к левому нижнему углу
  const lockedRef = useRef(locked)
  lockedRef.current = locked
  const openRef = useRef(open)
  openRef.current = open
  const giRef = useRef(gi)
  giRef.current = gi
  const labelY = Math.round((520 * h) / 1080)
  // список (круг 8): «ПРОЕКТЫ» — на верхней линии, как в открытом проекте (styles.css, .blog-head); от заголовка до первого
  // пункта — двойной шаг пунктов (по верху заглавных); «О СЕБЕ» — внизу, последняя строка на нижней строке (LINE), заголовок
  // над блоком — тоже через двойной шаг. Шаг — 55 px на экране; на низком окне сжимается, чтобы между блоками остался
  // хотя бы шаг (на 1536 × 740 — около 24 px просвета вместо 32)
  const textLine = (16 * 1.45) / scale
  const capIn = ((16 * 1.45 - 16) / 2 + 0.07 * 16) / scale   // верх заглавных строки списка от верха строки, px сцены
  const row = Math.min(LIST_ROW / scale, (h - 2 * LINE - 1.5 * textLine) / 13)
  const listTop = Math.round(LINE + 2 * row - capIn)
  const aboutTop = Math.round(h - LINE - textLine / 2 - (articles.length - ABOUT - 1) * row)
  const aboutHead = Math.round(aboutTop + capIn - 2 * row - 0.07 * Math.max(14, 14 / scale))
  const listStyle = (top: number) => ({ top, '--li-gap': `${row - textLine}px` }) as CSSProperties

  // ждём только то, что видно сразу (обложка и первый кадр открытого проекта), остальные кадры — в фоне после перехода
  // (круг 7: загрузка всех 30+ кадров на каждом заходе подвешивала переход)
  useLayoutEffect(() => {
    const need = [blogCover, ...(first.current !== null ? [articles[first.current].gallery[0]] : [])]
    preload(need.map((g) => img(`${g}.jpg`))).then(() => setReady(true))
  }, [])
  // переход между экранами ждёт картинок (main.tsx): метка .lp-ready — после обложки (в разметке ниже); остальные кадры —
  // в фоне через 1,5 с
  useEffect(() => {
    if (!ready) return
    const t = setTimeout(() => void preload(articles.flatMap((a) => a.gallery).map((g) => img(`${g}.jpg`))), 1500)
    return () => clearTimeout(t)
  }, [ready])
  // кадры «на весь экран» открытого проекта — заранее, чтобы просмотр не раскрывался пустым
  useEffect(() => {
    if (ready && open !== null) void preload(articles[open].gallery.map((g) => img(`${g}-n.jpg`)))
  }, [ready, open])
  // кадры галереи для шейдера — под размер картинки, на открытый проект; прежние освобождаются. Собираются не во время
  // въезда (листание проектов, переход между экранами — там это подтормаживало бы ход), а сразу после (круг 10)
  const gTexRef = useRef(gTex)
  gTexRef.current = gTex
  const firstTex = useRef(true)
  useEffect(() => {
    if (!ready || open === null || isRecord || moving || articles[open].gallery.length < 2) return
    const a = articles[open]
    if (gTexRef.current?.slug === a.slug) return
    let alive = true
    const t = setTimeout(() => {
      galleryTextures(a.gallery.map((g) => img(`${g}.jpg`)), gSize).then((T) => {
        if (!alive) return T.forEach((x) => x.dispose())
        setGTex((old) => {
          old?.T.forEach((x) => x.dispose())
          return { slug: a.slug, T }
        })
      })
    }, firstTex.current ? 1000 : 0)   // на первом заходе — после перехода между экранами
    firstTex.current = false
    return () => {
      alive = false
      clearTimeout(t)
    }
  }, [ready, open, moving])
  /** Превью по текущему состоянию: в верхнем слое — следующий кадр открытого проекта, в нижнем — ничего.
   *  appear — превью появляется из левого нижнего угла (после листания проектов и открытия проекта, круг 9). */
  const gSync = (appear = false) => {
    const o = openRef.current
    const a = o === null ? null : articles[o]
    gPrevs.current.forEach((el, i) => {
      if (!el) return
      const on = !!a && a.gallery.length > 1 && i === top.current && !isRecord
      el.style.visibility = on ? 'visible' : 'hidden'
      if (!on || !a) return
      el.querySelector('img')!.src = img(`${a.gallery[(giRef.current + 1) % a.gallery.length]}.jpg`)
      el.style.left = `${gF.current[0] * (1 - gS0)}px`
      el.style.top = `${gF.current[1] * (1 - gS0)}px`
      if (appear) gsap.fromTo(el, { scale: 0, transformOrigin: '0% 100%' }, { scale: 1, ease: t1.ease, duration: t1.duration, clearProps: 'transform' })
    })
  }
  const toggleLock = () => {
    saveLock(!locked)
    setLocked(!locked)
    if (!locked) gGoal.current = [0, h]   // замочек закрыли — превью уезжает в угол
  }
  // превью следующего кадра догоняет курсор, пока он над картинкой (с замочком — угол); на время листания — замирает
  const gShow = open !== null && articles[open].gallery.length > 1 && !moving && !gMoving && !isRecord
  useEffect(() => {
    if (!gShow) return
    const move = (ev: PointerEvent) => {
      const p = toStage(ev)
      if (!lockedRef.current && p[0] < IMG_W) gGoal.current = p
    }
    window.addEventListener('pointermove', move)
    let raf = 0
    let last = performance.now()
    const tick = (now: number) => {
      const dt = Math.min((now - last) / 1000, 1 / 30)
      last = now
      const [fx, fy] = gF.current
      const [gx, gy] = lockedRef.current ? [0, h] : gGoal.current
      const k = 1 - Math.exp(-dt * 14)
      gF.current = [fx + (gx - fx) * k, fy + (gy - fy) * k]
      previewAt.F = gF.current   // превью меню «Главная» появляется отсюда (demo/previewAt.ts)
      const el = gPrevs.current[top.current]
      if (el) {
        el.style.left = `${gF.current[0] * (1 - gS0)}px`
        el.style.top = `${gF.current[1] * (1 - gS0)}px`
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('pointermove', move)
      previewAt.F = null
    }
  }, [gShow])

  /** Переход: в невидимый слой — картинка и подпись, слой поверх, въезд (dir 1 — справа, −1 — слева).
   *  move — куда едет панель текста тем же ходом; без него панель стоит (смена кадра или соседний проект). */
  const transition = async (src: string, label: string, move?: [number, number], dir: 1 | -1 = 1) => {
    setMoving(true)
    const L = layers.current[1 - top.current]!
    L.img.src = src
    L.label.textContent = label
    await L.img.decode().catch(() => undefined)
    L.wrap.style.zIndex = String(++z.current)
    const { ease, duration } = easeOf(e)
    const tl = gsap.timeline({ paused: true })
    slideIn(tl, { wrap: L.wrap, label: L.label, distance: IMG_W * dir, companions: move ? [[panel.current, ...move]] : [],
      ease, duration, immediateRender: false })
    gsap.set(L.wrap, { x: IMG_W * dir })
    gsap.set(L.label, { x: -IMG_W * dir })
    // в обёртке: таймлайн GSAP — thenable, и await вернувшего его async ждал бы конца хода (вечно, он на паузе)
    return { tl }
  }

  /** appear — сменился проект (открыли, листнули): превью заново появляется из левого нижнего угла (круг 9). */
  const play = (tl: gsap.core.Timeline, done?: () => void, appear = false) => {
    tl.eventCallback('onComplete', () => {
      top.current = 1 - top.current
      busy.current = false
      setMoving(false)
      if (appear) {
        gF.current = [0, h]
        gGoal.current = [0, h]
      }
      done?.()
      gSync(appear)
    })
    tl.play(0)
  }

  /** Открыть проект из списка (k) или вернуться к списку (null). */
  const go = async (k: number | null) => {
    if (busy.current || !ready) return
    busy.current = true
    clearUnderlines()
    if (k !== null) {
      setOpen(k)
      setGi(0)
    }
    history.replaceState(null, '', k === null ? '#/projects' : `#/projects/${k}`)
    const a = k === null ? null : articles[k]
    const { tl } = await transition(img(`${a ? a.gallery[0] : blogCover}.jpg`), a ? a.title : COVER_LABEL,
      a ? [PANEL, 0] : [0, PANEL])
    play(tl, () => {
      if (k === null) {
        setOpen(null)
        openRef.current = null
      }
    }, k !== null)
  }

  /** Соседний проект: картинка и страница текста въезжают с той стороны, куда идём, тем же ходом; верхняя строка стоит.
   *  Прежний текст — снимок под новым (копия узла с той же прокруткой), убирается в конце хода. */
  const step = async (dir: 1 | -1) => {
    const cur = inner.current
    if (busy.current || open === null || !cur) return
    busy.current = true
    clearUnderlines()
    const k = (open + dir + articles.length) % articles.length
    const ghost = cur.cloneNode(true) as HTMLElement
    cur.before(ghost)
    ghost.scrollTop = cur.scrollTop
    enterDir.current = dir
    setOpen(k)
    setGi(0)
    history.replaceState(null, '', `#/projects/${k}`)
    const { tl } = await transition(img(`${articles[k].gallery[0]}.jpg`), articles[k].title, undefined, dir)
    const { ease, duration } = easeOf(e)
    tl.fromTo(cur, { x: PANEL * dir }, { x: 0, ease, duration, immediateRender: false }, 0)
    play(tl, () => ghost.remove(), true)
  }

  /** Галерея: следующий / предыдущий кадр открытого проекта. Круг 8 — как на главной: кадр растёт из превью (точки at
   *  или текущей точки превью) на шейдере (screens/gallery.tsx); пока кадры для шейдера не готовы — прежним въездом. */
  const shift = async (dir: 1 | -1, at?: Pt) => {
    if (busy.current || open === null) return
    const a = articles[open]
    const len = a.gallery.length
    const n = (gi + dir + len) % len
    // кадры для шейдера ещё собираются (только что листнули проект) — ждём их, а не листаем въездом (круг 10:
    // первая смена кадра после листания шла как смена проекта); не дождались за 2 с — тогда въездом
    if (!gRun.current || gTexRef.current?.slug !== a.slug) {
      busy.current = true
      const ok = await waitFor(() => !!gRun.current && gTexRef.current?.slug === a.slug, 2000)
      busy.current = false
      if (ok) return shift(dir, at)
      busy.current = true
      setGi(n)
      const { tl } = await transition(img(`${a.gallery[n]}.jpg`), a.title, undefined, dir)
      return play(tl)
    }
    const run = gRun.current
    busy.current = true
    if (at) {
      gF.current = at
      gGoal.current = at
    }
    const [A, B, C] = dir > 0 ? [gi, n, (n + 1) % len] : [n, gi, (gi + 1) % len]
    run.prepare(A, B, C, gF.current, dir)
    await frames(2)                  // первый кадр хода нарисован, пока холст скрыт
    // холст виден, превью DOM спрятано — в одном кадре (вручную, без ожидания отрисовки React)
    if (gCanvas.current) gCanvas.current.style.visibility = 'visible'
    const pv = gPrevs.current[top.current]
    if (pv) pv.style.visibility = 'hidden'
    setGMoving(true)                 // подпись проекта — поверх холста
    setGi(n)
    giRef.current = n
    await run.start()
    const L = layers.current[top.current]!
    L.img.src = img(`${a.gallery[n]}.jpg`)
    await L.img.decode().catch(() => undefined)
    gSync()
    if (gCanvas.current) gCanvas.current.style.visibility = 'hidden'
    setGMoving(false)
    busy.current = false
  }

  // кадры сменяются сами; стоп и ручной переход (зависимость от gi) начинают отсчёт заново
  useEffect(() => {
    if (!ready || isRecord || paused || open === null || articles[open].gallery.length < 2) return
    const t = setTimeout(() => void shift(1), AUTOPLAY_MS)
    return () => clearTimeout(t)
  }, [ready, open, gi, paused])

  // проект по адресу: открыт сразу, без въезда
  useLayoutEffect(() => {
    if (!ready || first.current === null) return
    const a = articles[first.current]
    const L = layers.current[top.current]!
    L.img.src = img(`${a.gallery[0]}.jpg`)
    L.label.textContent = a.title
    gsap.set(panel.current, { x: 0 })
    gSync(true)
  }, [ready])

  // запись: один проект открывается в кадре trigger_frame
  useLayoutEffect(() => {
    if (!ready || !isRecord) return
    let unreg = () => {}
    setOpen(0)
    transition(img(`${articles[0].gallery[0]}.jpg`), articles[0].title, [PANEL, 0]).then(({ tl }) => {
      const master = gsap.timeline({ paused: true })
      master.set({}, {}, tOf(e, e.window[1]))
      master.add(tl.paused(false), tOf(e, e.trigger_frame))
      unreg = registerScenario(e, { timeline: master })
    })
    return () => unreg()
  }, [ready])

  // новый проект — с начала текста; соседний — страница сразу за краем панели, пока не начался въезд (step)
  useLayoutEffect(() => {
    if (inner.current) inner.current.scrollTop = 0
    if (enterDir.current && inner.current) gsap.set(inner.current, { x: PANEL * enterDir.current })
    enterDir.current = 0
  }, [open])

  // «на весь экран» (круг 7): кадр во весь экран растёт масштабом из точки нажатия на «на весь экран» и сжимается
  // обратно в точку нажатия на «свернуть» (переключатель стоит в углу — точка та же). Значок меняется сразу по клику,
  // а не в конце хода. Смена кадра внутри — проявлением (swap).
  // Круг 8: шапка (имя, меню, подписи — слой поверх экранов) не гаснет, а накрывается кадром: в слое шапки вырезается
  // окно размером с растущий кадр (clip-path, evenodd); переключатель и подпись проекта — поверх кадра.
  // Наведение на «на весь экран» — под курсором маленькое превью кадра (высота CAP, пропорция экрана — круг 9), просмотр растёт из него.
  const zoomFirst = useRef('')
  const zoomBusy = useRef(false)
  const zoomAt = useRef<[number, number]>([0, h])
  const toStage = (ev: { clientX: number; clientY: number }): [number, number] => [ev.clientX / scale, ev.clientY / scale]
  const zoomFrom = useRef(0)
  const xs = capScale(h)   // превью «на весь экран» под курсором: высота CAP, пропорция экрана (круг 9)
  const coverChrome = (s: number) => {
    const c = document.querySelector<HTMLElement>('.page.clayer')
    if (!c) return
    if (s <= 0.0001) return void (c.style.clipPath = '')
    const W = innerWidth
    const H = innerHeight
    const [px, py] = [zoomAt.current[0] * scale, zoomAt.current[1] * scale]
    const l = px * (1 - s)
    const t = py * (1 - s)
    const r = px + s * (W - px)
    const b = py + s * (H - py)
    c.style.clipPath = `polygon(evenodd, 0 0, ${W}px 0, ${W}px ${H}px, 0 ${H}px, 0 0, ${l}px ${t}px, ${r}px ${t}px, ${r}px ${b}px, ${l}px ${b}px, ${l}px ${t}px)`
  }
  const openZoom = (ev: React.MouseEvent) => {
    if (zoomBusy.current || zoom) return
    zoomAt.current = toStage(ev)
    zoomFrom.current = xHover ? xs : 0
    zoomFirst.current = gallery[gi]
    setXHover(false)
    setZoomOn(true)
    setZoom(true)
  }
  useLayoutEffect(() => {
    const el = zoomEl.current
    if (!zoom || !el) return
    zoomBusy.current = true
    grow(el, zoomAt.current, 'in', () => void (zoomBusy.current = false), zoomFrom.current, coverChrome)
  }, [zoom])
  // глазик подписи в «на весь экран»: текст сворачивается справа налево (обрезка справа), значок едет за краем текста
  // к его началу; второе нажатие — обратно. Закрыли просмотр — подпись снова открыта
  const [eyeOn, setEyeOn] = useState(true)
  const gText = useRef<HTMLSpanElement>(null)
  const gEye = useRef<HTMLButtonElement>(null)
  const gLabel = useRef<HTMLDivElement>(null)
  const toggleEye = () => {
    const t = gText.current
    const b = gEye.current
    if (!t || !b) return
    const on = !eyeOn
    const k = { duration: 0.5, ease: 'power2.inOut', overwrite: true }
    gsap.to(t, { clipPath: on ? 'inset(0% 0% 0% 0%)' : 'inset(0% 100% 0% 0%)', ...k })
    gsap.to(b, { x: on ? 0 : -b.offsetLeft, ...k })
    setEyeOn(on)
  }
  useEffect(() => {
    if (!zoom) setEyeOn(true)
  }, [zoom])
  const closeZoom = (ev?: React.MouseEvent) => {
    const el = zoomEl.current
    if (!el || zoomBusy.current || !zoom) return
    zoomBusy.current = true
    if (ev) zoomAt.current = toStage(ev)
    setZoomOn(false)
    // подпись поверх кадра (со значком глазика) гаснет, пока кадр не дошёл до неё: под кадром уже стоит название проекта
    if (gLabel.current) gsap.to(gLabel.current, { opacity: 0, duration: 0.25, ease: 'power1.out' })
    grow(el, zoomAt.current, 'out', () => {
      coverChrome(0)
      zoomBusy.current = false
      setZoom(false)
    }, 0, coverChrome)
  }
  useEffect(() => () => coverChrome(0), [])   // ушли с экрана посреди просмотра — шапку не оставляем обрезанной

  // превью кадра под курсором при наведении на «на весь экран»
  const [xHover, setXHover] = useState(false)
  const xBox = useRef<HTMLDivElement>(null)
  const xPos = useRef<[number, number] | null>(null)
  const xGoal = useRef<[number, number]>([0, 0])
  const onExpandHover = (on: boolean, ev: React.MouseEvent) => {
    if (zoomOn) return
    if (on) {
      xGoal.current = toStage(ev)
      xPos.current = xGoal.current
    }
    setXHover(on)
  }
  useEffect(() => {
    if (!xHover || zoom) return
    const move = (ev: PointerEvent) => void (xGoal.current = toStage(ev))
    window.addEventListener('pointermove', move)
    let raf = 0
    let last = performance.now()
    const tick = (now: number) => {
      const dt = Math.min((now - last) / 1000, 1 / 30)
      last = now
      const g = xGoal.current
      const p = xPos.current ?? g
      const k = 1 - Math.exp(-dt * 14)
      xPos.current = [p[0] + (g[0] - p[0]) * k, p[1] + (g[1] - p[1]) * k]
      const el = xBox.current
      if (el) {
        el.style.left = `${xPos.current[0] * (1 - xs)}px`
        el.style.top = `${xPos.current[1] * (1 - xs)}px`
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('pointermove', move)
    }
  }, [xHover, zoom])
  useEffect(() => {
    const key = (ev: KeyboardEvent) => {
      if (open === null) return
      if (ev.key === 'Escape' && zoom) closeZoom()
      if (ev.key === 'ArrowRight') void shift(1)
      if (ev.key === 'ArrowLeft') void shift(-1)
    }
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  })

  const layer = (i: number) => (
    <div
      key={i}
      className="layer"
      style={{ width: IMG_W, overflow: 'hidden', zIndex: i === 0 ? 1 : 0 }}
      ref={(el) => {
        if (!el || layers.current[i]?.wrap === el) return   // ref зовётся на каждой перерисовке — сдвиг только при монтировании
        layers.current[i] = { wrap: el, img: el.querySelector('img')!, label: el.querySelector('.slide-label')! }
        if (i === 1) gsap.set(el, { x: IMG_W })
      }}
    >
      <img className="cover" src={img(`${blogCover}.jpg`)} alt="" style={{ width: IMG_W, height: h }} />
      {/* превью следующего кадра — над картинкой слоя, под подписью; кадр, место и видимость ставит gSync */}
      {!isRecord && (
        <div ref={(el) => void (gPrevs.current[i] = el)} className={`gprev ${locked ? 'click' : ''}`}
          style={{ width: gPrevSize[0], height: gPrevSize[1], visibility: 'hidden' }}
          title={locked ? 'следующий кадр' : undefined} onClick={() => void (locked && shift(1, [0, h]))}>
          <img alt="" />
        </div>
      )}
      <div className="slide-label" style={{ left: LABEL_X, top: labelY }}>{COVER_LABEL}</div>
    </div>
  )

  /** Строка списка: название слева, статус справа (у «о себе» статуса нет — он и есть заголовок блока). */
  const listRow = (x: (typeof articles)[number], k: number, rubric = true) => (
    <li key={x.slug} onClick={() => go(k)} onMouseEnter={(ev) => hoverIn(ev.currentTarget, x.title)} onMouseLeave={(ev) => hoverOut(ev.currentTarget)}>
      <b>
        {/* текст ставим сами: перебор меняет содержимое, React его не трогает */}
        <span className="t" ref={(el) => void (el && !el.textContent && (el.textContent = x.title))} />
        <i className="ul" />
      </b>
      {rubric && <span className="rubric">{x.rubric}</span>}
    </li>
  )

  const a = open !== null ? articles[open] : null
  const gallery = a ? a.gallery : []
  const switchProps = { i: gi, n: gallery.length, onGo: (d: 1 | -1) => void shift(d), paused, onPause: () => setPaused((p) => !p) }

  return (
    <DemoStage set="motion" id="02-03">
      {ready && (
        <>
          <i className="lp-ready" hidden />
          {/* экран проекта: картинка (ppics — при переходе из меню растёт из точки клика, main.tsx) и панель текста */}
          <div className="pgroup">
          <div className="ppics">
            {/* zIndex 1 — свой слой наложения: номера слоёв растут с каждой сменой и не перекрывают переключатель */}
            <div className="layer" style={{ width: IMG_W, overflow: 'hidden', zIndex: 1 }}>
              {layer(0)}
              {layer(1)}
            </div>
            {/* галерея как на главной (круг 8): холст шейдера виден только на время хода (видимость — вручную, shift);
                превью следующего кадра — в слоях картинки (layer) */}
            {gTex && !isRecord && (
              <div ref={gCanvas} className="gcanvas" style={{ visibility: 'hidden' }}>
                <GalleryCanvas T={gTex.T} size={gSize} run={gRun} />
              </div>
            )}
            {/* тень снизу под нижнюю строку: переключатель в углу и подписи левее разметки (круг 6) */}
            <div className="shade-bottom" style={{ width: IMG_W }} />
            {/* клик по картинке — следующий кадр из точки клика; с замочком — только по превью в углу */}
            {a && gallery.length > 1 && !isRecord && !locked && (
              <div className="ghit" style={{ width: IMG_W }} title="следующий кадр" onClick={(ev) => void shift(1, toStage(ev))} />
            )}
          </div>
          <div className="layer blog" style={{ left: IMG_W, width: PANEL, overflow: 'hidden' }}>
            <div className="blog-head">{RAZBORY_HEAD}</div>
            <ul className="blog-list" style={listStyle(listTop)}>
              {articles.slice(0, ABOUT).map((x, k) => listRow(x, k))}
            </ul>
            <div className="blog-head blog-sub" style={{ top: aboutHead }}>{ABOUT_HEAD}</div>
            <ul className="blog-list" style={listStyle(aboutTop)}>
              {articles.slice(ABOUT).map((x, k) => listRow(x, ABOUT + k, false))}
            </ul>
            <div ref={panel} className="blog-panel" style={{ transform: `translateX(${PANEL}px)` }}>
              {a && open !== null && (
                <>
                  <div ref={inner} className="blog-panel-in">
                    <h2>{a.title}</h2>
                    <ArticleLinks links={a.links} />
                    <p className="lead">{a.lead}</p>
                    {a.body.map((b, i) => (
                      <BlockView key={`${open}-${i}`} b={b} />
                    ))}
                  </div>
                  <PanelTop className="blog-panel-top" open={open} onStep={(d) => void step(d)} onBack={() => void go(null)} />
                </>
              )}
            </div>
          </div>
          {/* широкое окно: имя, меню и подписи — один слой поверх экранов (main.tsx), при переходах стоят на месте */}
          {isRecord && <Chrome active="projects" />}
          </div>
          {zoom && a && (
            <div ref={zoomEl} className="zoom">
              <img key={gallery[gi]} className={`zoom-full ${gallery[gi] !== zoomFirst.current ? 'swap' : ''}`} src={img(`${gallery[gi]}-n.jpg`)} alt="" />
            </div>
          )}
          {/* подпись проекта поверх кадра «на весь экран» — на том же месте, что подпись на картинке (круг 8) */}
          {(zoom || gMoving) && a && (
            <div ref={gLabel} className="slide-label glabel" style={{ left: LABEL_X, top: labelY }}>
              <span ref={gText} className="gtext">{a.title}</span>
              {/* «на весь экран»: глазик сворачивает подпись справа налево в себя и разворачивает обратно (круг 9) */}
              {zoom && (
                <button ref={gEye} className="geye" aria-label={eyeOn ? 'скрыть подпись' : 'показать подпись'}
                  title={eyeOn ? 'скрыть подпись' : 'показать подпись'} onClick={toggleEye}>{eyeOn ? Icon.eye : Icon.eyeOff}</button>
              )}
            </div>
          )}
          {xHover && !zoom && a && (
            <div ref={xBox} className="xprev" style={{ width: xs * 1920, height: xs * h }}>
              <img src={img(`${gallery[gi]}-n.jpg`)} alt="" />
            </div>
          )}
          {!isRecord && gallery.length > 1 && (
            <Switch {...switchProps} className="at-corner" expanded={zoomOn} onExpand={(ev) => (zoomOn ? closeZoom(ev) : openZoom(ev))}
              onExpandHover={onExpandHover} locked={locked} onLock={toggleLock} />
          )}
        </>
      )}
    </DemoStage>
  )
}
