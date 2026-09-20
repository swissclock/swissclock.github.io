/**
 * The single source of activity for the whole page.
 *
 * Both the point model and the rules drawn between sections read from this one
 * object, so they cannot drift apart: there is nothing to synchronise.
 *
 * The waveform is meant to read as a plausible cortical recording rather than
 * as decoration: a band-limited background with a slow baseline wander and a
 * low-amplitude alpha rhythm, interrupted every few seconds by a run of
 * spike-and-wave complexes near 3 Hz. Suppression scales the whole thing down
 * and stops new runs arriving, which is what silencing presynaptic release
 * looks like from a distance.
 *
 * Cost per sample is a handful of multiplies plus two sines; at 120 samples a
 * second that is a rounding error next to the render.
 */

const RATE = 120        // simulated samples per second
const SECONDS = 90      // ring buffer length, long enough for five distinct windows
const TAU = Math.PI * 2

/* Background rhythms. Frequencies are held as per-sample phase increments so
   nothing depends on absolute elapsed time, which drifts in precision. */
const ALPHA_STEP = (TAU * 9.4) / RATE
const DELTA_STEP = (TAU * 2.3) / RATE
const MOD_STEP = (TAU * 0.11) / RATE   // slowly waxes and wanes the alpha

/* Spike-and-wave runs. Onset near 3.4 Hz, slowing as the run goes on, which is
   what a real 3 Hz complex does. */
const BURST_SLOWING = 0.22   // Hz lost per second within a run
const SPIKE_WIDTH = 0.005    // gaussian denominator, in cycles squared
const FLASH_DECAY = 4.5      // per second, how fast the model's flash falls off

/** Triangular white noise: two cheap randoms, gentler tails than a flat one. */
function white () {
  return Math.random() + Math.random() - 1
}

export class Signal {
  constructor () {
    this.buffer = new Float32Array(RATE * SECONDS)
    this.head = 0
    this.time = 0
    this.carry = 0

    this.drift = 0
    this.band = 0
    this.alphaPhase = Math.random() * TAU
    this.deltaPhase = Math.random() * TAU
    this.modPhase = Math.random() * TAU

    this.inBurst = false
    this.burstAt = -99
    this.burstLength = 0
    this.burstHz = 3.4
    this.burstPhase = 0
    this.nextBurst = 2.2
    this.flash = 0

    /** 0..1, momentary, peaks on each spike of a run. Read by the model. */
    this.burstAmplitude = 0
    /** 0 at rest, 1 when release is fully suppressed. */
    this.suppression = 0

    // Fill the ring before anything is drawn, so the first frame already shows
    // a recording in progress instead of a flat line scrolling in from the left.
    this.advance(this.buffer.length)
  }

  /** Number of samples that can be read back through `at`. */
  get capacity () {
    return this.buffer.length
  }

  /** 1 at rest, approaching 0 as suppression takes hold. */
  get activity () {
    return 1 - this.suppression * 0.93
  }

  /** Advance the simulation. `suppression` comes from the stim control. */
  push (dt, suppression = 0) {
    this.suppression = suppression
    // Carry the fractional sample rather than rounding it away. Rounding made
    // the simulated rate follow the display's — 144 samples a second on a
    // 144 Hz laptop — so the 9.4 Hz alpha and the 3.4 Hz complexes the code
    // documents were whatever the monitor happened to be.
    this.carry += dt * RATE
    let steps = Math.floor(this.carry)
    this.carry -= steps
    // A backgrounded tab returns with a large dt; never try to catch up more
    // than a second of signal in one frame.
    if (steps > RATE) {
      steps = RATE
      this.carry = 0
    }
    // A frame too short to earn a sample writes none, and burstAmplitude
    // stands at what the last one left.
    if (steps > 0) this.advance(steps)
  }

  /** Write `steps` samples at the current suppression. */
  advance (steps) {
    const buffer = this.buffer
    const length = buffer.length
    const scale = this.activity
    const quiet = this.suppression > 0.35
    const step = 1 / RATE

    for (let i = 0; i < steps; i++) {
      this.time += step

      this.drift = this.drift * 0.9988 + white() * 0.012
      this.band = this.band * 0.87 + white() * 0.27

      this.alphaPhase += ALPHA_STEP
      this.deltaPhase += DELTA_STEP
      this.modPhase += MOD_STEP
      if (this.alphaPhase > TAU) this.alphaPhase -= TAU
      if (this.deltaPhase > TAU) this.deltaPhase -= TAU
      if (this.modPhase > TAU) this.modPhase -= TAU

      const alphaGain = 0.055 + 0.045 * Math.sin(this.modPhase)
      let v =
        this.band +
        this.drift +
        Math.sin(this.alphaPhase) * alphaGain +
        Math.sin(this.deltaPhase) * 0.09

      // Runs only start while the terminal is still releasing transmitter.
      if (!this.inBurst && !quiet && this.time > this.nextBurst) {
        this.inBurst = true
        this.burstAt = this.time
        this.burstLength = 1.1 + Math.random() * 1.6
        this.burstHz = 3.4 + Math.random() * 0.3
        this.burstPhase = 0
      }

      let impulse = 0
      if (this.inBurst) {
        const since = this.time - this.burstAt
        this.burstHz -= BURST_SLOWING * step
        this.burstPhase += this.burstHz * step

        const phase = this.burstPhase % 1
        const envelope =
          Math.min(1, since / 0.18) * Math.min(1, (this.burstLength - since) / 0.45)
        const offset = phase - 0.08
        const spike = Math.exp(-(offset * offset) / SPIKE_WIDTH)
        // The slow negative wave that follows each spike, and names the complex.
        const wave = Math.sin(Math.min(1, Math.max(0, phase - 0.16) / 0.74) * Math.PI)

        impulse = envelope * spike
        v += envelope * (spike * 2.3 - wave * 0.95)

        if (since >= this.burstLength) {
          this.inBurst = false
          this.nextBurst = this.time + 2.4 + Math.random() * 3.4
        }
      } else if (quiet) {
        // Hold the next run just out of reach so suppression does not bank one
        // up and fire it the instant the light goes off.
        this.nextBurst = this.time + 1.2
      }

      // The model flashes with each spike rather than once per run, so its
      // flicker and the trace are visibly the same event.
      this.flash = Math.max(this.flash - FLASH_DECAY * step, impulse)

      buffer[this.head % length] = v * scale
      this.head++
    }

    this.burstAmplitude = this.flash * scale
  }

  /** Sample `back` steps behind the write head. */
  at (back) {
    const length = this.buffer.length
    // Beyond the ring the modulo would silently return a future sample, so the
    // oldest readable one is the honest answer.
    const clamped = back < 0 ? 0 : back > length - 1 ? length - 1 : back
    const i = this.head - 1 - clamped
    return i < 0 ? 0 : this.buffer[i % length]
  }
}
