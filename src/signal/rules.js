/**
 * Draws the hairlines between sections as live traces of the shared signal.
 *
 * Each rule reads the same ring buffer, skewed by a fraction of a second, so
 * they read as neighbouring channels of one montage rather than as unrelated
 * animations.
 *
 * The skew is deliberately small. An earlier version spaced the rules a whole
 * window apart, which put most of them tens of seconds into the past: holding
 * the light changed the newest samples and nothing on screen moved, so the one
 * interaction on the page looked broken. Every rule now sits within half a
 * second of the write head and they quiet together, which is also what a real
 * montage does.
 *
 * Nothing here reads layout inside the frame. Widths are measured in `resize`
 * and cached; `draw` only touches numbers and the 2D context.
 */

const STEP = 2.2        // target horizontal pixels between samples
const BASE_STRIDE = 1   // samples advanced per horizontal step, at full speed
const TAIL_GUARD = 12   // samples nearest the write head, left alone
const SKEW = 45         // samples between one rule and the next, about 0.4 s

export class Rules {
  constructor (canvases) {
    const list = [...canvases]
    // Rank by the authored window index, not DOM order, so the slice each rule
    // gets is stable whatever order the sections are rendered in.
    const order = [...new Set(list.map((c) => Number(c.dataset.window) || 0))].sort((a, b) => a - b)

    this.items = list.map((canvas) => ({
      canvas,
      ctx: canvas.getContext('2d'),
      rank: order.indexOf(Number(canvas.dataset.window) || 0),
      tall: canvas.classList.contains('tall'),
      width: 0,
      height: 0,
      count: 0,
      step: STEP,
      stride: BASE_STRIDE,
      offset: 0,
      visible: true,
      stale: true,
      snapshot: null
    }))

    this.pending = true     // widths changed, offsets need recomputing
    this.level = -1         // quantised activity, reduced-motion redraw trigger
    this.colour = ''

    this.motion = matchMedia('(prefers-reduced-motion: reduce)')
    this.reduced = this.motion.matches
    this.motion.addEventListener?.('change', (event) => {
      this.reduced = event.matches
      this.invalidate()
    })

    this.resize()
    this.watchPixelRatio()

    // Off-screen rules cost nothing, and this needs no layout reads of its own.
    if (typeof IntersectionObserver === 'function') {
      const seen = new Map(this.items.map((item) => [item.canvas, item]))
      const observer = new IntersectionObserver((entries) => {
        for (const entry of entries) {
          const item = seen.get(entry.target)
          if (item) item.visible = entry.isIntersecting
        }
      }, { rootMargin: '150px 0px' })
      for (const item of this.items) observer.observe(item.canvas)
    }
  }

  /** Force a full redraw, and drop any frozen trace. */
  invalidate () {
    for (const item of this.items) {
      item.snapshot = null
      item.stale = true
    }
  }

  /** Measure. Reads are batched ahead of writes so the page lays out once. */
  resize () {
    const ratio = Math.min(devicePixelRatio || 1, 2)
    const boxes = this.items.map((item) => item.canvas.getBoundingClientRect())

    this.items.forEach((item, i) => {
      const box = boxes[i]
      item.width = box.width
      item.height = box.height
      item.canvas.width = Math.max(1, Math.round(box.width * ratio))
      item.canvas.height = Math.max(1, Math.round(box.height * ratio))
      item.ctx?.setTransform(ratio, 0, 0, ratio, 0, 0)
    })

    this.pending = true
    this.invalidate()
  }

  /**
   * Hand each rule its own slice of the recording.
   *
   * Widths vary by a factor of five across the supported viewports, so the
   * number of samples on screen does too. Fixed offsets would overlap almost
   * completely on a wide screen and run past the end of the buffer on a very
   * wide one; both were visible as rules that looked like copies of each other.
   */
  plan (capacity) {
    const n = this.items.length
    // The deepest read is the widest window plus the last rule's skew; keep it
    // inside the buffer whatever the viewport does.
    const room = Math.max(64, capacity - TAIL_GUARD - (n - 1) * SKEW)
    const stride = BASE_STRIDE
    const most = Math.max(2, Math.floor(room / stride))

    for (const item of this.items) {
      item.stride = stride
      item.count = Math.max(2, Math.min(Math.floor(item.width / STEP) || 2, most))
      item.step = item.width / item.count
      item.offset = TAIL_GUARD + item.rank * SKEW
    }

    this.pending = false
  }

  /** Copy a rule's window out of the buffer so it can be drawn without moving. */
  freeze (item, signal) {
    const scale = Math.max(signal.activity, 0.07)
    const samples = new Float32Array(item.count)
    for (let i = 0; i < item.count; i++) {
      samples[i] = signal.at((item.count - i) * item.stride + item.offset) / scale
    }
    item.snapshot = samples
  }

  /**
   * `colour` is the current state colour, so the trace matches the page, and
   * `ruleColour` is the hairline it is drawn over. Both come from the tokens.
   */
  draw (signal, colour, ruleColour) {
    if (this.pending) this.plan(signal.capacity)

    if (this.reduced) {
      // Still a trace, still the real signal, but it holds still. It is redrawn
      // only when the control changes what the recording should look like.
      const level = Math.round(signal.activity * 8)
      if (level !== this.level || colour !== this.colour) {
        this.level = level
        this.colour = colour
        for (const item of this.items) item.stale = true
      }
    }

    for (const item of this.items) {
      if (!item.ctx || !item.width || !item.height || !item.visible) continue
      if (this.reduced) {
        if (!item.stale) continue
        if (!item.snapshot || item.snapshot.length !== item.count) this.freeze(item, signal)
        item.stale = false
      }
      this.paint(item, signal, colour, ruleColour)
    }
  }

  paint (item, signal, colour, ruleColour) {
    const { ctx, width: w, height: h, count, step } = item
    const frozen = this.reduced ? item.snapshot : null
    const scale = frozen ? signal.activity : 1

    ctx.clearRect(0, 0, w, h)

    ctx.strokeStyle = ruleColour
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(0, h - 0.5)
    ctx.lineTo(w, h - 0.5)
    ctx.stroke()

    const mid = h * 0.55
    const amp = h * (item.tall ? 0.26 : 0.34)

    ctx.strokeStyle = colour
    ctx.globalAlpha = item.tall ? 0.85 : 0.5
    ctx.lineWidth = 1.1
    ctx.lineJoin = 'round'
    ctx.beginPath()
    for (let i = 0; i < count; i++) {
      const v = frozen
        ? frozen[i] * scale
        : signal.at((count - i) * item.stride + item.offset)
      const x = i * step
      // Spikes run several times the height of the background. An amplifier
      // saturates rather than squaring off at the edge of the paper, and so
      // does this: below the knee it is linear, above it it rolls over.
      const y = mid - Math.tanh(v * 0.8) * amp * 1.25
      if (i) ctx.lineTo(x, y)
      else ctx.moveTo(x, y)
    }
    ctx.stroke()
    ctx.globalAlpha = 1
  }

  /** Re-measure when the window moves to a screen of a different density. */
  watchPixelRatio () {
    const query = matchMedia(`(resolution: ${devicePixelRatio || 1}dppx)`)
    query.addEventListener?.('change', () => {
      this.resize()
      this.watchPixelRatio()
    }, { once: true })
  }
}
