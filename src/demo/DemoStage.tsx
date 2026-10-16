import { createContext, useContext, useEffect, useState, type CSSProperties, type ReactNode } from 'react'
import { H, W, isRecord } from '../lab/harness'
import { MENU, FOOT, LOGO, type Screen } from './content'
import { Fx, fx } from './fx'

// Каркас из лаборатории Linza (lab/src/demo/DemoStage.tsx). В лаборатории сцена 1920×1080 вписана
// в окно с полями и панелью управления; на лендинге сцена — во всё окно: ширина всегда 1920 px сцены,
// высота — по пропорции окна (в записи ?record — ровно 1080). Всё, что привязано к низу
// (превью слайдера, подвал), считается от этой высоты.
// Узкое окно (меньше NARROW px, телефон и планшет стоя): сцена 1920 там уменьшалась бы в 2–5 раз,
// поэтому своя раскладка. Слайдер — та же сцена размером с окно, в пикселях сцены вдвое крупнее
// (чёткость на экранах с плотностью 2×); проекты и разборы — обычной страницей с прокруткой.

export const NARROW = 1024
const K = 2   // узкое окно: пикселей сцены на пиксель окна

type StageSize = { w: number; h: number; scale: number; narrow: boolean }

function read(): StageSize {
  if (isRecord) return { w: W, h: H, scale: 1, narrow: false }
  if (innerWidth < NARROW) return { w: innerWidth * K, h: innerHeight * K, scale: 1 / K, narrow: true }
  return { w: W, h: Math.round((W * innerHeight) / innerWidth), scale: innerWidth / W, narrow: false }
}

const Ctx = createContext<StageSize>({ w: W, h: H, scale: 1, narrow: false })
export const useStage = () => useContext(Ctx)

/** Размер сцены по окну; меняется после ресайза (с задержкой — экраны пересобираются по высоте). */
export function useViewport(): StageSize {
  const [s, setS] = useState(read)
  useEffect(() => {
    if (isRecord) return
    let t = 0
    const on = () => {
      clearTimeout(t)
      t = window.setTimeout(() => {
        const n = read()
        setS((o) => (o.w === n.w && o.h === n.h ? o : n))
      }, 150)
    }
    window.addEventListener('resize', on)
    return () => {
      clearTimeout(t)
      window.removeEventListener('resize', on)
    }
  }, [])
  return s
}

export function StageProvider({ value, children }: { value: StageSize; children: ReactNode }) {
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

/** Сцена экрана во всё окно. --inv — сколько пикселей сцены в пикселе окна: по нему текст статьи держит кегль на экране. */
export function DemoStage({ children }: { set?: string; id?: string; children: ReactNode }) {
  const { w, h, scale } = useStage()
  const style = { width: w, height: h, transform: isRecord ? undefined : `scale(${scale})`, '--inv': 1 / scale } as CSSProperties
  const stage = (
    <div className="stage" style={style}>
      {children}
    </div>
  )
  if (isRecord) return stage
  return <div className="page">{stage}</div>
}

/** Шапка поверх сцены: имя, меню, подвал. */
export function Chrome({ active }: { active: Screen }) {
  return (
    <div className="chrome">
      <Logo />
      <Menu active={active} />
      <Foot />
    </div>
  )
}

/** Имя лесенкой: фамилия, под ней имя, сдвинутое так, что правые края слов совпадают (замер Inter 900, styles.css). */
export function Logo() {
  return (
    <a className="logo" href="#/">
      <span>{LOGO[0]}</span>
      <span className="l2">{LOGO[1]}</span>
    </a>
  )
}

export function Menu({ active }: { active: Screen }) {
  return (
    <nav>
      {MENU.map((x) => (
        <a key={x.id} href={isRecord ? undefined : x.href} className={x.id === active ? 'on' : ''} data-nav={x.id} {...fx}>
          <Fx text={x.name} />
        </a>
      ))}
    </nav>
  )
}

export function Foot() {
  return (
    <div className="foot">
      {FOOT.map((x) =>
        x.href ? (
          <a key={x.text} href={x.href} target="_blank" rel="noreferrer" {...fx}>
            <Fx text={x.text} />
          </a>
        ) : (
          <span key={x.text}>{x.text}</span>
        ),
      )}
    </div>
  )
}

/** Узкое окно, проекты и разборы: обычная страница с прокруткой — шапка, содержимое, подвал в одной колонке. */
export function NarrowPage({ active, children }: { active: Screen; children: ReactNode }) {
  return (
    <div className="npage">
      <div className="ncol">
        <header className="nhead">
          <Logo />
          <Menu active={active} />
        </header>
        {children}
        <footer className="nfoot">
          <Foot />
        </footer>
      </div>
    </div>
  )
}
