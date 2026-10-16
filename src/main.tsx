import { StrictMode, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import gsap from 'gsap'
import './styles.css'
import { effect, isRecord } from './lab/harness'
import { easeOf } from './lab/ease'
import { NARROW, StageProvider, useViewport } from './demo/DemoStage'
import { IMG_W, LINE, Marks, grow, origin, takeOrigin, type Origin } from './demo/Marks'
import { NavLayer } from './demo/NavLayer'
import Slider from './screens/Slider'
import Razbory from './screens/Razbory'
import { RazboryNarrow } from './screens/narrow'
import '@fontsource/inter/900.css'
import '@fontsource/jetbrains-mono/400.css'
import '@fontsource/jetbrains-mono/700.css'

// Адреса: #/ — главная (слайдер), #/projects — проекты (список), #/projects/<n> — проект.
// Коллаж проектов скрыт (правка Павла 15.10): screens/Projects.tsx и ProjectsNarrow не подключены.
// Старые адреса #/razbory… ведут туда же. Экран пересобирается при смене размера окна: картинки
// и подписи слайдера рисуются под него. Узкие проекты — обычная страница: от высоты не зависят
// (на телефоне она меняется с адресной строкой, и пересборка сбрасывала бы прокрутку).
// Переход между главной и проектами (правка Павла 15.10, круг 6) — из нижнего крестика разметки 60 / 40
// (demo/Marks.tsx) масштабом, как слайд на главной, той же кривой T1 (01-04): на проекты — экран проектов
// растёт из крестика поверх главной (картинка и панель разом); на главную — тот же ход назад: проекты прячутся
// в крестик, главная под ними. Новый экран ждёт своей готовности (метка .lp-ready, круг 10). Метки — один слой поверх
// обоих экранов, при ходах стоят. Узкое окно — прежний рост из правого нижнего угла рамкой.
// Круг 7: из меню — из превью раздела под курсором (demo/NavLayer.tsx): главная растёт целиком из точки клика с масштаба
// превью, у проектов из неё растёт картинка, а белая панель разворачивается из правого верхнего угла (projectsIn). Крестик —
// для остальных путей (имя, ссылка со слайда, «назад» в браузере). Шапка — тоже один слой поверх экранов: при ходах стоит.
function useHash() {
  const [h, setH] = useState(location.hash)
  useEffect(() => {
    const on = () => setH(location.hash)
    window.addEventListener('hashchange', on)
    return () => window.removeEventListener('hashchange', on)
  }, [])
  return h
}

if (location.hash.startsWith('#/razbory')) history.replaceState(null, '', location.hash.replace('#/razbory', '#/projects'))

// проверка без окна (scripts/shots.mjs): программный WebGL рисует кадр дольше 0,5 с, GSAP «сглаживает» такую задержку,
// и ходы растягиваются в разы. ?nolag отключает сглаживание — ходы идут по часам, как на живой видеокарте
if (new URLSearchParams(location.search).has('nolag')) gsap.ticker.lagSmoothing(0)

type Screen = 'home' | 'projects'
type Page = { key: string; screen: Screen; narrow: boolean }

const T1 = effect('motion', '01-04')

/** На проекты из меню (круг 7–8): картинка растёт из превью под курсором (масштаб s0 → 1 к точке клика; меню — у верхнего
 *  крестика), белая панель разворачивается из точки стыка с картинкой на верхней линии — на уровне «ПРОЕКТЫ»: обе начинаются
 *  почти из одного места и сходятся. Подложка сцены на время хода прозрачная — под ними видна главная. */
function projectsIn(node: HTMLElement, o: Origin, onDone: () => void) {
  const k = innerWidth / 1920
  const stage = node.querySelector<HTMLElement>('.stage')!
  const panel = node.querySelector<HTMLElement>('.pgroup > .layer.blog')!
  const pics = node.querySelector<HTMLElement>('.ppics')!
  const pw = panel.offsetWidth
  const ph = panel.offsetHeight
  gsap.set(node, { clearProps: 'transform' })
  stage.style.background = 'transparent'
  const { ease, duration } = easeOf(T1)
  // Круг 10: превью — того же прямоугольника, что у слайдера (экран, сжатый к точке клика), картинка в нём — по центру.
  // Картинка проектов (IMG_W × h, почти квадрат) стартует шириной превью, по высоте выходит за него и обрезана рамкой
  // превью; дальше масштаб к 1, рамка — к целой картинке. Точка масштаба G — та, при которой края по ширине и середина
  // по высоте совпадают с превью в начале (и с картинкой в конце) — по ходу всё линейно, картинка «расширяется» из превью.
  const h = ph   // высота сцены, px сцены
  const F: [number, number] = [o.F[0] / k, o.F[1] / k]
  const pv = [F[0] * (1 - o.s0), F[1] * (1 - o.s0), F[0] + o.s0 * (1920 - F[0]), F[1] + o.s0 * (h - F[1])]   // превью, px сцены
  const s1 = (pv[2] - pv[0]) / IMG_W
  const G: [number, number] = [pv[0] / (1 - s1), ((pv[1] + pv[3]) / 2 - (s1 * h) / 2) / (1 - s1)]
  const st = { e: 0 }
  const step = () => {
    const s = s1 + (1 - s1) * st.e
    const top = pv[1] * (1 - st.e)
    const bot = pv[3] + (h - pv[3]) * st.e
    pics.style.transformOrigin = `${G[0]}px ${G[1]}px`
    pics.style.transform = `scale(${s})`
    pics.style.clipPath = `inset(${G[1] + (top - G[1]) / s}px 0px ${h - (G[1] + (bot - G[1]) / s)}px 0px)`
  }
  step()
  gsap.to(st, { e: 1, ease, duration, onUpdate: step,
    onComplete: () => void gsap.set(pics, { clearProps: 'transform,transformOrigin,clipPath' }) })
  gsap.fromTo(panel, { clipPath: `inset(${LINE}px ${pw}px ${ph - LINE}px 0px)` }, { clipPath: 'inset(0px 0px 0px 0px)', ease, duration,
    onComplete: () => {
      gsap.set(panel, { clearProps: 'clipPath' })
      stage.style.background = ''
      onDone()
    } })
}

/** Экран в своей обёртке; enter — въезжает поверх прежнего (old — обёртка прежнего, уходит после хода). */
function Wrap({ enter, old, onDone, children }: { enter: boolean; old: boolean; onDone: () => void; children: ReactNode }) {
  const el = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    const node = el.current
    if (!enter || !node) return
    const wide = innerWidth >= NARROW
    // до старта новый экран не виден: широкое окно — точка (масштаб 0), узкое — пустая рамка
    if (wide) gsap.set(node, { scale: 0 })
    else gsap.set(node, { clipPath: 'inset(100% 0% 0% 100%)' })
    let started = false
    const start = () => {
      if (started) return
      started = true
      const F = origin(innerWidth, innerHeight, innerWidth / 1920)   // нижний крестик, px окна
      const prev = document.querySelector<HTMLElement>('.pwrap.old')
      const o = takeOrigin()   // клик по пункту меню: страница — из превью под курсором (demo/NavLayer.tsx)
      window.dispatchEvent(new Event('lp:go'))
      if (wide && o && node.querySelector('.layer.blog')) projectsIn(node, o, onDone)
      else if (wide && o) grow(node, o.F, 'in', onDone, o.s0)
      else if (wide && node.querySelector('.layer.blog')) grow(node, F, 'in', onDone)
      else if (wide && prev?.querySelector('.layer.blog')) {
        gsap.set(node, { clearProps: 'transform' })
        prev.style.zIndex = '2'
        grow(prev, F, 'out', onDone)
      } else {
        gsap.set(node, { clearProps: 'transform' })
        const { ease, duration } = easeOf(T1)
        gsap.to(node, { clipPath: 'inset(0% 0% 0% 0%)', ease, duration,
          onComplete: () => { gsap.set(node, { clearProps: 'clipPath' }); onDone() } })
      }
    }
    // ход начинается, когда новый экран готов: на нём появилась метка .lp-ready (главная — после первого кадра шейдера,
    // то есть текстуры уже в видеокарте; проекты — после обложки). Метка, а не разовое событие (круг 10: событие могло
    // прийти раньше, чем переход начинал его слушать, — тогда ход ждал запасные 0,9 с и картинка «застывала»)
    let raf = 0
    const check = () => {
      if (started) return
      if (node.querySelector('.lp-ready')) start()
      else raf = requestAnimationFrame(check)
    }
    check()
    const t = setTimeout(start, 1500)   // картинки задержались — не держим человека дольше
    return () => {
      clearTimeout(t)
      cancelAnimationFrame(raf)
    }
  }, [])
  return <div ref={el} className={`pwrap ${old ? 'old' : ''}`}>{children}</div>
}

