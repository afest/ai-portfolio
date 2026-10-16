// Кубик «наведение на карточку: рост из угла». При наведении новая картинка растёт из
// правого нижнего угла карточки вместе с содержимым (ease-out); при уходе курсора сжимается в левый
// верхний угол (ease-in), под ней снова исходная. Уход посреди роста — сжатие от текущего положения,
// без скачка. В каталоге T-485 это было ошибочно записано шторкой.
//
// Как забрать: скопировать файл; нужен gsap.
//   <div class="card" style="position:relative; overflow:hidden; width:900px; height:506px">
//     <img src="обычная.jpg">
//     <div class="hover" style="position:absolute; inset:0"><img src="при-наведении.jpg"></div>
//   const h = cornerHover(card.querySelector('.hover'), { w: 900, h: 506 })
//   card.addEventListener('mouseenter', h.enter); card.addEventListener('mouseleave', h.leave)
// Карточка, которая сама едет под курсором (параллакс, прокрутка), mouseenter надёжно не получит —
// тогда звать enter/leave по своему расчёту попадания на каждом кадре (см. cursorParallax.ts).
// Цифры по умолчанию: рост — power3.out за 0,62 с, сжатие — power3.in за 0,44 с.
import gsap from 'gsap'

export const CORNER_HOVER = {
  in: { duration: 0.62, ease: 'power3.out' },
  out: { duration: 0.44, ease: 'power3.in' },
}

type Opts = { w: number; h: number; in?: gsap.TweenVars; out?: gsap.TweenVars }

/** el — слой картинки наведения внутри карточки w×h (overflow: hidden). */
export function cornerHover(el: HTMLElement, { w, h, in: tin = CORNER_HOVER.in, out: tout = CORNER_HOVER.out }: Opts) {
  // слой спрятан в правом нижнем углу; масштаб — от его левого верхнего угла
  gsap.set(el, { x: w, y: h, scale: 0, transformOrigin: '0 0' })
  return {
    enter() {
      gsap.killTweensOf(el)
      if (Number(gsap.getProperty(el, 'scale')) < 0.001) gsap.set(el, { x: w, y: h, scale: 0 })
      gsap.to(el, { x: 0, y: 0, scale: 1, ...tin })
    },
    leave() {
      gsap.killTweensOf(el)
      // сжимается к своему левому верхнему углу — x, y не трогаем
      gsap.to(el, { scale: 0, ...tout, onComplete: () => void gsap.set(el, { x: w, y: h }) })
    },
  }
}
