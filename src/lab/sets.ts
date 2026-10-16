// Наборы эффектов: конфиги всех cases/<набор>/effects.json, имя набора — имя папки. Новый набор
// появляется сам: Vite находит его конфиг по шаблону пути. Папки cases/_* наборами не считаются.
// В конфиге — только то, что читает код: сетка кадров (fps, размер) и у каждого эффекта окно записи,
// кадр триггера и кривая.
type EaseConfig = { gsap?: string; bezier?: number[]; duration: number }

export type EffectConfig = {
  set: string
  id: string
  title: string
  window: [number, number]
  trigger_frame: number
  ease: EaseConfig
}

export type SetConfig = {
  name: string
  fps: number
  width: number
  height: number
  effects: EffectConfig[]
}

const FOLDER = /^[a-z0-9][a-z0-9-]*$/

const configs = import.meta.glob<Omit<SetConfig, 'name'>>('../cases/*/effects.json', {
  eager: true,
  import: 'default',
})

export const sets: SetConfig[] = Object.entries(configs)
  .map(([path, cfg]) => {
    const name = path.split('/').at(-2)!
    if (!FOLDER.test(name)) return null
    return {
      ...cfg,
      name,
      effects: (cfg.effects ?? []).map((e) => ({ ...e, set: name }) as EffectConfig),
    }
  })
  .filter((s): s is SetConfig => s !== null)
  .sort((a, b) => a.name.localeCompare(b.name))

export function setByName(name: string): SetConfig {
  const s = sets.find((x) => x.name === name)
  if (!s) throw new Error(`нет набора ${name} в cases/`)
  return s
}

export function effect(set: string, id: string): EffectConfig {
  const e = setByName(set).effects.find((x) => x.id === id)
  if (!e) throw new Error(`нет эффекта ${id} в cases/${set}/effects.json`)
  return e
}
