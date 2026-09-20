/**
 * Draws the hairlines between sections as live traces of the shared signal.
 *
 * Each rule reads the same buffer at a different offset, so the page shows one
 * recording at several moments rather than several unrelated animations.
 */

const STEP = 2.2       // horizontal pixels between samples
const WINDOW_GAP = 260 // samples between one rule's window and the next

export class Rules {
  constructor (canvases) {
    this.items = [...canvases].map((canvas) => ({
      canvas,
      ctx: canvas.getContext('2d'),
      offset: Number(canvas.dataset.window || 0) * WINDOW_GAP,
      tall: canvas.classList.contains('tall'),
      width: 0,
      height: 0
    }))
    this.resize()
  }

  resize () {
    const ratio = Math.min(devicePixelRatio || 1, 2)
    for (const item of this.items) {
      const box = item.canvas.getBoundingClientRect()
      item.width = box.width
      item.height = box.height
      item.canvas.width = Math.max(1, Math.round(box.width * ratio))
      item.canvas.height = Math.max(1, Math.round(box.height * ratio))
      item.ctx.setTransform(ratio, 0, 0, ratio, 0, 0)
    }
  }

  /** `colour` is the current state colour, so the trace matches the page. */
  draw (signal, colour, ruleColour = 'rgba(168,176,189,.13)') {
    for (const item of this.items) {
      const { ctx, width: w, height: h } = item
      if (!w || !h) continue

      ctx.clearRect(0, 0, w, h)

      ctx.strokeStyle = ruleColour
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(0, h - 0.5)
      ctx.lineTo(w, h - 0.5)
      ctx.stroke()

      const mid = h * 0.55
      const amp = h * (item.tall ? 0.26 : 0.34)
      const count = Math.floor(w / STEP)

      ctx.strokeStyle = colour
      ctx.globalAlpha = item.tall ? 0.85 : 0.5
      ctx.lineWidth = 1.1
      ctx.lineJoin = 'round'
      ctx.beginPath()
      for (let i = 0; i < count; i++) {
        const v = signal.at((count - i) * 2 + item.offset)
        const x = i * STEP
        const y = mid - v * amp
        if (i) ctx.lineTo(x, y)
        else ctx.moveTo(x, y)
      }
      ctx.stroke()
      ctx.globalAlpha = 1
    }
  }
}
