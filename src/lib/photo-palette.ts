import Taro from '@tarojs/taro'
import type { CSSProperties } from 'react'
import { brandColors } from '@/lib/design-tokens'

export type Rgb = { r: number; g: number; b: number }

export type PhotoPalette = {
  /** 环境主色（尽量忠实于照片背景） */
  env: Rgb
  base: string
  mid: string
  highlight: string
  line: string
  lineSoft: string
}

const FALLBACK_ENV: Rgb = { r: 232, g: 236, b: 242 }

const FALLBACK: PhotoPalette = {
  env: FALLBACK_ENV,
  base: toRgb(FALLBACK_ENV.r, FALLBACK_ENV.g, FALLBACK_ENV.b),
  mid: toRgb(238, 241, 246),
  highlight: toRgb(245, 247, 250),
  line: 'rgba(120,130,150,0.12)',
  lineSoft: 'rgba(201,169,110,0.10)',
}

const CACHE_PREFIX = 'env-v5:'
const COMPOSE_PREFIX = 'compose-v5:'
const cache = new Map<string, PhotoPalette>()
const composeCache = new Map<string, string>()
const inflight = new Map<string, Promise<PhotoPalette>>()
const composeInflight = new Map<string, Promise<string>>()

const THUMB_W = 336
const THUMB_H = 240
const FEATHER = 14

function clamp(n: number, min = 0, max = 255) {
  return Math.max(min, Math.min(max, Math.round(n)))
}

function toRgb(r: number, g: number, b: number) {
  return `rgb(${clamp(r)}, ${clamp(g)}, ${clamp(b)})`
}

function mix(a: Rgb, b: Rgb, t: number): Rgb {
  return {
    r: a.r + (b.r - a.r) * t,
    g: a.g + (b.g - a.g) * t,
    b: a.b + (b.b - a.b) * t,
  }
}

function luminance(r: number, g: number, b: number) {
  return 0.299 * r + 0.587 * g + 0.114 * b
}

function chroma(r: number, g: number, b: number) {
  return Math.max(r, g, b) - Math.min(r, g, b)
}

function isLikelySkin(r: number, g: number, b: number) {
  const y = luminance(r, g, b)
  const cb = 128 - 0.168736 * r - 0.331264 * g + 0.5 * b
  const cr = 128 + 0.5 * r - 0.418688 * g - 0.081312 * b
  return y > 50 && y < 235 && cr > 133 && cr < 178 && cb > 77 && cb < 132
}

/** 同色相微调明度，不引入藏青等异色 */
function shade(c: Rgb, delta: number): Rgb {
  if (delta >= 0) return mix(c, { r: 255, g: 255, b: 255 }, delta)
  return mix(c, { r: 0, g: 0, b: 0 }, -delta)
}

function paletteFromEnv(env: Rgb): PhotoPalette {
  // 浅色环境：两侧略提亮/微灰，避免压成脏灰
  // 深色/彩色环境：两侧用极近明度变化，保持同色相
  const L = luminance(env.r, env.g, env.b)
  const base = L > 200 ? shade(env, -0.04) : shade(env, -0.06)
  const mid = L > 200 ? shade(env, 0.02) : env
  const highlight = L > 200 ? shade(env, 0.06) : shade(env, 0.08)
  const lineRgb = shade(env, L > 180 ? -0.12 : -0.14)
  const softRgb = shade(env, L > 180 ? -0.08 : 0.12)
  return {
    env,
    base: toRgb(base.r, base.g, base.b),
    mid: toRgb(mid.r, mid.g, mid.b),
    highlight: toRgb(highlight.r, highlight.g, highlight.b),
    line: `rgba(${clamp(lineRgb.r)},${clamp(lineRgb.g)},${clamp(lineRgb.b)},0.22)`,
    lineSoft: `rgba(${clamp(softRgb.r)},${clamp(softRgb.g)},${clamp(softRgb.b)},0.16)`,
  }
}

