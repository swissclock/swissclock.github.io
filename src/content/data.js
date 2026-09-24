/**
 * Single source of truth for everything the page says.
 *
 * Facts here come from Evyatar's CV (August 2025), PubMed, and modulight.bio.
 * Do not invent titles, dates, journals or mechanisms. If something is unknown,
 * leave it out rather than guessing.
 *
 * Prose may contain <em> and <b> and is interpolated as authored; every other
 * field is escaped by render.js. Spelling is British throughout.
 */

export const person = {
  name: 'Evyatar Swissa',
  role: 'Neuroscientist',
  location: 'Israel',
  // The one-sentence thesis of the whole site.
  thesis: 'I spent a decade learning how the brain <em>breaks</em>. Now I help build a platform to <em>fix</em> it.',
  affiliations: [
    { what: 'Director of In-vivo Research', where: 'Modulight Bio' },
    { what: 'Research Associate', where: 'Weizmann Institute' },
    { what: 'PhD', where: 'Ben-Gurion University' }
  ],
  email: 'swissev@gmail.com'
}

/** Written for a search result and a link preview, so it stands without the page. */
export const meta = {
  description:
    'Director of In-vivo Research at Modulight Bio, building an optogenetic therapy for trigeminal neuropathic pain. Ten years on the blood-brain barrier first.'
}

export const now = {
  heading: 'Turning a receptor into a <em>dimmer switch</em>',
  paragraphs: [
    'At <a href="https://modulight.bio" target="_blank" rel="noopener">Modulight Bio</a> I direct in-vivo research on an optogenetic therapy. The platform uses <b>optoGPCRs</b>: light-activated G protein-coupled receptors delivered to the nerves that carry pain. Our workhorse is <b>eOPN3</b>, a rhodopsin borrowed from mosquitoes that recruits the Gi/o cascade and suppresses neurotransmitter release at the presynaptic terminal.',
    'It does not force a neuron to fire, and it does not clamp it silent. It turns down what that terminal releases, and then lets it come back on its own. The first indication we are taking towards the clinic is <em>trigeminal neuropathic pain</em>, where the nerve is reachable enough for light to do the work.'
  ],
  // Explains the interactive control without instructing the reader like a manual.
  note: 'The control in the corner is that mechanism, not a toggle. Hold it and the model goes quiet. Release it and the suppression decays on its own, the way a bistable opsin does.'
}

export const research = {
  heading: 'Why it <em>breaks</em>, what fixes it, and how a fix <em>reaches a patient</em>',
  intro: 'One interface asked about three ways: the barrier between blood and brain, and the neurons whose excitability depends on it.',
  entries: [
    {
      from: '2014',
      to: '2018',
      title: 'Why it breaks',
      where: 'Friedman lab · Ben-Gurion University',
      // The prevention result is the pharmacodynamic arm of the Brain 2017
      // biomarker study (PMID 28444141): "Early treatments with either isoflurane
      // anaesthesia or losartan prevented early microvascular damage and late
      // epilepsy." Kept general on purpose; the papers carry the detail.
      body: 'Animal models of epilepsy and status epilepticus, following what happens in the weeks after the seizures stop. Blood-brain barrier pathology in the right place predicted which animals would become epileptic months later, accurately enough to serve as a biomarker. Treating early prevented the damage and the epilepsy alike.'
    },
    {
      from: '2018',
      to: '2022',
      title: 'What it does when nothing is wrong',
      where: 'PhD · Ben-Gurion University',
      body: 'The same barrier, asked about in a brain that is not injured. Sustained sensory activity opens the microvessels of the cortex that receives it, and that opening travels with long-term synaptic plasticity. We saw it in rats, then in people.'
    },
    {
      from: '2022',
      to: 'now',
      title: 'Getting a fix to a patient',
      where: 'Modulight Bio · Weizmann Institute',
      live: true,
      body: 'An optogenetic therapy taken from a construct towards the clinic: delivery, implant design, chronic behavioural testing, and the preclinical evidence a regulator will read.'
    }
  ]
}

export const path = {
  heading: 'The <em>short</em> version',
  entries: [
    { from: '2012', to: '2016', title: 'BSc, Chemistry', where: 'Ben-Gurion University of the Negev' },
    { from: '2012', to: '2016', title: 'Research assistant', where: 'Experimental Neurosurgery · Ben-Gurion University' },
    { from: '2016', to: '2018', title: 'MSc, Brain and Cognitive Sciences', where: 'Ben-Gurion University of the Negev' },
    { from: '2018', to: '2022', title: 'PhD, Brain and Cognitive Sciences', where: 'Blood-Brain Barrier lab · Prof. Alon Friedman' },
    { from: '2022', to: 'now', title: 'Director of In-vivo Research', where: 'Modulight Bio', live: true },
    { from: '2022', to: 'now', title: 'Research Associate', where: 'Weizmann Institute', live: true }
  ]
}

/**
 * Reverse chronological, and rendered in that order. The collapsed view is the
 * first `papersVisible` of this list and nothing else: no author flags, no
 * counts, no ranking. Any rule that chose which papers stand would be a
 * first-author badge with the label taken off.
 *
 * Titles are the published ones verbatim, checked against PubMed, except that
 * 2019's Epilepsy & Behavior review is given as "status epilepticus" where the
 * indexed record reads "status epileptics".
 */
