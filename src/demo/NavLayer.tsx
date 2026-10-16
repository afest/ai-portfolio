// Шапка широкого окна одним слоем поверх экранов (круг 7): имя, меню и нижние подписи при переходах стоят на месте,
// меняется только картинка; в режиме «на весь экран» кадр накрывает слой — в нём вырезается окно (Razbory.tsx, coverChrome).
// Превью раздела под курсором: навёл на «Главная» / «Проекты» — под курсором картинка раздела, как превью слайдера:
// экран, сжатый к курсору в s0 раз (курсор внутри превью там же, где на экране), догоняет курсор плавно; картинка
// раздела целиком (круг 8: у проектов без белой полосы). Клик — точка клика уходит в переход
// (Marks.tsx, setOrigin), страница раздела разворачивается из превью (main.tsx); до начала хода превью держится (lp:go).
// Меню (круг 8) — на верхней линии левее верхнего крестика; выбранный пункт бледнее и не откликается на наведение.
import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { Chrome, useStage } from './DemoStage'
import { blogCover, img, slides, type Screen } from './content'
import { capScale, setOrigin } from './Marks'
import { previewAt } from './previewAt'

const SRC: Record<Screen, string> = { home: img(slides[0].img), projects: img(`${blogCover}.jpg`) }
// превью (круг 9–10): высота — высота букв «ЮНУСОВ» (Marks.tsx, CAP), прямоугольник той же пропорции, что у слайдера (экран);
// у проектов картинка в нём — по центру, при переходе рамка расширяется до картинки (main.tsx, projectsIn)

export function NavLayer({ active }: { active: Screen }) {
  const { w, h, scale } = useStage()
  const s0 = capScale(h)   // масштаб превью: высота CAP
  const [to, setTo] = useState<Screen | null>(null)
  const box = useRef<HTMLDivElement>(null)
  const pos = useRef<[number, number] | null>(null)   // точка роста превью, px сцены
  const goal = useRef<[number, number]>([0, 0])
  const stick = useRef(false)                          // после клика — держится до начала хода
  const activeRef = useRef(active)
  activeRef.current = active

  const place = () => {
    const el = box.current
    const p = pos.current
    if (!el || !p) return
    el.style.left = `${p[0] * (1 - s0)}px`
    el.style.top = `${p[1] * (1 - s0)}px`
  }

  useEffect(() => {
    const link = (ev: Event) => (ev.target as Element | null)?.closest?.('.clayer nav a[data-nav]') as HTMLElement | null
    const move = (ev: PointerEvent) => {
      if (stick.current) return
      const a = link(ev)
      const id = a?.dataset.nav as Screen | undefined
      if (!id || id === activeRef.current) return setTo(null)
      goal.current = [ev.clientX / scale, ev.clientY / scale]
      // превью появляется там, где сейчас превью слайдера или галереи, и дальше идёт за курсором — картинка меняется, а не удваивается
      if (!pos.current && previewAt.F) pos.current = [...previewAt.F]
      setTo(id)
    }
    const click = (ev: MouseEvent) => {
      const a = link(ev)
      const id = a?.dataset.nav as Screen | undefined
      if (!id || id === activeRef.current) return
      const p: [number, number] = [ev.clientX / scale, ev.clientY / scale]
      goal.current = p
      pos.current = p
      place()
      stick.current = true
      setTo(id)
      setOrigin({ F: [ev.clientX, ev.clientY], s0 })
      clearTimeout(t)
      t = window.setTimeout(go, 2500)   // ход так и не начался — не держим превью
    }
    const go = () => {
      clearTimeout(t)
      stick.current = false
      setTo(null)
    }
    let t = 0
    window.addEventListener('pointermove', move)
    window.addEventListener('click', click, true)
    window.addEventListener('lp:go', go)
    return () => {
      clearTimeout(t)
      window.removeEventListener('pointermove', move)
      window.removeEventListener('click', click, true)
      window.removeEventListener('lp:go', go)
    }
  }, [scale])

  // превью догоняет курсор, пока показано
  useEffect(() => {
    if (!to) {
      pos.current = null
      return
    }
    let raf = 0
    let last = performance.now()
    const tick = (now: number) => {
      const dt = Math.min((now - last) / 1000, 1 / 30)
      last = now
      const g = goal.current
      const p = pos.current ?? g
      const k = stick.current ? 1 : 1 - Math.exp(-dt * 14)
      pos.current = [p[0] + (g[0] - p[0]) * k, p[1] + (g[1] - p[1]) * k]
      place()
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    place()
    return () => cancelAnimationFrame(raf)
  }, [to])

  const style = { width: w, height: h, transform: `scale(${scale})`, '--inv': 1 / scale } as CSSProperties
  return (
    <div className="page clayer">
      <div className="stage overlay" style={style}>
        {to && (
          <div ref={box} className="navprev" style={{ width: s0 * w, height: s0 * h }}>
            <img src={SRC[to]} alt="" />
          </div>
        )}
        <Chrome active={active} />
      </div>
    </div>
  )
}
