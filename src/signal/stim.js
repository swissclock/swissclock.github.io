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
 *
 * Everything below the event wiring is about one promise: the control can be
 * driven by a mouse, a finger, the keyboard or assistive technology, and under
 * none of them may it be left stuck on. Every way a press can start has a way it
 * is guaranteed to end, including the ones the page never hears about directly
 * (pointer released off-window, tab hidden, window blurred).
 */

const RISE = 4.2          // per second while illuminated
const DECAY_BASE = 0.052  // per second once the light is off
const DECAY_GAIN = 0.055  // extra decay proportional to remaining suppression

const MIN_PULSE = 0.14    // seconds; a tap too quick to see still delivers light
const CLICK_PULSE = 0.5   // seconds; a single activation with no press to hold
const RUNAWAY = 60        // seconds; last-resort net if a release never arrives
const LONG_PRESS = 220    // ms a finger must rest on the model before it is a hold
const DRIFT = 10          // px it may wander meanwhile and still be one

const EDITABLE = /^(input|textarea|select)$/i
/** Roles for which Space is already an activation, and so is not ours to take. */
const ACTIVATES_ON_SPACE =
  'button, summary, [role="button"], [role="checkbox"], [role="radio"], [role="switch"], [role="menuitemcheckbox"], [role="menuitemradio"], [role="option"], [role="tab"]'

/** True while the reader is typing, so Space belongs to them and not to us. */
function typing (node) {
  return !!node && (node.isContentEditable || EDITABLE.test(node.tagName || ''))
}

/**
 * True when Space would already do something where focus is. Taking it there
 * would leave a native control that looks operable and silently is not.
 */
function spoken (node) {
  return !!node?.closest?.(ACTIVATES_ON_SPACE)
}

