/* ---------------------------------------------------------------------------
   Domain and host classification for peer discovery.

   Stage 02's filters live or die on three questions this module answers:

     - Is this host the subject wearing a different hat? (mirrors, resellers'
       storefronts, SEO shadow copies)
     - Is this a directory or aggregator page *about* a company rather than a
       company? (this is the bulk of what find-similar returns)
     - Are two candidates the same company?

   No dependencies, so the public-suffix handling is a curated list of the
   multi-label suffixes that actually turned up — enough to get
   `salamapharma.co.tz` and `example.co.uk` right without shipping a 10,000
   line table. Widen the list when a real run needs it.
--------------------------------------------------------------------------- */

/** Multi-label public suffixes, longest first. */
const MULTI_LABEL_SUFFIXES = [
  'co.uk', 'org.uk', 'ac.uk', 'gov.uk', 'co.nz', 'co.za', 'co.in', 'co.il', 'co.jp',
  'co.kr', 'co.tz', 'co.ke', 'co.th', 'co.id', 'com.au', 'com.br', 'com.mx', 'com.ar',
  'com.tr', 'com.cn', 'com.tw', 'com.hk', 'com.sg', 'com.my', 'com.ph', 'com.pk',
  'com.ng', 'com.eg', 'com.sa', 'com.co', 'com.pe', 'com.ua', 'com.pl', 'net.au',
  'org.au', 'gov.au', 'org.in', 'net.in', 'ac.in', 'gov.in', 'org.nz', 'net.nz',
];

/** Country-code TLDs we treat as a geography signal. */
const CC_TLDS = new Set([
  'tz','in','pk','ng','ke','bd','lk','id','ph','vn','cn','tw','hk','tr','eg','za','br',
  'mx','ar','ru','ua','pl','ro','gr','it','es','fr','de','nl','be','se','no','fi','dk',
  'ch','at','cz','pt','ie','il','sa','ae','jp','kr','th','my','sg','au','nz','uk','ca',
  'cl','pe','co','ve','ec','ma','dz','tn','gh','et','ug','zw','np','mm','kh','bg','hu',
]);

export function hostOf(url: string): string {
  try {
    return new URL(url).host.toLowerCase().replace(/^www\./, '');
  } catch {
    return '';
  }
}

/** eTLD+1, so `hpsrx.com` and `www.hpsrx.com` and `shop.hpsrx.com` collapse. */
export function registrableDomain(urlOrHost: string): string {
  const host = urlOrHost.includes('://') ? hostOf(urlOrHost) : urlOrHost.toLowerCase().replace(/^www\./, '');
  if (!host) return '';
  for (const suffix of MULTI_LABEL_SUFFIXES) {
    if (host.endsWith(`.${suffix}`)) {
      const head = host.slice(0, -(suffix.length + 1)).split('.');
      return `${head.at(-1)}.${suffix}`;
    }
  }
  const labels = host.split('.');
  return labels.length <= 2 ? host : labels.slice(-2).join('.');
}

/** The brand label: `hpsrx` from `hpsrx.com`. What a mirror host reuses. */
export function brandLabel(urlOrHost: string): string {
  return registrableDomain(urlOrHost).split('.')[0] ?? '';
}

export function tldOf(urlOrHost: string): string {
  return registrableDomain(urlOrHost).split('.').at(-1) ?? '';
}

/** True for a ccTLD outside the subject's geography — a cheap, hard signal. */
export function isForeignCcTld(urlOrHost: string, allowed: readonly string[] = ['us', 'ca']): boolean {
  const domain = registrableDomain(urlOrHost);
  const suffix = MULTI_LABEL_SUFFIXES.find((s) => domain.endsWith(`.${s}`));
  const tld = (suffix ? suffix.split('.').at(-1) : domain.split('.').at(-1)) ?? '';
  return CC_TLDS.has(tld) && !allowed.includes(tld);
}

/* -- aggregators and directories ---------------------------------------- */

/**
 * Hosts that publish pages *about* companies. Every one of these came out of a
 * real Exa find-similar run on hpsrx.com, or is the same species — this is an
 * observed denylist, not a guessed one.
 */
