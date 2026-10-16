// Галерея проекта на шейдере главной (круг 8: «переключение как на главной»): кадр растёт из превью — точки клика —
// той же кривой T1 (kit/cornerZoom.ts; размытие движения выключено — решение Павла, круг 9). Холст виден
// только на время хода: в первом кадре хода он рисует то же, что DOM (картинка слоя и превью .gprev), в последнем —
// новый кадр, после чего DOM получает этот кадр и холст прячется (Razbory.tsx, shift). В покое видеокарта не занята.
// Вперёд: A — текущий кадр, B — следующий растёт из превью, C — превью следующего за ним. Назад — тот же ход в обратную
// сторону: текущий уходит в превью, открывая предыдущий.
import { useEffect, useRef, useState, type MutableRefObject } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import gsap from 'gsap'
import { ShaderCanvas, ShaderPlane } from '../lab/ShaderCanvas'
import { effect, preload } from '../lab/harness'
import { easeOf } from '../lab/ease'
import { cornerUniforms, frag, texture, vert } from '../kit/cornerZoom'
import { CAP } from '../demo/Marks'

const T1 = effect('motion', '01-04')

type Pt = [number, number]
export type GalleryRun = {
  /** Поставить кадры и точку роста, нарисовать первый кадр хода (холст ещё скрыт). */
  prepare: (a: number, b: number, c: number, F: Pt, dir: 1 | -1) => void
  /** Ход; промис — по его концу. */
  start: () => Promise<void>
}

/** Превью кадра в галерее (круг 9): высота — как у всех превью (CAP, высота букв «ЮНУСОВ»), пропорция — как у картинки. */
export const previewOf = (size: Pt): Pt => [(CAP * size[0]) / size[1], CAP]

/** Кадры проекта под размер картинки: как object-fit: cover у слоя — тот же кадр, что в DOM. */
export async function galleryTextures(srcs: string[], size: Pt) {
  const imgs = await preload(srcs)
  return imgs.map((im) => {
    const c = document.createElement('canvas')
    c.width = size[0]
    c.height = size[1]
    const k = Math.max(size[0] / im.naturalWidth, size[1] / im.naturalHeight)
    const w = im.naturalWidth * k
    const h = im.naturalHeight * k
    c.getContext('2d')!.drawImage(im, (size[0] - w) / 2, (size[1] - h) / 2, w, h)
    return texture(c)
  })
}

function emptyTexture() {
  const t = new THREE.DataTexture(new Uint8Array(4), 1, 1)
  t.needsUpdate = true
  return t
}

function Scene({ T, size, run }: { T: THREE.Texture[]; size: Pt; run: MutableRefObject<GalleryRun | null> }) {
  const { invalidate, gl } = useThree()
  const mat = useRef<THREE.ShaderMaterial>(null)
  const [blank] = useState(emptyTexture)
  const [uniforms] = useState(() => cornerUniforms(T[0], T[1 % T.length], T[2 % T.length], blank, blank,
    { res: size, preview: previewOf(size), anchor: [0, size[1]] }))
  const st = useRef({ p: 0, dir: 1 as 1 | -1, tl: null as gsap.core.Timeline | null })
  const { ease, duration } = easeOf(T1)

  useFrame(() => {
    const s = st.current
    const u = mat.current?.uniforms ?? uniforms
    const prev = s.p
    u.uP.value.set(s.p, prev)
  })

  // кадры нового проекта — сразу в видеокарту, а не на первом кадре хода (круг 10: там они подтормаживали бы старт)
  useEffect(() => {
    T.forEach((t) => gl.initTexture(t))
  }, [T])

  // кадр по запросу: пока идёт ход и один кадр после
  useEffect(() => {
    let tail = false
    const tick = () => {
      if (st.current.tl || tail) invalidate()
      tail = !!st.current.tl
    }
    gsap.ticker.add(tick)
    return () => gsap.ticker.remove(tick)
  }, [])

  run.current = {
    prepare: (a, b, c, F, dir) => {
      const u = mat.current?.uniforms ?? uniforms
      u.uA.value = T[a]
      u.uB.value = T[b]
      u.uC.value = T[c]
      u.uF.value.set(F[0], F[1])
      const s = st.current
      s.dir = dir
      s.p = dir > 0 ? 0 : 1
      s.tl = null
      invalidate()
    },
    start: () => new Promise<void>((resolve) => {
      const s = st.current
      const tl = gsap.timeline({ paused: true })
      tl.fromTo(s, { p: 0 }, { p: 1, duration, ease, immediateRender: false }, 0)
      s.tl = tl
      const end = () => {
        s.tl = null
        invalidate()
        resolve()
      }
      if (s.dir > 0) {
        tl.eventCallback('onComplete', end)
        tl.play(0)
      } else {
        tl.progress(1)
        tl.eventCallback('onReverseComplete', end)
        tl.reverse()
      }
    }),
  }

  return <ShaderPlane ref={mat} vert={vert} frag={frag} uniforms={uniforms} />
}

/** Холст галереи: размером с картинку, виден, только пока идёт ход (видимость — снаружи, через ref обёртки). */
export function GalleryCanvas({ T, size, run }: { T: THREE.Texture[]; size: Pt; run: MutableRefObject<GalleryRun | null> }) {
  return (
    <ShaderCanvas size={size}>
      <Scene T={T} size={size} run={run} />
    </ShaderCanvas>
  )
}
