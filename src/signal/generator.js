/**
 * The single source of activity for the whole page.
 *
 * Both the point model and the rules drawn between sections read from this one
 * object, so they cannot drift apart: there is nothing to synchronise.
 *
 * The waveform is deliberately simple. A little band-limited noise, a couple of
 * slow components, and occasional spike-and-wave bursts of the kind that show up
 * in cortical recordings. Suppression scales the whole thing down, which is what
 * silencing presynaptic release looks like from a distance.
 */

const RATE = 120        // simulated samples per second
const SECONDS = 40      // ring buffer length

export class Signal {
  constructor () {
    this.rate = RATE
    this.buffer = new Float32Array(RATE * SECONDS)
    this.head = 0
    this.time = 0

    this.burstAt = -99
    this.nextBurst = 2.2
    this.burstAmplitude = 0

    /** 0 at rest, 1 when release is fully suppressed. */
    this.suppression = 0
  }

  /** 1 at rest, approaching 0 as suppression takes hold. */
  get activity () {
    return 1 - this.suppression * 0.93
  }

  /** Advance the simulation. `suppression` comes from the stim control. */
  push (dt, suppression = 0) {
    this.suppression = suppression
    const steps = Math.max(1, Math.round(dt * this.rate))
    const scale = this.activity

    for (let i = 0; i < steps; i++) {
      this.time += 1 / this.rate

      // Bursts stop arriving once the terminal is quiet.
      if (this.time > this.nextBurst && suppression < 0.4) {
        this.burstAt = this.time
        this.nextBurst = this.time + 1.7 + Math.random() * 2.6
      }

      let v =
        Math.sin(this.time * 6.1) * 0.16 +
        Math.sin(this.time * 11.7 + 1.3) * 0.1 +
        Math.sin(this.time * 2.3 + 0.4) * 0.13 +
        (Math.random() - 0.5) * 0.34

      const since = this.time - this.burstAt
      if (since >= 0 && since < 1.15) {
        const phase = (since * 3.1) % 1              // ~3 Hz complex
        const decay = Math.exp(-since * 1.2)
        v += Math.exp(-Math.pow((phase - 0.14) / 0.05, 2)) * 2.5 * decay
        v -= Math.max(0, Math.sin(((phase - 0.2) / 0.8) * Math.PI)) * 1.05 * decay
      }

      this.buffer[this.head % this.buffer.length] = v * scale
      this.head++
    }

    this.burstAmplitude = Math.max(0, 1 - (this.time - this.burstAt) * 2.2) * scale
  }

  /** Sample `back` steps behind the write head. */
  at (back) {
    const i = this.head - 1 - back
    return i < 0 ? 0 : this.buffer[i % this.buffer.length]
  }
}
