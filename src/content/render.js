/**
 * Renders the content from data.js into static HTML at build time (and in dev,
 * through the same Vite plugin) so the page has real text before any JavaScript
 * runs. Nothing in here may touch browser APIs: it executes in Node.
 *
 * Prose fields in data.js are trusted authored content and may carry <em>/<b>,
 * so they are interpolated as written. Everything else — every attribute value,
 * every label, every title — goes through esc().
 */

import * as C from './data.js'

/** Safe in text and inside a double- or single-quoted attribute. */
const esc = (s) => String(s)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;')

/** Authored prose reduced to plain escaped text, for accessible names. */
const plain = (s) => esc(String(s).replace(/<[^>]+>/g, ''))

const n2 = (i) => String(i + 1).padStart(2, '0')

const NEW_TAB = ' target="_blank" rel="noopener"'
const offsite = (href) => (/^https?:/i.test(href) ? NEW_TAB : '')

/** A bare year becomes machine-readable; anything else ("now") stays prose. */
const stamp = (v) => (/^\d{4}$/.test(v) ? `<time datetime="${esc(v)}">${esc(v)}</time>` : esc(v))
const span = (e) => (e.to ? `${stamp(e.from)} — ${stamp(e.to)}` : stamp(e.from))

/**
 * The section eyebrow and the section heading, both numbered from one source.
 * The ordinal is split out and hidden the same way the rail's is: it is a
 * typographic mark, and "zero two em dash" before every heading is not.
 */
const eyebrow = (i) => `<span class="tag"><em aria-hidden="true">${n2(i)} — </em>${esc(C.sections[i].label)}</span>`
const head = (i, html) => `<h2 id="${esc(C.sections[i].id)}-title">${html}</h2>`

/**
 * Structured data. The page's whole job in search is to be the answer to this
 * person's name, and that is an entity question rather than a keyword one:
 * `sameAs` is what lets a search engine merge this page with the LinkedIn and
 * GitHub accounts it already has, instead of treating all three as strangers.
 *
 * Every claim here is also stated in the visible page, which is the rule for
 * structured data: nothing asserted to a crawler that a reader cannot see.
 */
function jsonld () {
  const employer = C.path.entries.find((e) => e.live && e.where.startsWith('Modulight'))
  const graph = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Person',
        '@id': C.site.url + '#person',
        name: C.person.name,
        jobTitle: employer ? employer.title : C.person.role,
        description: C.meta.description,
        url: C.site.url,
        image: C.site.image,
        sameAs: C.site.sameAs,
        // The one identifier in the set that is a registry entry rather than an
        // account, which is what a scholarly index looks for.
        identifier: {
          '@type': 'PropertyValue',
          propertyID: 'ORCID',
          value: '0000-0002-6644-7230',
          url: 'https://orcid.org/0000-0002-6644-7230'
        },
        worksFor: {
          '@type': 'Organization',
          name: 'Modulight Bio',
          url: 'https://modulight.bio'
        },
        affiliation: [
          { '@type': 'Organization', name: 'Modulight Bio', url: 'https://modulight.bio' },
          { '@type': 'CollegeOrUniversity', name: 'Weizmann Institute of Science' }
        ],
        alumniOf: { '@type': 'CollegeOrUniversity', name: 'Ben-Gurion University of the Negev' },
        knowsAbout: [
          'Neuroscience', 'Optogenetics', 'Blood-brain barrier', 'Epilepsy',
          'Preclinical research', 'Trigeminal neuropathic pain'
        ]
      },
      {
        '@type': 'ProfilePage',
        '@id': C.site.url + '#page',
        url: C.site.url,
        name: `${C.person.name} — ${C.person.role}`,
        description: C.meta.description,
        inLanguage: 'en-GB',
        about: { '@id': C.site.url + '#person' },
        mainEntity: { '@id': C.site.url + '#person' }
      }
    ]
  }
  // </script> cannot appear inside the block, and JSON-LD is read as data, so
  // escaping the slash is the safe and standard way to keep the tag closed.
  return `<script type="application/ld+json">${JSON.stringify(graph).replace(/</g, '\\u003c')}</script>`
}

function who () {
  return `${esc(C.person.name)}<span>${esc(C.person.role)}</span><span>${esc(C.person.location)}</span>`
}

function nav () {
  return C.sections
    .map((s, i) => `<a href="#${esc(s.id)}"${i === 0 ? ' class="on" aria-current="true"' : ''}><em aria-hidden="true">${n2(i)}</em>${esc(s.label)}</a>`)
    .join('')
}

function lede () {
  const parts = C.person.name.split(' ')
  const family = parts.pop()
  const given = parts.join(' ')
  const aff = C.person.affiliations
    .map((a) => `${esc(a.what)}, <b>${esc(a.where)}</b>`)
    .join(' · ')
  return `
    <div class="col">
      <h1 id="lede-title"><span>${esc(given)}</span> <span class="b">${esc(family)}</span></h1>
      <p class="lede-p">${C.person.thesis}</p>
      <p class="sub">${aff}</p>
    </div>`
}

