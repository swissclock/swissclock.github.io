/**
 * The side-projects framing. At rest the shell's dots become a loss landscape
 * (landscape.js), the general view of a section that is mostly numbers.
 * Pointing at a project with data behind it brings that project's own view up
 * out of it and lets the landscape sink to a trace underneath:
 *
 *   lotto     every number's tally against chance, as random walks (walks.js)
 *   football  the league played out 20,000 times, as a ridgeline (seasons.js)
 *
 * Every project's view is fitted to the same place on screen: as wide as the
 * landscape, standing on the last project in the list, and never rising past
 * the section's label. That leaves the caption its own room underneath.
 */

import { Group, Vector3 } from 'three'
import { approach, smooth } from './common.js'
import { createLandscape } from './landscape.js'
import { createWalks } from './walks.js'
import { createSeasons } from './seasons.js'

export async function loadFun (url) {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`${url}: ${response.status}`)
  return response.json()
}

/** The eight corners of a box. */
function corners (box) {
  const out = []
  for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) out.push(new Vector3(x, y, z))
  return out
}

/** The screen rectangle, in normalised device coordinates, that some points cover. */
function screenBox (points, project) {
  let x0 = Infinity; let x1 = -Infinity; let y0 = Infinity; let y1 = -Infinity
  for (const p of points) {
    const q = project(p)
    x0 = Math.min(x0, q.x); x1 = Math.max(x1, q.x); y0 = Math.min(y0, q.y); y1 = Math.max(y1, q.y)
  }
  return { x0, x1, y0, y1 }
}

export function createFun (data, parent, shared, shell, colours, { light = false } = {}) {
  const context = { shared, shell, colours, light }
  const group = new Group()
  parent.add(group)

  const landscape = createLandscape(context)
  const views = {
    lotto: createWalks(data.lotto, context),
    football: createSeasons(data.football.seasons, context)
  }
  group.add(landscape.group, ...Object.values(views).map((v) => v.group))

  const amounts = Object.fromEntries(Object.keys(views).map((k) => [k, 0]))
  let rest = 0
  let view = null

  return {
    /** Which project's data to show: 'lotto', 'football', or null for the landscape. */
    setView (name) {
      view = name in views ? name : null
    },

    /** What the current view is showing right now, for the caption. */
    get live () {
      return view ? views[view].live : ''
    },

    /**
     * Places every project view. `project` maps a point in this layer's frame
     * to the screen for the section's own framing; `top` and `bottom` are the
     * section label and the last project, in the same coordinates. Returns
     * where each project's view ended up on screen (the same box for all of
     * them), so the caption can sit right under it.
     */
    fit (project, { top, bottom, left, right }) {
      // The landscape keeps its size and only steps up or down to stand on
      // the last project, like everything else here.
      const floor = corners(landscape.bounds)
      landscape.group.position.set(0, 0, 0)
      // On a phone it is also brought inside the block's width, near edge
      // and all, rather than running off both sides.
      let size = 1
      if (left !== undefined) {
        for (let pass = 0; pass < 3; pass++) {
          const box = screenBox(floor.map((c) => c.clone().multiplyScalar(size)), project)
          size *= Math.min(1, (right - left) * 1.08 / (box.x1 - box.x0))
        }
      }
      landscape.group.scale.setScalar(size)
      for (const c of floor) c.multiplyScalar(size)
      const ground = screenBox(floor, project)
      const probe = new Vector3(0, landscape.bounds.min.y, landscape.bounds.max.z).multiplyScalar(size)
      const rise = project(probe.clone().add(new Vector3(0, 1, 0))).y - project(probe).y
      landscape.group.position.y = (bottom - ground.y0) / rise
      const lifted = screenBox(floor.map((c) => c.clone().add(landscape.group.position)), project)

      // Its near edge spreads wide in perspective, and its left end runs under
      // the reading column's veil: the views take the clear part of that width.
      // A phone has no veil and gives its own margins instead.
      const span = lifted.x1 - lifted.x0
      const reach = left === undefined
        ? { x0: lifted.x0 + span * 0.18, x1: Math.min(lifted.x1 - span * 0.04, 0.9) }
        : { x0: left, x1: right }
      // Every view fills the same box, so its caption lands in the same place
      // whichever project is pointed at. Width and height scale separately to
      // do it; the text labels are counter-scaled so they never stretch.
      const placedBoxes = {}
      for (const [key, v] of Object.entries(views)) {
        const g = v.group
        const local = corners(v.bounds)
        const placed = (sx, sy, t) => local.map((c) => new Vector3(c.x * sx, c.y * sy, c.z * sx).add(t))
        let sx = 1
        let sy = 1
        const t = new Vector3()
        // Scale and shift a few times over: perspective makes each step only
        // approximately right, and it converges well inside six.
        for (let pass = 0; pass < 6; pass++) {
          let box = screenBox(placed(sx, sy, t), project)
          sx *= (reach.x1 - reach.x0) / (box.x1 - box.x0)
          sy *= (top - bottom) / (box.y1 - box.y0)
          box = screenBox(placed(sx, sy, t), project)
          const centre = new Vector3(
            (v.bounds.min.x + v.bounds.max.x) / 2 * sx,
            (v.bounds.min.y + v.bounds.max.y) / 2 * sy,
            (v.bounds.min.z + v.bounds.max.z) / 2 * sx
          ).add(t)
          const a = project(centre)
          const dx = project(centre.clone().add(new Vector3(1, 0, 0))).x - a.x
          const dy = project(centre.clone().add(new Vector3(0, 1, 0))).y - a.y
          // Across the clear width, standing on the last project.
          t.x += (reach.x0 - box.x0) / dx
          t.y += (bottom - box.y0) / dy
        }
        g.scale.set(sx, sy, sx)
        g.position.copy(t)
        g.traverse((o) => {
          if (!o.isSprite) return
          o.userData.base ??= o.scale.clone()
          o.scale.set(o.userData.base.x * (sy / sx), o.userData.base.y, 1)
        })
        placedBoxes[key] = screenBox(placed(sx, sy, t), project)
      }
      return placedBoxes
    },

    update (dt, state, presence) {
      // The landscape stays as a quiet floor under a project's view.
      rest += ((view ? 0.14 : 1) - rest) * approach(2.4, dt)
      landscape.update(dt, state, presence, presence * rest, presence * smooth((rest - 0.14) / 0.86))
      for (const key of Object.keys(views)) {
        amounts[key] += ((key === view ? 1 : 0) - amounts[key]) * approach(2.6, dt)
        views[key].update(dt, state, smooth(amounts[key]) * presence)
      }
      group.visible = presence > 0.001
    }
  }
}

