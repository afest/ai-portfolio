// Кубик «рост из угла с размытием движения» — шейдер смены слайда: следующий слайд
// растёт из превью в правом нижнем углу на весь экран, содержимое масштабируется вместе с рамкой
// и размыто лучами от угла. Размытие честное, движения: картинка усредняется по масштабам за
// выдержку кадра (uP.x … uP.y), CSS filter: blur дал бы ровное пятно без лучей.
//
// Слои: A — текущий слайд (растёт на GROW_A и размывается), B — следующий (растёт из превью
// PREVIEW в правом нижнем углу на весь экран), C — превью следующего за ним (растёт в углу из нуля),
// LA / LB — подписи слайдов в экранных координатах (картинка размером с экран, с прозрачностью).
//
// Как забрать: скопировать файл; нужен three. Один ShaderMaterial на плоскости во весь экран:
//   const mat = new THREE.ShaderMaterial({ vertexShader: vert, fragmentShader: frag,
//     uniforms: cornerUniforms(A, B, C, LA, LB, { res: [w, h], preview: [314, 176] }) })
//   scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat))   // камера любая: vert не трогает матрицы
// Прогресс хода p (0 → 1 по кривой) — в mat.uniforms.uP: x — сейчас, y — в начале выдержки кадра
// (та же кривая на SHUTTER / 60 с раньше). Подпись нового слайда — uLabelB 0 → 1, когда рамка её
// накрыла. Картинки — через texture() (flipY выключен: uv от левого верхнего угла).
// Рендерер: без тонмаппинга и без sRGB-преобразования выхода (в R3F — flat и linear), antialias не нужен.
// Цифры: PREVIEW — размер превью, SHUTTER — выдержка, подобранная по резкости в середине хода,
// GROW_A — старый слайд под новым вырастает на 5% (T-486). Кривая хода — токен T1:
// cubic-bezier(0.662, 0.031, 0.384, 0.919) за 901 мс.
//
// Точка роста (anchor, T-515): неподвижная точка, к которой сжат слайд в превью. По умолчанию — правый
// нижний угол экрана. Превью в другом месте — anchorFor(угол превью):
// например, превью в правом верхнем углу под навигацией — слайд растёт справа налево и сверху вниз.
import * as THREE from 'three'

export const PREVIEW: [number, number] = [314, 176]   // размер превью, px сцены 1920×1080
export const SHUTTER = 0.5                            // выдержка кадра, в кадрах (60 fps); подобрана по резкости
export const GROW_A = 0.05                            // старый слайд вырастает на 5% к концу хода
export const RES: [number, number] = [1920, 1080]

export const vert = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`

export const frag = /* glsl */ `
precision highp float;
varying vec2 vUv;
uniform sampler2D uA, uB, uC, uLA, uLB;
uniform vec2 uRes, uPrev, uF;
uniform float uS0, uGrowA, uLabelB;
uniform vec2 uP;          // прогресс хода: x — сейчас, y — в начале выдержки кадра
const int N = 32;

// экран, сжатый в s раз к точке роста F: точка содержимого под пикселем P (uv)
vec2 zoomUv(vec2 P, float s) { return (uF + (P - uF) / s) / uRes; }
// доля пикселя P внутри прямоугольника lo…hi — сглаженный край
float inside(vec2 P, vec2 lo, vec2 hi) {
  vec2 k = clamp(P - lo + 0.5, 0.0, 1.0) * clamp(hi - P + 0.5, 0.0, 1.0);
  return k.x * k.y;
}

