// Переключатель кадров — общий у главной (слайды), галереи проекта и верха проекта:
// «← 01 / 06 →» — две большие кнопки через слэш (наведение — на всю кнопку: перебор цифр и линия),
// стоп, для галереи — «на весь экран»; под ним полоса, которая заполняется до смены кадра.
// Значки — svg одной толщины штриха, всё на одной линии по центру (правка Павла 15.10).
import type { CSSProperties, MouseEvent } from 'react'
import { fx } from './fx'

// кадр стоит столько, потом сменяется — на главной и в галерее одинаково (правка Павла 15.10; круг 5 — в полтора раза дольше)
export const AUTOPLAY_MS = 7500

const two = (n: number) => String(n).padStart(2, '0')

const Icon = { // 14×14, штрих — цвет текста, толщина одна (styles.css: .ic)
  left: <svg className="ic" viewBox="0 0 14 14" aria-hidden><path d="M12.5 7h-11M5.5 3l-4 4 4 4" /></svg>,
  right: <svg className="ic" viewBox="0 0 14 14" aria-hidden><path d="M1.5 7h11M8.5 3l4 4-4 4" /></svg>,
  pause: <svg className="ic" viewBox="0 0 14 14" aria-hidden><path d="M4.5 2.5v9M9.5 2.5v9" /></svg>,
  play: <svg className="ic" viewBox="0 0 14 14" aria-hidden><path d="M4 2.5 11 7l-7 4.5z" /></svg>,
  expand: <svg className="ic" viewBox="0 0 14 14" aria-hidden><path d="M8.5 1.5h4v4M5.5 12.5h-4v-4M12.5 1.5 8 6M1.5 12.5 6 8" /></svg>,
  collapse: <svg className="ic" viewBox="0 0 14 14" aria-hidden><path d="M12.5 5.5h-4v-4M1.5 8.5h4v4M8.5 5.5l4-4M5.5 8.5l-4 4" /></svg>,
  list: <svg className="ic" viewBox="0 0 14 14" aria-hidden><path d="M1.5 3.5h11M1.5 7h11M1.5 10.5h11" /></svg>,
  // замочек (круг 9): закрыт — превью прилипло к левому нижнему углу; открыт — превью за курсором
  lock: <svg className="ic" viewBox="0 0 14 14" aria-hidden><path d="M3 6.5h8v6H3zM4.75 6.5V4.75a2.25 2.25 0 0 1 4.5 0V6.5" /></svg>,
  unlock: <svg className="ic" viewBox="0 0 14 14" aria-hidden><path d="M3 6.5h8v6H3zM4.75 6.5V4.75a2.25 2.25 0 0 1 4.5 0" /></svg>,
  // глазик подписи в «на весь экран» (круг 9): открыт — подпись видна, перечёркнут — свёрнута в значок
  eye: <svg className="ic" viewBox="0 0 14 14" aria-hidden><path d="M1 7s2.2-4 6-4 6 4 6 4-2.2 4-6 4-6-4-6-4zM7 5.25a1.75 1.75 0 1 1 0 3.5 1.75 1.75 0 0 1 0-3.5z" /></svg>,
  eyeOff: <svg className="ic" viewBox="0 0 14 14" aria-hidden><path d="M1 7s2.2-4 6-4 6 4 6 4-2.2 4-6 4-6-4-6-4zM7 5.25a1.75 1.75 0 1 1 0 3.5 1.75 1.75 0 0 1 0-3.5zM2 12 12 2" /></svg>,
}
export { Icon }

/** Цифры для перебора: при смене значения элемент пересоздаётся (key) — перебор меняет содержимое, React его не трогает. */
function Num({ v }: { v: string }) {
  return <span key={v} className="t" data-text={v} ref={(el) => void (el && !el.textContent && (el.textContent = v))} />
}

/** «← 01 / 06 →»: назад — стрелка и текущий номер, вперёд — всего и стрелка. Ширина постоянная — ничего не прыгает. */
export function Pager({ i, n, onGo, titles }: { i: number; n: number; onGo: (dir: 1 | -1) => void; titles?: [string, string] }) {
  return (
    <span className="pager">
      <button className="pg" aria-label={titles ? `предыдущий: ${titles[0]}` : 'назад'} title={titles?.[0]} onClick={() => onGo(-1)} {...fx}>
        <span className="fx">{Icon.left}<Num key={`a${i}`} v={two(i + 1)} /><i className="ul" /></span>
      </button>
      <span className="slash">/</span>
      <button className="pg" aria-label={titles ? `следующий: ${titles[1]}` : 'вперёд'} title={titles?.[1]} onClick={() => onGo(1)} {...fx}>
        <span className="fx"><Num v={two(n)} />{Icon.right}<i className="ul" /></span>
      </button>
    </span>
  )
}

type Props = {
  i: number; n: number; onGo: (dir: 1 | -1) => void
  paused?: boolean; onPause?: () => void
  expanded?: boolean; onExpand?: (ev: MouseEvent) => void   // событие — откуда растёт просмотр (точка нажатия)
  onExpandHover?: (on: boolean, ev: MouseEvent) => void      // наведение на «на весь экран» — превью под курсором (круг 8)
  locked?: boolean; onLock?: () => void                       // замочек превью (круг 9, demo/lock.ts)
  style?: CSSProperties; className?: string
}

export function Switch({ i, n, onGo, paused, onPause, expanded, onExpand, onExpandHover, locked, onLock, style, className }: Props) {
  return (
    <div className={`gswitch ${className ?? ''}`} style={style}>
      <Pager i={i} n={n} onGo={onGo} />
      {onPause && (
        <button className="ico" aria-label={paused ? 'дальше' : 'стоп'} title={paused ? 'дальше' : 'стоп'} onClick={onPause} {...fx}>
          <span className="fx">{paused ? Icon.play : Icon.pause}<i className="ul" /></span>
        </button>
      )}
      {onLock && (
        <button className="ico" aria-label={locked ? 'превью за курсором' : 'превью в угол'} title={locked ? 'превью за курсором' : 'превью в угол'}
          onClick={onLock} {...fx}>
          <span className="fx">{locked ? Icon.lock : Icon.unlock}<i className="ul" /></span>
        </button>
      )}
      {onExpand && (
        <button className="ico" aria-label={expanded ? 'свернуть' : 'на весь экран'} title={expanded ? 'свернуть' : 'на весь экран'} onClick={onExpand}
          onMouseEnter={(ev) => { fx.onMouseEnter(ev); onExpandHover?.(true, ev) }}
          onMouseLeave={(ev) => { fx.onMouseLeave(ev); onExpandHover?.(false, ev) }}>
          <span className="fx">{expanded ? Icon.collapse : Icon.expand}<i className="ul" /></span>
        </button>
      )}
      {!paused && <i key={i} className="gswitch-bar" style={{ animationDuration: `${AUTOPLAY_MS}ms` }} />}
    </div>
  )
}