function now (i) {
  return `
    <div class="col">
      ${eyebrow(i)}
      ${head(i, C.now.heading)}
      ${C.now.paragraphs.map((p) => `<p class="body">${p}</p>`).join('\n      ')}
      <p class="note">${C.now.note}</p>
    </div>`
}

function entry (e) {
  const body = e.body ? `\n            <p>${e.body}</p>` : ''
  return `
        <li class="entry${e.live ? ' live' : ''}">
          <div class="when">${span(e)}</div>
          <div>
            <h3>${esc(e.title)}</h3>
            <div class="where">${esc(e.where)}</div>${body}
          </div>
        </li>`
}

function research (i) {
  return `
    <div class="col">
      ${eyebrow(i)}
      ${head(i, C.research.heading)}
      <p class="body">${C.research.intro}</p>
      <ul class="entries" role="list">${C.research.entries.map(entry).join('')}
      </ul>
    </div>`
}

function path (i) {
  return `
    <div class="col">
      ${eyebrow(i)}
      ${head(i, C.path.heading)}
      <ul class="entries" role="list">${C.path.entries.map(entry).join('')}
      </ul>
    </div>`
}

/** Where the link lands, named for a reader who hears only the link. */
const SOURCES = { 'doi.org': 'doi.org', 'pubmed.ncbi.nlm.nih.gov': 'PubMed' }
const source = (href) => {
  const host = new URL(href).hostname.replace(/^www\./, '')
  return SOURCES[host] || host
}

function paper (p, hidden) {
  // The visible row reads year / title / journal · authors; a screen reader gets
  // the same facts as one sentence, because the link may be met out of context.
  // The authors belong in it: author order is the first thing a peer scans for.
  // "et al." already ends in a stop, so the sentence must not add a second.
  const authors = plain(p.authors).replace(/\.?$/, '.')
  const label = `${plain(p.title)}. ${plain(p.journal)}, ${p.year}. ${authors} Full record on ${esc(source(p.href))}.`
  return `
        <li${hidden ? ' hidden data-rest' : ''}>
          <a class="pub" href="${esc(p.href)}"${NEW_TAB} aria-label="${label}">
            <time class="yr" datetime="${p.year}">${p.year}</time>
            <span>
              <span class="t">${esc(p.title)}</span>
              <span class="j">${esc(p.journal)} · ${p.authors}</span>
            </span>
          </a>
        </li>`
}

function projectLine (p) {
  const written = (p.lang ? ` lang="${esc(p.lang)}"` : '') + (p.dir ? ` dir="${esc(p.dir)}"` : '')
  const after = p.after ? esc(p.after) : ''
  return `<li><span>${esc(p.kind)}</span><span><a href="${esc(p.href)}"${NEW_TAB}${written}>${esc(p.label)}</a>${after}</span></li>`
}

function papers (i) {
  // The collapsed view is simply the newest papersVisible, so the button means
  // "earlier papers" and the standing list has no gap in it to misread.
  return `
    <div class="col">
      ${eyebrow(i)}
      ${head(i, 'Written down')}
      <ul class="pubs" id="pubs" role="list">${C.papers.map((p, j) => paper(p, j >= C.papersVisible)).join('')}
      </ul>
      <button class="more" id="more-papers" aria-expanded="false" aria-controls="pubs">Show all papers</button>
      <div class="aside">
        <h3 class="tag tag-flush">Also, for fun</h3>
        <ul role="list">${C.projects.map(projectLine).join('')}</ul>
      </div>
    </div>`
}

function contact (i) {
  const links = C.contact.links
    .map((l) => `<li><a href="${esc(l.href)}"${offsite(l.href)}>${esc(l.label)}</a></li>`)
    .join('')
  return `
    <div class="col">
      ${eyebrow(i)}
      ${head(i, esc(C.contact.heading))}
      <p class="body">${esc(C.contact.body)}</p>
      <ul class="links" role="list">${links}</ul>
    </div>`
}

const BODIES = { lede, now, research, path, papers, contact }

/** Sections, with a live-signal rule between each pair. */
function allSections () {
  return C.sections
    .map((s, i) => {
      const body = BODIES[s.id](i)
      const rule = i < C.sections.length - 1
        ? `\n<canvas class="sig${i === 0 ? ' tall' : ''}" data-window="${i}" aria-hidden="true"></canvas>`
        : ''
      return `<section id="${esc(s.id)}" aria-labelledby="${esc(s.id)}-title">${body}\n  </section>${rule}`
    })
    .join('\n')
}

function footer () {
  const year = C.credits.year
  return `<span>${esc(C.person.name)}</span><span>${esc(C.credits.geometry)}</span><span>© <time datetime="${esc(year)}">${esc(year)}</time></span>`
}

/** Replaces <!--@name--> markers in index.html. */
export const slots = {
  jsonld,
  who,
  nav,
  sections: allSections,
  footer,
  title: () => esc(`${C.person.name} — ${C.person.role}`),
  description: () => esc(C.meta.description)
}

export function fillSlots (html) {
  return html.replace(/<!--@([a-z]+)-->/g, (match, key) =>
    Object.prototype.hasOwnProperty.call(slots, key) ? slots[key]() : match
  )
}