void main() {
  vec2 P = vec2(vUv.x, 1.0 - vUv.y) * uRes;   // px, начало — левый верхний угол
  vec2 k = uF / uRes;                          // где F делит экран — превью F делит так же
  float sB = mix(uS0, 1.0, uP.x);
  float covB = inside(P, uF * (1.0 - sB), uF + sB * (uRes - uF));
  float sC = uP.x;
  vec2 loC = uF - sC * k * uPrev;
  float covC = sC > 0.0005 ? inside(P, loC, loC + sC * uPrev) : 0.0;

  // кадр стоит (uP.x == uP.y) — все выборки одинаковые, хватает одной: тот же цвет, в 32 раза меньше работы (T-515)
  vec3 a = vec3(0.0), b = vec3(0.0), c = vec3(0.0);
  float cnt = 0.0;
  for (int i = 0; i < N; i++) {
    if (i > 0 && uP.x == uP.y) break;
    float p = mix(uP.x, uP.y, float(i) / float(N - 1));
    float q = max(p, 0.0005);
    a += texture2D(uA, zoomUv(P, 1.0 + uGrowA * p)).rgb;
    b += texture2D(uB, zoomUv(P, mix(uS0, 1.0, p))).rgb;
    c += texture2D(uC, (P - (uF - q * k * uPrev)) / (q * uPrev)).rgb;
    cnt += 1.0;
  }
  a /= cnt; b /= cnt; c /= cnt;

  vec2 su = P / uRes;
  vec4 la = texture2D(uLA, su);
  vec4 lb = texture2D(uLB, su);
  vec3 colA = mix(a, la.rgb, la.a);
  vec3 colB = mix(b, lb.rgb, lb.a * uLabelB);
  vec3 col = mix(colA, colB, covB);
  col = mix(col, c, covC);
  gl_FragColor = vec4(col, 1.0);
}
`

/** Прогресс хода в начале выдержки кадра (для uP.y): та же кривая на shutter кадров раньше. t, start — секунды. */
export function shutterStart(ease: (p: number) => number, t: number, start: number, duration: number, shutter = SHUTTER, fps = 60) {
  return ease(Math.min(1, Math.max(0, (t - shutter / fps - start) / duration)))
}

export function texture(img: TexImageSource) {
  const t = new THREE.Texture(img as HTMLImageElement)
  t.flipY = false                       // uv считаем от левого верхнего угла картинки
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping
  t.minFilter = THREE.LinearMipmapLinearFilter
  t.needsUpdate = true
  return t
}

export type CornerUniforms = {
  uA: { value: THREE.Texture }; uB: { value: THREE.Texture }; uC: { value: THREE.Texture }
  uLA: { value: THREE.Texture }; uLB: { value: THREE.Texture }
  uRes: { value: THREE.Vector2 }; uPrev: { value: THREE.Vector2 }; uF: { value: THREE.Vector2 }
  uS0: { value: number }; uGrowA: { value: number }; uLabelB: { value: number }; uP: { value: THREE.Vector2 }
}

/** anchor — точка роста, px экрана; по умолчанию правый нижний угол (= res). */
type Opts = { res?: [number, number]; preview?: [number, number]; growA?: number; anchor?: [number, number] }

/** Точка роста для превью, левый верхний угол которого — lo (px экрана): превью — экран, сжатый к ней. */
export function anchorFor(lo: [number, number], res: [number, number] = RES, preview: [number, number] = PREVIEW): [number, number] {
  return [lo[0] / (1 - preview[0] / res[0]), lo[1] / (1 - preview[1] / res[1])]
}

/** Рамка нового слайда в масштабе s (от превью до 1): [x, y, правый край, нижний край], px экрана. */
export function zoomRect(s: number, anchor: [number, number], res: [number, number] = RES): [number, number, number, number] {
  const [fx, fy] = anchor
  return [fx * (1 - s), fy * (1 - s), fx + s * (res[0] - fx), fy + s * (res[1] - fy)]
}

export function cornerUniforms(A: THREE.Texture, B: THREE.Texture, C: THREE.Texture, LA: THREE.Texture, LB: THREE.Texture,
  { res = RES, preview = PREVIEW, growA = GROW_A, anchor = res }: Opts = {}): CornerUniforms {
  return {
    uA: { value: A }, uB: { value: B }, uC: { value: C }, uLA: { value: LA }, uLB: { value: LB },
    uRes: { value: new THREE.Vector2(...res) },
    uPrev: { value: new THREE.Vector2(...preview) },
    uF: { value: new THREE.Vector2(...anchor) },
    uS0: { value: preview[0] / res[0] },
    uGrowA: { value: growA },
    uLabelB: { value: 0 },
    uP: { value: new THREE.Vector2(0, 0) },
  }
}
