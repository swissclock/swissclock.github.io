/**
 * Renders the content from data.js into static HTML at build time (and in dev,
 * through the same Vite plugin) so the page has real text before any JavaScript
 * runs. Nothing in here may touch browser APIs: it executes in Node.
 *
 * Strings in data.js are trusted authored content and may contain <em>/<b>.
 */

import * as C from './data.js'

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const n2 = (i) => String(i + 1).padStart(2, '0')

function nav () {
  return C.sections
    .map((s, i) => `<a href="#${s.id}"${i === 0 ? ' class="on"' : ''}><em>${n2(i)}</em>${esc(s.label)}</a>`)
    .join('')
}

function lede () {
  const aff = C.person.affiliations
    .map((a) => `${esc(a.what)}, <b>${esc(a.where)}</b>`)
    .join(' · ')
  return `
    <div class="col">
      <span class="tag">${esc(C.person.places)}</span>
      <h1><span>Evyatar</span><span class="b">Swissa</span></h1>
      <p class="lede-p">${C.person.thesis}</p>
      <p class="sub">${aff}</p>
    </div>`
}

function now () {
  return `
    <div class="col">
      <span class="tag">02 — Now</span>
      <h2>${C.now.heading}</h2>
      ${C.now.paragraphs.map((p) => `<p class="body">${p}</p>`).join('\n      ')}
      <p class="note">${C.now.note}</p>
    </div>`
}

function entry (e) {
  const body = e.body ? `<p>${e.body}</p>` : ''
  return `
        <div class="entry${e.live ? ' live' : ''}">
          <div class="when">${esc(e.when)}</div>
          <div>
            <h3>${esc(e.title)}</h3>
            <div class="where">${esc(e.where)}</div>
            ${body}
          </div>
        </div>`
}

function research () {
  return `
    <div class="col">
      <span class="tag">03 — Research</span>
      <h2>${C.research.heading}</h2>
      <p class="body">${C.research.intro}</p>
      <div class="entries">${C.research.entries.map(entry).join('')}
      </div>
    </div>`
}

function path () {
  return `
    <div class="col">
      <span class="tag">04 — Path</span>
      <h2>${C.path.heading}</h2>
      <div class="entries">${C.path.entries.map(entry).join('')}
      </div>
    </div>`
}

function paper (p, i) {
  const hidden = i >= C.papersVisible ? ' hidden' : ''
  const note = p.note ? ` · ${esc(p.note)}` : ''
  return `
        <a class="pub" href="${esc(p.href)}" target="_blank" rel="noopener"${hidden}>
          <span class="yr">${p.year}</span>
          <span>
            <span class="t">${esc(p.title)}</span>
            <span class="j">${esc(p.journal)} · ${p.authors}${note}</span>
          </span>
        </a>`
}

function projectLine (p) {
  return `<li><span>${esc(p.kind)}</span><span><a href="${esc(p.href)}" target="_blank" rel="noopener">${esc(p.label)}</a>${p.after ? esc(p.after) : ''}</span></li>`
}

function papers () {
  const rest = C.papers.length - C.papersVisible
  return `
    <div class="col">
      <span class="tag">05 — Papers</span>
      <h2>Written down</h2>
      <div class="pubs" id="pubs">${C.papers.map(paper).join('')}
      </div>
      <button class="more" id="more-papers" aria-expanded="false" aria-controls="pubs">Show ${rest} earlier papers</button>
      <div class="aside">
        <span class="tag tag-flush">Also, for fun</span>
        <ul>${C.projects.map(projectLine).join('')}</ul>
      </div>
    </div>`
}

function contact () {
  return `
    <div class="col">
      <span class="tag">06 — Contact</span>
      <h2>${esc(C.contact.heading)}</h2>
      <p class="body">${esc(C.contact.body)}</p>
      <div class="links">${C.contact.links
        .map((l) => `<a href="${esc(l.href)}"${l.href.startsWith('http') ? ' target="_blank" rel="noopener"' : ''}>${esc(l.label)}</a>`)
        .join('')}</div>
    </div>`
}

const BODIES = { lede, now, research, path, papers, contact }

/** Sections, with a live-signal rule between each pair. */
function allSections () {
  return C.sections
    .map((s, i) => {
      const body = BODIES[s.id]()
      const rule = i < C.sections.length - 1
        ? `\n<canvas class="sig${i === 0 ? ' tall' : ''}" data-window="${i}" aria-hidden="true"></canvas>`
        : ''
      return `<section id="${s.id}">${body}\n  </section>${rule}`
    })
    .join('\n')
}

function footer () {
  return `<span>${esc(C.person.name)}</span><span>${esc(C.credits.geometry)}</span><span>© ${C.credits.year}</span>`
}

/** Replaces <!--@name--> markers in index.html. */
export const slots = {
  nav,
  sections: allSections,
  footer,
  title: () => `${C.person.name} — ${C.person.role}`,
  description: () =>
    'Evyatar Swissa, neuroscientist. Director of In-vivo Research at Modulight Bio, working on optogenetic therapy, and formerly on the blood-brain barrier in epilepsy and plasticity.'
}

export function fillSlots (html) {
  return html.replace(/<!--@([a-z]+)-->/g, (match, key) =>
    Object.prototype.hasOwnProperty.call(slots, key) ? slots[key]() : match
  )
}
