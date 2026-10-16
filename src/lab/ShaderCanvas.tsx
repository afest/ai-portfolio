// Холст React Three Fiber для шейдера во весь экран 1920×1080 (на лендинге — размером со сцену:
// ширину и высоту даёт useStage).
// Настройки, без которых запись не детерминированная или цвет уезжает:
// - frameloop 'never' в записи: кадр рисует только seek() по времени таймлайна; на лендинге — 'demand' (T-515):
//   кадр рисуется, только когда сцена просит (invalidate) — во время хода и пока превью едет; в покое видеокарта свободна;
// - preserveDrawingBuffer: скриншот Playwright снимает уже нарисованный кадр;
// - flat + linear: без тонмаппинга и sRGB-преобразования — картинка как в файле;
// - resize offsetSize: сцена в живом режиме уменьшена transform: scale, холст меряется по раскладке.
import type { ReactNode, Ref } from 'react'
import { Canvas } from '@react-three/fiber'
import type * as THREE from 'three'
import { isRecord } from './harness'
import { useStage } from '../demo/DemoStage'

export function ShaderCanvas({ children, size }: { children: ReactNode; size?: [number, number] }) {
  const stage = useStage()   // лендинг: высота сцены — по пропорции окна, в узком окне и ширина своя
  const [W, H] = size ?? [stage.w, stage.h]   // галерея проектов (круг 8) — холст размером с картинку, а не со сцену
  return (
    <Canvas
      className="layer"
      dpr={1}
      resize={{ offsetSize: true }}
      flat
      linear
      frameloop={isRecord ? 'never' : 'demand'}
      gl={{ preserveDrawingBuffer: true, antialias: false }}
      style={{ width: W, height: H }}
    >
      {children}
    </Canvas>
  )
}

/** Плоскость во весь кадр с шейдером. Писать в uniform-ы через material.uniforms (ref): R3F копирует обёртки { value }. */
export function ShaderPlane({ vert, frag, uniforms, ref }: { vert: string; frag: string; uniforms: Record<string, THREE.IUniform>; ref: Ref<THREE.ShaderMaterial> }) {
  return (
    <mesh frustumCulled={false}>
      <planeGeometry args={[2, 2]} />
      <shaderMaterial ref={ref} vertexShader={vert} fragmentShader={frag} uniforms={uniforms} toneMapped={false} />
    </mesh>
  )
}
