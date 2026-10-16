// Наведение на всё кликабельное (правка Павла 15.10) — тот же приём, что на строке списка проектов:
// буквы перебираются в своих клетках и собираются волной (kit/scramble.ts), линия под текстом
// растёт слева, при уходе курсора убегает вправо.
// overwrite: при быстром проходе курсора уход отменяет недорисованный рост — линия не остаётся.
import type { MouseEvent } from 'react'
import gsap from 'gsap'
import { scramble } from '../kit/scramble'

export function hoverIn(el: HTMLElement, text?: string) {
  const t = el.querySelector<HTMLElement>('.t')
  if (t) scramble(t, text ?? t.dataset.text ?? '')
  gsap.fromTo(el.querySelector('.ul'), { scaleX: 0, transformOrigin: '0% 50%' }, { scaleX: 1, duration: 0.3, ease: 'power2.out', overwrite: true })
}

export function hoverOut(el: HTMLElement) {
  gsap.to(el.querySelector('.ul'), { scaleX: 0, transformOrigin: '100% 50%', duration: 0.25, ease: 'power2.in', overwrite: true })
}

/** Снять все линии: элемент, по которому кликнули, ухода курсора может не дождаться (его закрыла статья). */
export function clearUnderlines() {
  gsap.set('.ul', { scaleX: 0, overwrite: true })
}

/** Текст кликабельного элемента: клетки для перебора и линия под ним. Текст ставим сами — перебор меняет содержимое.
 *  key={text}: тот же элемент в другой статье (ссылки под заголовком) — новый текст; без ключа React переиспользовал
 *  узел, и в нём оставалась подпись прошлой статьи, а при наведении перебор собирал уже новую (баг Павла 16.10). */
export function Fx({ text }: { text: string }) {
  return (
    <span className="fx">
      <span key={text} className="t" data-text={text} ref={(el) => void (el && !el.textContent && (el.textContent = text))} />
      <i className="ul" />
    </span>
  )
}

/** Обработчики наведения для элемента с <Fx> внутри: <a {...fx}><Fx text="…" /></a>. */
export const fx = {
  onMouseEnter: (ev: MouseEvent<HTMLElement>) => hoverIn(ev.currentTarget),
  onMouseLeave: (ev: MouseEvent<HTMLElement>) => hoverOut(ev.currentTarget),
}
