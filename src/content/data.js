/**
 * Single source of truth for everything the page says.
 *
 * Facts here come from Evyatar's CV (August 2025), PubMed, and modulight.bio.
 * Do not invent titles, dates, journals or mechanisms. If something is unknown,
 * leave it out rather than guessing.
 */

export const person = {
  name: 'Evyatar Swissa',
  role: 'Neuroscientist',
  places: 'Beer-Sheva · Ramat Gan · Israel',
  // The one-sentence thesis of the whole site.
  thesis: 'I spent a decade learning how the brain <em>breaks</em>. Now I build the light that <em>quiets</em> it.',
  affiliations: [
    { what: 'Director of In-vivo Research', where: 'Modulight Bio' },
    { what: 'Research Associate', where: 'Weizmann Institute' },
    { what: 'PhD', where: 'Ben-Gurion University' }
  ],
  email: 'swissev@gmail.com'
}

export const now = {
  heading: 'Turning a receptor into a <em>dimmer switch</em>',
  paragraphs: [
    'At Modulight Bio I direct in-vivo research on a precision optogenetic therapy. The platform uses <b>optoGPCRs</b>: light-activated G-protein coupled receptors delivered to the nerves that carry pain. Our workhorse is <b>eOPN3</b>, a rhodopsin borrowed from mosquitoes that recruits the Gi/o cascade and suppresses neurotransmitter release at the presynaptic terminal.',
    'It does not force a neuron to fire, and it does not clamp it silent. It turns down the volume of what that terminal releases, and then lets it come back on its own. The first indication we are taking toward clinical study is <em>trigeminal neuropathic pain</em>, where the nerve is reachable enough for light to do the work.'
  ],
  // Explains the interactive control without instructing the reader like a manual.
  note: 'The control in the corner is that mechanism, not a theme switch. Hold it and the model goes quiet. Let go and watch it recover on its own, the way a bistable opsin does.'
}

export const research = {
  heading: 'One interface, studied from <em>both sides</em>',
  intro: 'Every project I have worked on sits at the same junction: the membrane between blood and brain, and the neurons whose excitability depends on it.',
  entries: [
    {
      when: '2014 — 2020',
      title: 'Barrier failure as a predictor of epilepsy',
      where: 'Friedman lab · Ben-Gurion University',
      body: 'In organophosphate poisoning and status epilepticus, I followed what happens in the weeks after the seizures stop. Early blood-brain barrier pathology in the piriform network predicted which animals became epileptic months later, accurately enough to serve as a biomarker. Isoflurane and losartan, given early, prevented both the damage and the epilepsy.'
    },
    {
      when: '2020 — 2024',
      title: 'The healthy barrier responds to activity',
      where: 'PhD and postdoctoral work',
      body: 'Stimulating a limb for long enough opens the microvessels of the matching somatosensory cortex in a perfectly healthy brain, through caveolae-mediated transcytosis and TGF-β signalling. That opening tracks long-term synaptic plasticity. We saw it in rats with intravital imaging and electrophysiology, and again in people with barrier-mapping MRI.'
    },
    {
      when: '2022 — now',
      title: 'Light as a therapeutic',
      where: 'Modulight Bio · Weizmann Institute',
      live: true,
      body: 'Viral delivery, implant design, chronic behaviour, and the evidence package that carries an optogenetic therapy toward the clinic. I also write the computer vision that scores it: tracking a freely moving animal with a patch cord on its head, through the open field and the elevated plus maze, and turning hours of video into numbers I trust.'
    }
  ]
}

export const path = {
  heading: 'Chemistry, then brains, then <em>engineering</em>',
  entries: [
    { when: '2012 — 2016', title: 'Research assistant', where: 'Experimental Neurosurgery · Ben-Gurion University' },
    { when: '2016', title: 'BSc, Chemistry', where: 'Ben-Gurion University of the Negev' },
    { when: '2017', title: 'MSc, Brain and Cognitive Sciences', where: 'Ben-Gurion University of the Negev' },
    { when: '2019 — 2022', title: 'Teaching assistant', where: 'Recanati School for Community Health Professions' },
    { when: '2022', title: 'PhD, Brain and Cognitive Sciences', where: 'Blood-Brain Barrier lab · Prof. Alon Friedman' },
    { when: '2022 — now', title: 'Director of In-vivo Research', where: 'Modulight Bio · and Research Associate, Weizmann Institute', live: true }
  ]
}

/**
 * Reverse chronological. `lead` marks papers where Evyatar is first or joint-first
 * author; it is used only to decide which five surface by default, never rendered
 * as a badge. No counts, no "first author" labels: the work speaks without them.
 */