export const buildPhotoBackdropStyle = (palette: PhotoPalette): CSSProperties => ({
  backgroundColor: palette.mid,
  backgroundImage: [
    `linear-gradient(148deg, ${palette.base} 0%, ${palette.mid} 48%, ${palette.highlight} 100%)`,
    `repeating-linear-gradient(-28deg, ${palette.line} 0px, ${palette.line} 1px, transparent 1px, transparent 10px)`,
    `repeating-linear-gradient(52deg, ${palette.lineSoft} 0px, ${palette.lineSoft} 1px, transparent 1px, transparent 14px)`,
  ].join(', '),
})

const sampleEnvFromPixels = (data: Uint8ClampedArray | number[], width: number, height: number): Rgb => {
  const band = Math.max(3, Math.floor(Math.min(width, height) * 0.2))
  const corner = Math.max(4, Math.floor(Math.min(width, height) * 0.3))
  const buckets = new Map<string, { w: number; r: number; g: number; b: number; n: number }>()

  const push = (r: number, g: number, b: number, weight: number) => {
    if (weight <= 0 || isLikelySkin(r, g, b)) return
    // 服饰高饱和降权；浅灰/白/证件蓝保留
    const c = chroma(r, g, b)
    const L = luminance(r, g, b)
    if (c > 130 && L > 40 && L < 210) weight *= 0.2
    const q = 16
    const key = `${Math.round(r / q) * q},${Math.round(g / q) * q},${Math.round(b / q) * q}`
    const prev = buckets.get(key)
    if (prev) {
      prev.w += weight
      prev.r += r * weight
      prev.g += g * weight
      prev.b += b * weight
      prev.n += weight
    } else {
      buckets.set(key, { w: weight, r: r * weight, g: g * weight, b: b * weight, n: weight })
    }
  }

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const inPerson =
        x >= width * 0.24 && x <= width * 0.76 && y >= height * 0.1 && y <= height * 0.94
      if (inPerson) continue
      const i = (y * width + x) * 4
      if (data[i + 3] < 120) continue
      const r = data[i]
      const g = data[i + 1]
      const b = data[i + 2]
      const inCorner =
        (x < corner && y < corner)
        || (x >= width - corner && y < corner)
        || (x < corner && y >= height - corner)
        || (x >= width - corner && y >= height - corner)
      const inFrame = x < band || y < band || x >= width - band || y >= height - band
      if (inCorner) push(r, g, b, 5)
      else if (inFrame) push(r, g, b, 1.4)
    }
  }

  if (!buckets.size) return FALLBACK_ENV

  const ranked = [...buckets.values()].sort((a, b) => b.w - a.w)
  let winner = ranked[0]
  if (ranked.length > 1) {
    const c0 = chroma(winner.r / winner.n, winner.g / winner.n, winner.b / winner.n)
    const c1 = chroma(ranked[1].r / ranked[1].n, ranked[1].g / ranked[1].n, ranked[1].b / ranked[1].n)
    // 若众数过饱和且次优更像墙面，用次优
    if (c0 > 100 && c1 < c0 * 0.7 && ranked[1].w >= winner.w * 0.4) winner = ranked[1]
  }

  return {
    r: winner.r / winner.n,
    g: winner.g / winner.n,
    b: winner.b / winner.n,
  }
}

const resolveLocalPath = async (url: string): Promise<string> => {
  const src = String(url || '').trim()
  if (!src) throw new Error('empty image url')
  if (!/^https?:\/\//i.test(src)) return src
  const res = await Taro.downloadFile({ url: src })
  if (res.statusCode && res.statusCode >= 400) throw new Error(`download ${res.statusCode}`)
  if (!res.tempFilePath) throw new Error('download empty path')
  return res.tempFilePath
}

type Offscreen = {
  getContext: (type: '2d') => CanvasRenderingContext2D | null
  createImage: () => HTMLImageElement & { src: string }
  width: number
  height: number
}

const createOffscreen = (width: number, height: number) =>
  Taro.createOffscreenCanvas({ type: '2d', width, height }) as unknown as Offscreen

const loadCanvasImage = async (canvas: Offscreen, localPath: string) => {
  const img = canvas.createImage()
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve()
    img.onerror = () => reject(new Error('image load failed'))
    img.src = localPath
  })
  return img
}

