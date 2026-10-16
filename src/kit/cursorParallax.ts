// Кубик «параллакс за курсором с глубиной» — коллаж проектов: слой уходит в противоход
// курсору, ≈ 60% сдвига приходит сразу, ≈ 40% догоняет за ~0,5 с; у карточек своя глубина —
// разный путь и за курсором, и при прокрутке, отсюда ощущение 3D.
// Две части сдвига — два lerp'а к курсору: быстрый (kFast) и медленный (kSlow), каждый со своим
// коэффициентом. Поправка на длину кадра — lerp остаётся тем же на 30, 60 и 144 Гц.
//
// Как забрать: скопировать файл; зависимостей нет (тикер — любой: gsap.ticker, requestAnimationFrame).
//   const px = cursorParallax({ center: [innerWidth / 2, innerHeight / 2] })
//   el.addEventListener('mousemove', (e) => px.pointer(e.clientX, e.clientY))
//   gsap.ticker.add((_t, dt) => {
//     px.tick(dt)
//     const [ox, oy] = px.offset()
//     cards.forEach((c, k) => c.style.transform = `translate3d(${x[k] + ox * depth(k)}px, ${y[k] + oy * depth(k)}px, 0)`)
//   })
// Элемент, который едет под неподвижным курсором, событий наведения надёжно не получит: попадание
// курсора в карточку считать самим на каждом кадре (T-486).
// Цифры по умолчанию: x — 0,43 px на 1 px курсора (0,26 сразу + 0,17 догоняет), y — 0,27 (0,163 + 0,107);
// lerp 0,3 и 0,032 за кадр 60 fps. Глубина карточек — ±4% (depth).
export const PARALLAX = {
  gain: { fastX: 0.26, slowX: 0.17, fastY: 0.163, slowY: 0.107 },
  kFast: 0.3,
  kSlow: 0.032,
}

type Opts = Partial<typeof PARALLAX> & { center?: [number, number] }

export function cursorParallax({ gain = PARALLAX.gain, kFast = PARALLAX.kFast, kSlow = PARALLAX.kSlow, center = [960, 540] }: Opts = {}) {
  const [cx, cy] = center
  // x, y — курсор; f* — быстрая часть, s* — медленная
  const m = { x: cx, y: cy, fx: cx, fy: cy, sx: cx, sy: cy }
  return {
    state: m,
    /** Курсор в координатах сцены. */
    pointer(x: number, y: number) {
      m.x = x
      m.y = y
    },
    /** Шаг догоняния; dt — мс с прошлого кадра. */
    tick(dt: number) {
      const f = Math.min(4, dt / (1000 / 60))           // поправка lerp на длину кадра
      const kf = 1 - Math.pow(1 - kFast, f)
      const ks = 1 - Math.pow(1 - kSlow, f)
      m.fx += (m.x - m.fx) * kf
      m.fy += (m.y - m.fy) * kf
      m.sx += (m.x - m.sx) * ks
      m.sy += (m.y - m.sy) * ks
    },
    /** Сдвиг слоя сейчас, px; карточке — умножить на её глубину. */
    offset(): [number, number] {
      const ox = -((m.fx - cx) * gain.fastX + (m.sx - cx) * gain.slowX)
      const oy = -((m.fy - cy) * gain.fastY + (m.sy - cy) * gain.slowY)
      return [ox, oy]
    },
  }
}

/** Глубина k-й карточки около 1 (±spread): умножает и параллакс, и прокрутку. */
export function depth(k: number, spread = 0.04) {
  return 1 + spread * Math.sin(k * 2.3)
}