export const papers = [
  {
    year: 2026,
    title: 'Paroxysmal slow waves mark ictal networks',
    journal: 'Epilepsia',
    authors: 'Boyer-Aymé, Imtiaz, Prager, <b>Swissa</b> et al.',
    href: 'https://doi.org/10.1002/epi.70333'
  },
  {
    year: 2024,
    title: 'Cortical plasticity is associated with blood-brain barrier modulation',
    journal: 'eLife',
    authors: '<b>Swissa</b>, Monsonego, Yang et al.',
    href: 'https://doi.org/10.7554/eLife.89611',
    lead: true
  },
  {
    year: 2022,
    title: 'Craniotomy for acute monitoring of pial vessels in the rodent brain',
    journal: 'MethodsX',
    authors: 'Aboghazleh, Alkahmous, <b>Swissa</b> et al.',
    href: 'https://pubmed.ncbi.nlm.nih.gov/35478597/'
  },
  {
    year: 2021,
    title: 'PVP-coated Gd-grafted nanodiamonds as a potentially safer contrast agent for in vivo MRI',
    journal: 'Magnetic Resonance in Medicine',
    authors: 'Panich, Salti, Prager, <b>Swissa</b> et al.',
    href: 'https://pubmed.ncbi.nlm.nih.gov/33724543/'
  },
  {
    year: 2020,
    title: 'Midazolam and isoflurane combination reduces late brain damage in the paraoxon-induced status epilepticus rat model',
    journal: 'NeuroToxicology',
    authors: '<b>Swissa</b>, Bar-Klein, Serlin et al.',
    href: 'https://pubmed.ncbi.nlm.nih.gov/32084435/',
    lead: true
  },
  {
    year: 2020,
    title: 'TMS-induced controlled BBB opening: preclinical characterization and implications for treatment of brain cancer',
    journal: 'Pharmaceutics',
    authors: 'Vazana, Schori, Monsonego, <b>Swissa</b> et al.',
    href: 'https://pubmed.ncbi.nlm.nih.gov/33027965/'
  },
  {
    year: 2019,
    title: 'Blood-brain barrier dysfunction in status epilepticus: mechanisms and role in epileptogenesis',
    journal: 'Epilepsy and Behavior',
    authors: '<b>Swissa</b>, Serlin, Vazana, Prager, Friedman',
    href: 'https://pubmed.ncbi.nlm.nih.gov/31711869/',
    lead: true
  },
  {
    year: 2019,
    title: "Paroxysmal slow cortical activity in Alzheimer's disease and epilepsy is associated with blood-brain barrier dysfunction",
    journal: 'Science Translational Medicine',
    authors: 'Milikovsky, Ofer, Senatorov, … <b>Swissa</b> et al.',
    href: 'https://pubmed.ncbi.nlm.nih.gov/31801888/'
  },
  {
    year: 2017,
    title: 'Imaging blood-brain barrier dysfunction as a biomarker for epileptogenesis',
    journal: 'Brain',
    authors: 'Bar-Klein, Lublinsky, Kamintsky, … <b>Swissa</b> et al.',
    href: 'https://pubmed.ncbi.nlm.nih.gov/28444141/'
  },
  {
    year: 2014,
    title: 'sec-Butyl-propylacetamide and two of its stereoisomers rapidly terminate paraoxon-induced status epilepticus in rats',
    journal: 'Epilepsia',
    authors: 'Bar-Klein, <b>Swissa</b> et al.',
    note: 'equal contribution',
    href: 'https://pubmed.ncbi.nlm.nih.gov/25377630/',
    lead: true
  }
]

/** How many papers show before the reader asks for more. */
export const papersVisible = 5

/**
 * Side projects. These are hobbies and stay visually quiet: one line each,
 * no screenshots, no cards, no metrics.
 */
export const projects = [
  { kind: 'Game', label: 'Brainrot Crush', href: 'https://brainrot-crush.vercel.app' },
  { kind: 'Tool', label: 'מחשבון קלוריות', href: 'https://calorie-calculator-heb.vercel.app', after: ', a Hebrew carb counter' },
  { kind: 'Script', label: 'Guitar tabs to printable PDF', href: 'https://github.com/swissclock/SongsterrScraper' },
  { kind: 'Macro', label: 'Olympus slide scans to PNG', href: 'https://github.com/swissclock/VSI-to-PNG' }
]

export const contact = {
  heading: 'Get in touch',
  body: 'Open to collaboration on neurovascular biology, optogenetic therapeutics, and behavioural pipelines that have to be trusted by a regulator.',
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
  year: new Date().getFullYear()
}
