/**
 * The light control.
 *
 * eOPN3 is bistable: a brief pulse of light suppresses transmitter release, and
 * that suppression outlasts the light, recovering on its own over minutes. So
 * this is a momentary control, not a toggle. Holding it drives suppression up
 * quickly; releasing it starts a slow, decelerating recovery.
 *
 * Time is compressed. Real recovery takes minutes; here it takes about fifteen
 * seconds, which is long enough to feel like a process and short enough to watch.
 */

const RISE = 4.2          // per second while illuminated
const DECAY_BASE = 0.052  // per second once the light is off
const DECAY_GAIN = 0.055  // extra decay proportional to remaining suppression

export class Stim extends EventTarget {
  constructor ({ button, hint, canvas } = {}) {
    super()
    this.value = 0
    this.held = false
    this.usedOnce = false
    this.button = button
    this.hint = hint

    const press = (event) => {
      if (event?.cancelable) event.preventDefault()
      this.press()
    }
    const release = () => this.release()

    if (button) {
      button.addEventListener('pointerdown', press)
      button.addEventListener('keydown', (e) => {
        if (e.key === ' ' || e.key === 'Enter') press(e)
      })
      button.addEventListener('keyup', (e) => {
        if (e.key === ' ' || e.key === 'Enter') release()
      })
    }
    if (canvas) canvas.addEventListener('pointerdown', press)

    addEventListener('pointerup', release)
    addEventListener('pointercancel', release)
    addEventListener('blur', release)

    // Space anywhere, as long as the reader is not typing or on the button.
    addEventListener('keydown', (e) => {
      if (e.code === 'Space' && e.target === document.body) press(e)
    })
    addEventListener('keyup', (e) => {
      if (e.code === 'Space') release()
    })
  }

  press () {
    if (this.held) return
    this.held = true
    if (!this.usedOnce) {
      this.usedOnce = true
      this.hint?.classList.add('gone')
    }
    this.dispatchEvent(new CustomEvent('change', { detail: this.state }))
  }

  release () {
    if (!this.held) return
    this.held = false
    this.dispatchEvent(new CustomEvent('change', { detail: this.state }))
  }

  get state () {
    if (this.held) return 'lit'
    return this.value > 0.02 ? 'recovering' : 'resting'
  }

  /** Percentage of transmitter release still available. */
  get release () {
    return Math.round((1 - this.value) * 100)
  }

  update (dt) {
    const before = this.state
    if (this.held) {
      this.value = Math.min(1, this.value + dt * RISE)
    } else {
      this.value = Math.max(0, this.value - dt * (DECAY_BASE + this.value * DECAY_GAIN))
    }
    if (this.state !== before) {
      this.dispatchEvent(new CustomEvent('change', { detail: this.state }))
    }
    return this.value
  }
}