export const AGGREGATOR_HOSTS = [
  // company-data aggregators
  'cbinsights.com', 'crunchbase.com', 'pitchbook.com', 'owler.com', 'zoominfo.com',
  'leadiq.com', 'apollo.io', 'rocketreach.co', 'signalhire.com', 'lusha.com',
  'clearbit.com', 'dnb.com', 'buzzfile.com', 'manta.com', 'bizapedia.com',
  'opencorporates.com', 'opengovco.com', 'importgenius.com', 'panjiva.com',
  'volza.com', 'zauba.com', 'datanyze.com', 'growjo.com', 'craft.co', 'tracxn.com',
  // social and profile hosts
  'linkedin.com', 'facebook.com', 'twitter.com', 'x.com', 'instagram.com',
  'youtube.com', 'tiktok.com', 'pinterest.com', 'reddit.com',
  // reviews, jobs, listings
  'glassdoor.com', 'indeed.com', 'ziprecruiter.com', 'yelp.com', 'bbb.org',
  'trustpilot.com', 'g2.com', 'capterra.com', 'clutch.co', 'thomasnet.com',
  'mapquest.com', 'yellowpages.com', 'chamberofcommerce.com',
  // reference, SEO shadow hosts, marketplaces
  'wikipedia.org', 'similarweb.com', 'semrush.com', 'getstat.site', 'siteworthtraffic.com',
  'medium.com', 'substack.com', 'amazon.com', 'ebay.com', 'alibaba.com', 'indiamart.com',
  'tradeindia.com', 'exportersindia.com', 'a2zinc.net', 'expocad.com', 'eventbrite.com',
] as const;

/**
 * Path shapes that mean "a profile of a company", whatever the host. Catches
 * the long tail of directories and state license registries that no denylist
 * will ever fully enumerate.
 */
const PROFILE_PATH = /^\/(company|companies|profile|profiles|c|org|orgs|business|businesses|listing|listings|license|licenses|licence|importers|suppliers|supplier|vendor|vendors|people|person|directory|dir|firm|brands?)(\/|$)/i;

export type RejectReason =
  | 'subject_domain'
  | 'subject_mirror'
  | 'aggregator_host'
  | 'profile_path'
  | 'names_the_subject'
  | 'foreign_geography'
  | 'duplicate'
  | 'not_a_company_page'
  | 'off_category'
  | 'over_keep_limit';

/**
 * Content words from the category description, for the off-category check.
 * Stopwords and generic business vocabulary are dropped, because "company",
 * "products" and "services" overlap with literally everything.
 */
const CATEGORY_STOPWORDS = new Set([
  'a','an','and','are','as','at','be','been','by','for','from','has','have','in','is','it','its',
  'of','on','or','our','that','the','their','they','this','to','we','with','you','your','all',
  'company','companies','business','businesses','products','product','services','service',
  'solutions','solution','provider','providers','leading','offer','offers','offering','across',
  'range','broad','different','more','than','over','also','other','including','include','based',
  'customers','clients','industry','industries','quality','best','new','one','can','will','us',
]);

