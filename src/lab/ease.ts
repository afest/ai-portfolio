import gsap from 'gsap'
import { bezierEase } from '../kit/ease'
import type { EffectConfig } from './sets'

/** Кривая эффекта из effects.json набора: стандартная GSAP или cubic-bezier (через CustomEase). */
export function easeOf(e: EffectConfig): { ease: string | gsap.EaseFunction; fn: gsap.EaseFunction; duration: number } {
  const cfg = e.ease
  if (cfg.gsap) return { ease: cfg.gsap, fn: gsap.parseEase(cfg.gsap), duration: cfg.duration }
  const fn = bezierEase(cfg.bezier!, `linza-${e.set}-${e.id}`)
  return { ease: fn, fn, duration: cfg.duration }
}