function render(p: Page) {
  if (p.screen === 'home') return <Slider />
  return p.narrow ? <RazboryNarrow /> : <Razbory />
}

function App() {
  const hash = useHash()
  const vp = useViewport()
  const screen: Screen = hash.startsWith('#/projects') ? 'projects' : 'home'
  const n = vp.narrow && screen !== 'home'
  const size = n ? 'narrow' : `${vp.w}x${vp.h}`
  const cur: Page = { key: `${screen}-${size}-${screen === 'projects' ? hash : ''}`, screen, narrow: vp.narrow }
  const [old, setOld] = useState<Page | null>(null)
  const [enterKey, setEnterKey] = useState<string | null>(null)
  const last = useRef(cur)

  // смена экрана — с переходом; смена размера окна или проекта по адресу — сразу. Решается в самом рендере:
  // новый экран должен смонтироваться уже «въезжающим», иначе его обёртка не начнёт ход
  const prev = last.current
  const switching = prev.key !== cur.key && prev.screen !== cur.screen && !isRecord
  const oldPage = switching ? prev : old
  const enter = switching ? cur.key : enterKey
  const entering = useRef<string | null>(null)   // чей ход сейчас идёт: конец прежнего хода не трогает новый переход
  if (switching) entering.current = cur.key
  useLayoutEffect(() => {
    if (last.current.key === cur.key) return
    setOld(switching ? prev : null)
    setEnterKey(switching ? cur.key : null)
    last.current = cur
  }, [cur.key])

  const pages = oldPage && oldPage.key !== cur.key ? [oldPage, cur] : [cur]
  return (
    <StageProvider value={vp}>
      {pages.map((p) => (
        <Wrap key={p.key} enter={p.key === enter} old={p === oldPage}
          onDone={() => {
            if (entering.current !== p.key) return
            entering.current = null
            setOld(null)
            setEnterKey(null)
          }}>
          {render(p)}
        </Wrap>
      ))}
      {!vp.narrow && !isRecord && <NavLayer active={screen} />}
      {!vp.narrow && <Marks />}
    </StageProvider>
  )
}

if (isRecord) document.documentElement.classList.add('record')
// StrictMode в записи не нужен: двойной вызов эффектов собрал бы таймлайн дважды
createRoot(document.getElementById('root')!).render(isRecord ? <App /> : <StrictMode><App /></StrictMode>)