const drawLinearPattern = (ctx: CanvasRenderingContext2D, w: number, h: number, env: Rgb) => {
  const L = luminance(env.r, env.g, env.b)
  const a = shade(env, L > 180 ? -0.1 : -0.16)
  const b = shade(env, L > 180 ? -0.05 : 0.1)
  ctx.save()
  ctx.strokeStyle = `rgba(${clamp(a.r)},${clamp(a.g)},${clamp(a.b)},${L > 180 ? 0.28 : 0.2})`
  ctx.lineWidth = 1
  const step = 10
  for (let x = -h; x < w + h; x += step) {
    ctx.beginPath()
    ctx.moveTo(x, 0)
    ctx.lineTo(x + h, h)
    ctx.stroke()
  }
  ctx.strokeStyle = `rgba(${clamp(b.r)},${clamp(b.g)},${clamp(b.b)},${L > 180 ? 0.16 : 0.14})`
  for (let x = -h; x < w + h; x += 14) {
    ctx.beginPath()
    ctx.moveTo(x + h, 0)
    ctx.lineTo(x, h)
    ctx.stroke()
  }
  ctx.restore()
}

/** 在人像左右边缘做同色羽化，消除硬切边 */
const featherPortraitSides = (
  ctx: CanvasRenderingContext2D,
  canvasW: number,
  canvasH: number,
  left: number,
  top: number,
  right: number,
  bottom: number,
  env: Rgb,
  feather: number,
) => {
  const imageData = ctx.getImageData(0, 0, canvasW, canvasH)
  const data = imageData.data
  const er = env.r
  const eg = env.g
  const eb = env.b

  const blendX = (x: number, y: number, t: number) => {
    if (t <= 0) return
    const i = (y * canvasW + x) * 4
    const k = Math.min(1, Math.max(0, t))
    data[i] = data[i] * (1 - k) + er * k
    data[i + 1] = data[i + 1] * (1 - k) + eg * k
    data[i + 2] = data[i + 2] * (1 - k) + eb * k
  }

  for (let y = Math.max(0, Math.floor(top)); y < Math.min(canvasH, Math.ceil(bottom)); y += 1) {
    for (let d = 0; d < feather; d += 1) {
      const t = (feather - d) / feather
      const ease = t * t * (3 - 2 * t)
      const xl = Math.round(left + d)
      const xr = Math.round(right - 1 - d)
      if (xl >= 0 && xl < canvasW) blendX(xl, y, ease * 0.92)
      if (xr >= 0 && xr < canvasW) blendX(xr, y, ease * 0.92)
    }
  }
  ctx.putImageData(imageData, 0, 0)
}

const paletteFromPixels = (data: Uint8ClampedArray | number[], width: number, height: number): PhotoPalette =>
  paletteFromEnv(sampleEnvFromPixels(data, width, height))

const sampleWithOffscreenCanvas = async (localPath: string): Promise<PhotoPalette> => {
  const size = 64
  const canvas = createOffscreen(size, size)
  const ctx = canvas.getContext('2d')
  if (!ctx || typeof canvas.createImage !== 'function') throw new Error('offscreen canvas unavailable')
  const img = await loadCanvasImage(canvas, localPath)
  ctx.clearRect(0, 0, size, size)
  ctx.drawImage(img as unknown as CanvasImageSource, 0, 0, size, size)
  return paletteFromPixels(ctx.getImageData(0, 0, size, size).data, size, size)
}