export class Stim extends EventTarget {
  constructor ({ button, hint, canvas } = {}) {
    super()
    this.value = 0
    this.held = false
    this.usedOnce = false
    this.button = button
    this.hint = hint

    this.source = null        // 'pointer' | 'key' | 'pulse'
    this.pointerId = null
    this.capturing = null
    this.heldFor = 0
    this.floor = 0            // shortest hold this press is allowed to be
    this.releasing = false    // release arrived, waiting out the minimum
    this.lastState = this.state
    this.lastInput = -Infinity
    /** True when the last input came from this control, so the click that
        follows it is the browser's own echo and not a stand-alone activation. */
    this.echo = false

    const down = (event, element) => {
      // Secondary buttons and extra fingers are not a second light source, but
      // a tap arriving while the previous one is still finishing is.
      if (event.button > 0 || event.isPrimary === false) return
      if (this.held && !this.releasing) return
      this.lastInput = event.timeStamp
      this.echo = element === button

      // On the control itself the gesture is ours outright. On the model a
      // touch may turn into a scroll, so leave the browser its chance: it will
      // send pointercancel and the hold ends there.
      if (element === button || event.pointerType === 'mouse') event.preventDefault()

      this.begin('pointer', MIN_PULSE)

      // Claim the pointer only once this press owns the hold. A press arriving
      // while another source holds the light is refused by begin(), and
      // recording its id here would leave stop() releasing a capture that a
      // different gesture is still using.
      if (this.source === 'pointer') {
        this.pointerId = event.pointerId
        try {
          element.setPointerCapture?.(event.pointerId)
          this.capturing = element
        } catch {
          // Capture is a convenience; the window listeners below still fire.
          this.capturing = null
        }
      }
      // preventDefault above suppresses the focus a click would have given, and
      // the control has to be focusable by the reader who is already on it.
      if (element === button) button.focus?.({ preventScroll: true })
    }

    const up = (event) => {
      if (this.source !== 'pointer') return
      if (this.pointerId !== null && event.pointerId !== this.pointerId) return
      this.lastInput = event.timeStamp
      this.end()
    }

    // A touch screen captures the finger to whatever lies under it, which on
    // the control is one of its labels. Taking the capture for the button
    // makes that label lose it, and lostpointercapture bubbles: heard here, it
    // ended every hold on an iPhone the moment it began. Only the element this
    // press actually captured can lose it.
    const lost = (event) => {
      if (event.target !== this.capturing) return
      up(event)
    }

    if (button) {
      button.addEventListener('pointerdown', (e) => down(e, button))
      button.addEventListener('lostpointercapture', lost)
      // A long press on the control is the interaction, not a request for a menu.
      button.addEventListener('contextmenu', (e) => e.preventDefault())

      button.addEventListener('keydown', (e) => {
        if (e.key !== ' ' && e.key !== 'Enter') return
        if (e.ctrlKey || e.metaKey || e.altKey) return
        e.preventDefault()          // no page scroll, no repeated synthetic clicks
        this.lastInput = e.timeStamp
        this.echo = true
        if (!e.repeat) this.begin('key', MIN_PULSE)
      })
      button.addEventListener('keyup', (e) => {
        if (e.key !== ' ' && e.key !== 'Enter') return
        this.lastInput = e.timeStamp
        this.echo = true
        if (this.source === 'key') this.end()
      })

      // Assistive technology and Enter both activate by click. If that click
      // echoes a press on this control we already handled it; if it stands
      // alone it is the only signal we will get, so it becomes a brief pulse.
      // The test is where the last input came from, not merely how long ago:
      // a bare activation has no press of its own behind it, and timing alone
      // would swallow one that happened to follow an unrelated keystroke.
      button.addEventListener('click', (e) => {
        if (this.echo && e.timeStamp - this.lastInput < 900) return
        if (this.held && !this.releasing) return
        this.begin('pulse', CLICK_PULSE)
        this.end()
      })
    }

    // On the model a finger is as likely to be starting a scroll as a hold,
    // and a scroll would otherwise flash the light every time it began there.
    // So a touch only becomes a hold once it has stayed put for a moment.
    let waiting = null
    const settle = () => {
      if (!waiting) return
      clearTimeout(waiting.timer)
      waiting = null
    }
    const press = (event) => {
      if (event.pointerType !== 'touch') return down(event, canvas)
      if (event.isPrimary === false) return
      settle()
      waiting = {
        id: event.pointerId,
        x: event.clientX,
        y: event.clientY,
        timer: setTimeout(() => { waiting = null; down(event, canvas) }, LONG_PRESS)
      }
    }

    if (canvas) {
      canvas.addEventListener('pointerdown', press)
      canvas.addEventListener('lostpointercapture', lost)
      canvas.addEventListener('pointermove', (e) => {
        if (waiting && e.pointerId === waiting.id && Math.hypot(e.clientX - waiting.x, e.clientY - waiting.y) > DRIFT) settle()
      })
      canvas.addEventListener('contextmenu', (e) => e.preventDefault())
    }
    addEventListener('pointerup', settle)
    addEventListener('pointercancel', settle)

    addEventListener('pointerup', up)
    addEventListener('pointercancel', up)

    // Space anywhere it is not already spoken for. A link having focus must not
    // swallow the site's one interaction, and the keyup is caught on the window
    // so it lands wherever focus has gone by then.
    addEventListener('keydown', (e) => {
      if (e.code !== 'Space' && e.key !== ' ') return
      if (e.ctrlKey || e.metaKey || e.altKey) return
      if (typing(e.target)) return
      // The control has its own listener above; everything else that Space
      // already operates keeps it, so "Show all papers" stays a real button.
      if (spoken(e.target)) return
      e.preventDefault()
      this.lastInput = e.timeStamp
      this.echo = false
      if (!e.repeat) this.begin('key', MIN_PULSE)
    })
    addEventListener('keyup', (e) => {
      if (e.code !== 'Space' && e.key !== ' ') return
      // No early return here, whatever has focus: this keyup is the guarantee
      // that a hold which began on the window always has an end.
      this.lastInput = e.timeStamp
      if (!spoken(e.target)) this.echo = false
      if (this.source === 'key') this.end()
    })

    // The ways a press can end without an event that names it.
    const drop = () => this.stop()
    addEventListener('blur', drop)
    addEventListener('pagehide', drop)
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.stop()
    })
  }

  /** Begin a hold. `floor` is the shortest it is allowed to last. */
  begin (source, floor) {
    if (this.held) {
      // A second tap landing inside the first one's minimum is a second pulse,
      // not a press to ignore: take back the pending release and keep the light on.
      if (this.releasing) {
        this.releasing = false
        this.source = source
        this.floor = floor
        this.heldFor = 0
      }
      return
    }
    this.held = true
    this.source = source
    this.floor = floor
    this.heldFor = 0
    this.releasing = false
    if (!this.usedOnce) {
      this.usedOnce = true
      this.hint?.classList.add('gone')
      // Faded out for the eye, and gone for the ear too: #stim-help already
      // carries the same instruction, wired through aria-describedby.
      this.hint?.setAttribute('aria-hidden', 'true')
    }
    this.sync()
  }

  /** Ask for the hold to end; a tap is stretched to its minimum first. */
  end () {
    if (!this.held) return
    if (this.heldFor < this.floor) {
      this.releasing = true
      return
    }
    this.stop()
  }

  /** End the hold now, whatever it was doing. */
  stop () {
    if (!this.held) return
    this.held = false
    this.source = null
    this.releasing = false
    this.heldFor = 0
    if (this.capturing && this.pointerId !== null) {
      try { this.capturing.releasePointerCapture?.(this.pointerId) } catch { /* already gone */ }
    }
    this.capturing = null
    this.pointerId = null
    this.sync()
  }

  get state () {
    if (this.held) return 'lit'
    return this.value > 0.02 ? 'recovering' : 'resting'
  }

  /** Percentage of transmitter release still available. */
  get release () {
    return Math.round((1 - this.value) * 100)
  }

  /** One place that announces the state, so no change is reported twice. */
  sync () {
    const state = this.state
    if (state === this.lastState) return
    this.lastState = state
    this.dispatchEvent(new CustomEvent('change', { detail: state }))
  }

  update (dt) {
    const step = dt > 0 ? dt : 0

    if (this.held) {
      this.heldFor += step
      if (this.releasing && this.heldFor >= this.floor) this.stop()
      else if (this.heldFor > RUNAWAY) this.stop()
    }

    if (this.held) {
      this.value = Math.min(1, this.value + step * RISE)
    } else {
      this.value = Math.max(0, this.value - step * (DECAY_BASE + this.value * DECAY_GAIN))
    }

    this.sync()
    return this.value
  }
}
