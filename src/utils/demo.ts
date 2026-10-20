import type { LoadedImage } from '../types/audit'
import { loadImageFromBlob } from './imageLoader'

const WIDTH = 960
const HEIGHT = 600

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath()
  ctx.roundRect(x, y, w, h, r)
}

interface SceneVariant {
  titleSize: number
  titleColor: string
  buttonX: number
  buttonColor: string
  buttonRadius: number
  cardOffsetY: number
  cardShadow: boolean
  navGap: number
}

function drawScene(ctx: CanvasRenderingContext2D, v: SceneVariant): void {
  ctx.fillStyle = '#f5f6fb'
  ctx.fillRect(0, 0, WIDTH, HEIGHT)

  // Navbar
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, WIDTH, 64)
  ctx.fillStyle = '#e4e6f1'
  ctx.fillRect(0, 64, WIDTH, 1)
  ctx.fillStyle = '#5b4bff'
  ctx.beginPath()
  ctx.arc(80, 32, 14, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#12122b'
  ctx.font = '700 18px Inter, system-ui, sans-serif'
  ctx.textBaseline = 'middle'
  ctx.fillText('Orbit', 104, 33)
  ctx.font = '500 14px Inter, system-ui, sans-serif'
  ctx.fillStyle = '#5b5f7a'
  let navX = 600
  for (const label of ['Product', 'Pricing', 'Docs', 'Sign in']) {
    ctx.fillText(label, navX, 33)
    navX += ctx.measureText(label).width + v.navGap
  }

  // Hero
  ctx.textBaseline = 'alphabetic'
  ctx.fillStyle = v.titleColor
  ctx.font = `800 ${v.titleSize}px Inter, system-ui, sans-serif`
  ctx.fillText('Ship pixel-perfect UI', 64, 160)
  ctx.fillStyle = '#5b5f7a'
  ctx.font = '400 18px Inter, system-ui, sans-serif'
  ctx.fillText('Compare, audit and fix layouts before they reach production.', 64, 200)

  // Buttons
  ctx.fillStyle = v.buttonColor
  roundRect(ctx, v.buttonX, 232, 168, 48, v.buttonRadius)
  ctx.fill()
  ctx.fillStyle = '#ffffff'
  ctx.font = '600 15px Inter, system-ui, sans-serif'
  ctx.textBaseline = 'middle'
  ctx.fillText('Get started', v.buttonX + 40, 257)

  ctx.strokeStyle = '#c9cce0'
  ctx.lineWidth = 1
  roundRect(ctx, 252.5, 232.5, 140, 47, 10)
  ctx.stroke()
  ctx.fillStyle = '#12122b'
  ctx.fillText('Live demo', 288, 257)

  // Cards
  const titles = ['Auto diff', 'AI audit', 'Prompt export']
  titles.forEach((title, i) => {
    const x = 64 + i * 288
    const y = 340 + (i === 2 ? v.cardOffsetY : 0)
    ctx.save()
    if (i < 2 || v.cardShadow) {
      ctx.shadowColor = 'rgba(40, 40, 90, 0.14)'
      ctx.shadowBlur = 24
      ctx.shadowOffsetY = 8
    }
    ctx.fillStyle = '#ffffff'
    roundRect(ctx, x, y, 256, 188, 16)
    ctx.fill()
    ctx.restore()
    ctx.fillStyle = '#ff2bd6'
    roundRect(ctx, x + 24, y + 24, 36, 36, 10)
    ctx.fill()
    ctx.fillStyle = '#12122b'
    ctx.font = '700 17px Inter, system-ui, sans-serif'
    ctx.textBaseline = 'alphabetic'
    ctx.fillText(title, x + 24, y + 96)
    ctx.fillStyle = '#5b5f7a'
    ctx.font = '400 13px Inter, system-ui, sans-serif'
    ctx.fillText('Pixel-accurate comparison', x + 24, y + 122)
    ctx.fillText('with live DOM mapping.', x + 24, y + 142)
  })
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('PNG encoding failed'))), 'image/png')
  })
}

/** Built-in sample pair with deliberate discrepancies, to try every tool offline. */
export async function createDemoPair(): Promise<{ design: LoadedImage; impl: LoadedImage }> {
  if ('fonts' in document) await document.fonts.ready

  const make = async (variant: SceneVariant, name: string) => {
    const canvas = document.createElement('canvas')
    canvas.width = WIDTH
    canvas.height = HEIGHT
    const ctx = canvas.getContext('2d')!
    drawScene(ctx, variant)
    return loadImageFromBlob(await canvasToBlob(canvas), name)
  }

  const design = await make(
    {
      titleSize: 44,
      titleColor: '#12122b',
      buttonX: 64,
      buttonColor: '#5b4bff',
      buttonRadius: 10,
      cardOffsetY: 0,
      cardShadow: true,
      navGap: 32,
    },
    'demo-design.png',
  )
  const impl = await make(
    {
      titleSize: 40,
      titleColor: '#1d1d3a',
      buttonX: 72,
      buttonColor: '#6a5bff',
      buttonRadius: 4,
      cardOffsetY: 12,
      cardShadow: false,
      navGap: 24,
    },
    'demo-implementation.png',
  )
  return { design, impl }
}