/** 合成整图：环境色铺底 + 线纹 + 居中人像 + 边缘羽化，消除 letterbox 硬边 */
export async function composeTalentThumbTempFile(url: string): Promise<string> {
  const key = `${COMPOSE_PREFIX}${String(url || '').trim()}`
  const hit = composeCache.get(key)
  if (hit) return hit
  const pending = composeInflight.get(key)
  if (pending) return pending

  const task = (async () => {
    const localPath = await resolveLocalPath(url)
    const palette = await extractPhotoPalette(url)
    const env = palette.env
    const canvas = createOffscreen(THUMB_W, THUMB_H)
    const ctx = canvas.getContext('2d')
    if (!ctx || typeof canvas.createImage !== 'function') throw new Error('offscreen canvas unavailable')

    // 1) 环境色渐变铺底（忠实色相）
    const grad = ctx.createLinearGradient(0, 0, THUMB_W, THUMB_H)
    grad.addColorStop(0, palette.base)
    grad.addColorStop(0.5, palette.mid)
    grad.addColorStop(1, palette.highlight)
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, THUMB_W, THUMB_H)

    // 2) 隐约线性图案（同色相）
    drawLinearPattern(ctx, THUMB_W, THUMB_H, env)

    // 3) 居中绘制原图（保持比例）
    const img = await loadCanvasImage(canvas, localPath)
    const iw = Number((img as any).width) || THUMB_W
    const ih = Number((img as any).height) || THUMB_H
    const scale = Math.min(THUMB_W / iw, THUMB_H / ih)
    const dw = iw * scale
    const dh = ih * scale
    const dx = (THUMB_W - dw) / 2
    const dy = (THUMB_H - dh) / 2
    ctx.drawImage(img as unknown as CanvasImageSource, dx, dy, dw, dh)

    // 4) 左右羽化到环境色，消硬边
    featherPortraitSides(ctx, THUMB_W, THUMB_H, dx, dy, dx + dw, dy + dh, env, FEATHER)

    // 顶部轻微光感
    const veil = ctx.createLinearGradient(0, 0, 0, THUMB_H)
    veil.addColorStop(0, `rgba(255,255,255,${luminance(env.r, env.g, env.b) > 180 ? 0.1 : 0.04})`)
    veil.addColorStop(0.45, 'rgba(255,255,255,0)')
    veil.addColorStop(1, `rgba(0,0,0,${luminance(env.r, env.g, env.b) > 180 ? 0.03 : 0.08})`)
    ctx.fillStyle = veil
    ctx.fillRect(0, 0, THUMB_W, THUMB_H)

    const { tempFilePath } = await Taro.canvasToTempFilePath({
      // @ts-expect-error 离屏 canvas
      canvas,
      fileType: 'png',
      quality: 1,
      destWidth: THUMB_W,
      destHeight: THUMB_H,
    })
    if (!tempFilePath) throw new Error('canvasToTempFilePath empty')
    composeCache.set(key, tempFilePath)
    return tempFilePath
  })().finally(() => {
    composeInflight.delete(key)
  })

  composeInflight.set(key, task)
  return task
}

/** 从人像照片采样环境背景主色 */
export async function extractPhotoPalette(url: string): Promise<PhotoPalette> {
  const key = `${CACHE_PREFIX}${String(url || '').trim()}`
  if (!String(url || '').trim()) return FALLBACK
  const hit = cache.get(key)
  if (hit) return hit
  const pending = inflight.get(key)
  if (pending) return pending

  const task = (async () => {
    try {
      const localPath = await resolveLocalPath(String(url).trim())
      const palette = await sampleWithOffscreenCanvas(localPath)
      cache.set(key, palette)
      return palette
    } catch (error) {
      console.warn('[photo-palette] extract failed, use fallback', error)
      cache.set(key, FALLBACK)
      return FALLBACK
    } finally {
      inflight.delete(key)
    }
  })()

  inflight.set(key, task)
  return task
}

export const defaultPhotoPalette = FALLBACK