export function categoryTerms(description: string): string[] {
  const words = description
    .toLowerCase()
    .replace(/[^a-z0-9\s'-]/g, ' ')
    .split(/\s+/)
    .map((w) => w.replace(/^[-']+|[-']+$/g, ''))
    .filter((w) => w.length >= 4 && !CATEGORY_STOPWORDS.has(w));
  // Crude stem: drop a trailing plural s so "clinics" matches "clinic".
  return [...new Set(words.map((w) => (w.endsWith('s') && !w.endsWith('ss') ? w.slice(0, -1) : w)))];
}

/**
 * How many of the category's content words appear in a candidate's own page
 * text. Zero overlap means the candidate has nothing lexically in common with
 * the category we searched for — which is what an IVF clinic returned by a
 * search for pharmaceutical distributors looks like.
 *
 * A weak signal used only at its extreme: zero is a rejection, anything above
 * zero passes. Ranking on it would be over-reading a word count.
 */
export function categoryOverlap(text: string, terms: readonly string[]): string[] {
  if (!text || terms.length === 0) return [];
  const flat = ` ${text.toLowerCase().replace(/[^a-z0-9]+/g, ' ')} `;
  return terms.filter((t) => flat.includes(` ${t}`));
}

export function isAggregatorHost(url: string): boolean {
  const domain = registrableDomain(url);
  return AGGREGATOR_HOSTS.some((h) => domain === h || domain.endsWith(`.${h}`));
}

export function hasProfilePath(url: string): boolean {
  try {
    return PROFILE_PATH.test(new URL(url).pathname);
  } catch {
    return false;
  }
}

/**
 * A mirror host reuses the subject's brand label somewhere in its hostname:
 * `hpsrx.tshinc.com`, `hpsrx.com.getstat.site`. Requires a label of 4+
 * characters, because a three-letter brand matches half the internet.
 */
export function isSubjectMirror(candidateUrl: string, subjectDomain: string): boolean {
  const label = brandLabel(subjectDomain);
  if (label.length < 4) return false;
  const host = hostOf(candidateUrl);
  if (!host) return false;
  if (registrableDomain(host) === registrableDomain(subjectDomain)) return true;
  return host.split('.').some((part) => part === label || part.replace(/[^a-z0-9]/g, '') === label);
}

/* -- name matching ------------------------------------------------------ */

const COMPANY_SUFFIXES =
  /\b(inc|inc\.|llc|l\.l\.c\.|ltd|limited|corp|corporation|co|company|plc|gmbh|pvt|private|enterprises|group|holdings|international|usa)\b/gi;

/** Comparable form of a company name: lowercase alphanumerics, no suffixes. */
export function nameKey(name: string): string {
  return name.replace(COMPANY_SUFFIXES, ' ').toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * Does this text name the subject? Checks the brand label and the company
 * name with punctuation and legal suffixes normalised away, so "HPS Rx",
 * "HPSRx Enterprises, Inc." and "hpsrx" all hit.
 *
 * The cheapest strong signal in the whole pipeline: a page that names the
 * subject is a page *about* the subject, not a peer.
 */
export function textNamesSubject(text: string, subjectDomain: string, subjectName?: string): boolean {
  if (!text) return false;
  const flat = text.toLowerCase().replace(/[^a-z0-9]/g, '');
  const label = brandLabel(subjectDomain);
  if (label.length >= 4 && flat.includes(label)) return true;
  if (subjectName) {
    const key = nameKey(subjectName);
    if (key.length >= 5 && flat.includes(key)) return true;
  }
  return false;
}

/**
 * Near-miss domain detection, for citation integrity in stage 03.
 *
 * Observed live: asked about MedGyn Products (medgyn.com), Perplexity's first
 * citation was `medi-gyn.com` — a different company. Punctuation-insensitive
 * equality would call those the same; equality alone would call them
 * unrelated third-party coverage. Neither is right, so a near miss is its own
 * verdict and stage 03 drops the claim.
 */
export function isNearMissDomain(a: string, b: string): boolean {
  const ka = brandLabel(a).replace(/[^a-z0-9]/g, '');
  const kb = brandLabel(b).replace(/[^a-z0-9]/g, '');
  if (!ka || !kb || ka === kb) return false;
  if (ka.length < 5 || kb.length < 5) return false;
  return levenshtein(ka, kb) <= 2;
}

export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let last = prev[0];
    prev[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = prev[j];
      prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, last + (a[i - 1] === b[j - 1] ? 0 : 1));
      last = tmp;
    }
  }
  return prev[b.length];
}

/**
 * Exa returns a `score` on every result. In `category:"company"` searches it
 * is a linear rank ramp — 1, 0.929, 0.857 … 0 for 15 results, exactly
 * 1 - i/(n-1) — and carries no similarity information at all. Using it as
 * confidence looks entirely reasonable and means nothing, so stage 02 derives
 * confidence from generator agreement instead and calls this to record the
 * fact in the artifact.
 */
export function looksLikeRankRamp(scores: (number | undefined)[]): boolean {
  const values = scores.filter((s): s is number => typeof s === 'number');
  if (values.length < 4) return false;
  return values.every((s, i) => Math.abs(s - (1 - i / (values.length - 1))) < 0.01);
}