export const papers = [
  {
    year: 2026,
    title: 'Paroxysmal slow waves mark ictal networks',
    journal: 'Epilepsia',
    authors: 'Boyer-Aymé, Imtiaz, Prager, <b>Swissa</b> et al.',
    href: 'https://doi.org/10.1002/epi.70333'
  },
  {
    year: 2024,
    title: 'Cortical plasticity is associated with blood-brain barrier modulation',
    journal: 'eLife',
    authors: '<b>Swissa</b>, Monsonego, Yang et al.',
    href: 'https://doi.org/10.7554/eLife.89611'
  },
  {
    year: 2022,
    title: 'Craniotomy for acute monitoring of pial vessels in the rodent brain',
    journal: 'MethodsX',
    authors: 'Aboghazleh, Alkahmous, <b>Swissa</b> et al.',
    href: 'https://pubmed.ncbi.nlm.nih.gov/35478597/'
  },
  {
    year: 2021,
    title: 'PVP-coated Gd-grafted nanodiamonds as a novel and potentially safer contrast agent for in vivo MRI',
    journal: 'Magnetic Resonance in Medicine',
    authors: 'Panich, Salti, Prager, <b>Swissa</b> et al.',
    href: 'https://pubmed.ncbi.nlm.nih.gov/33724543/'
  },
  {
    year: 2020,
    title: 'Midazolam and isoflurane combination reduces late brain damage in the paraoxon-induced status epilepticus rat model',
    journal: 'NeuroToxicology',
    authors: '<b>Swissa</b>, Bar-Klein, Serlin et al.',
    href: 'https://pubmed.ncbi.nlm.nih.gov/32084435/'
  },
  {
    year: 2020,
    title: 'TMS-induced controlled BBB opening: preclinical characterization and implications for treatment of brain cancer',
    journal: 'Pharmaceutics',
    authors: 'Vazana, Schori, Monsonego, <b>Swissa</b> et al.',
    href: 'https://pubmed.ncbi.nlm.nih.gov/33027965/'
  },
  {
    year: 2019,
    title: 'Blood-brain barrier dysfunction in status epilepticus: mechanisms and role in epileptogenesis',
    journal: 'Epilepsy & Behavior',
    authors: '<b>Swissa</b>, Serlin, Vazana, Prager, Friedman',
    href: 'https://pubmed.ncbi.nlm.nih.gov/31711869/'
  },
  {
    year: 2019,
    title: "Paroxysmal slow cortical activity in Alzheimer's disease and epilepsy is associated with blood-brain barrier dysfunction",
    journal: 'Science Translational Medicine',
    authors: 'Milikovsky, Ofer, Senatorov, … <b>Swissa</b> et al.',
    href: 'https://pubmed.ncbi.nlm.nih.gov/31801888/'
  },
  {
    year: 2017,
    title: 'Imaging blood-brain barrier dysfunction as a biomarker for epileptogenesis',
    journal: 'Brain',
    authors: 'Bar-Klein, Lublinsky, Kamintsky, … <b>Swissa</b> et al.',
    href: 'https://pubmed.ncbi.nlm.nih.gov/28444141/'
  },
  {
    year: 2014,
    title: 'sec-Butyl-propylacetamide (SPD) and two of its stereoisomers rapidly terminate paraoxon-induced status epilepticus in rats',
    journal: 'Epilepsia',
    authors: 'Bar-Klein, <b>Swissa</b> et al.',
    href: 'https://pubmed.ncbi.nlm.nih.gov/25377630/'
  }
]

/** How many papers stand before the reader asks for the rest. */
export const papersVisible = 5

/**
 * Side projects. These are hobbies and stay visually quiet: one line each,
 * no screenshots, no cards, no metrics.
 */
export const projects = [
  { kind: 'Model', label: 'NextPredictor', href: 'https://nextpredictor.vercel.app', after: ', football match probabilities, logged before kickoff' },
  { kind: 'Game', label: 'Brainrot Crush', href: 'https://brainrot-crush.vercel.app' },
  { kind: 'Tool', label: 'מחשבון קלוריות', lang: 'he', dir: 'rtl', href: 'https://calorie-calculator-heb.vercel.app', after: ', a Hebrew calorie and carb counter' },
  { kind: 'Script', label: 'Guitar tabs to printable PDF', href: 'https://github.com/swissclock/SongsterrScraper' },
  { kind: 'Macro', label: 'Olympus slide scans to PNG', href: 'https://github.com/swissclock/VSI-to-PNG' }
]

export const contact = {
  heading: 'Get in touch',
  body: 'Open to collaboration on neurovascular biology, optogenetic therapeutics, and behavioural pipelines that a regulator has to trust.',
  links: [
    { label: 'Email', href: `mailto:${person.email}` },
    { label: 'LinkedIn', href: 'https://www.linkedin.com/in/evyatar-swissa-458283240' },
    { label: 'GitHub', href: 'https://github.com/swissclock' },
    { label: 'PubMed', href: 'https://pubmed.ncbi.nlm.nih.gov/?term=Swissa+E%5BAuthor%5D' }
  ]
}

export const sections = [
  { id: 'lede', label: 'Opening' },
  { id: 'now', label: 'Now' },
  { id: 'research', label: 'Research' },
  { id: 'path', label: 'Path' },
  { id: 'papers', label: 'Papers' },
  { id: 'contact', label: 'Contact' }
]

export const credits = {
  geometry: 'Geometry: Allen Mouse Brain Common Coordinate Framework v3',
  // Authored, not computed. The page is static and is rebuilt only when its
  // content changes, so a date read at build time would freeze at whatever year
  // the last content edit happened to fall in and then quietly go stale.
  year: 2026
}
