/* ---------------------------------------------------------------------------
   Every word of the lead-facing report that is not evidence or analysis.

   SEPARATED ON PURPOSE. Decision #1 (positioning) has been open since
   2026-07-22, and the section headings, the promise and the closing pitch all
   change with it. Keeping them in one object means landing that decision is an
   edit to this file rather than a hunt through a renderer.

   It is also the file to argue about with the team. The claims come from the
   pipeline and cannot be edited by hand — that is what the validator is for —
   and the analysis comes from stage 06. This is the part that *should* be
   edited by hand.

   ORDER MATTERS MORE THAN WORDING HERE. The first version of this report led
   with evidence and buried the thinking, which read as a dump of press-release
   headlines and search volumes. Analysis now comes first and the claims are an
   appendix, because a reader wants the conclusion and the right to check it —
   in that order.

   Written to the recommended position: design-led AI product studio with a
   care-operations wedge. Healthcare-first in proof and content, not
   healthcare-only in sales — so nothing here names a vertical.
--------------------------------------------------------------------------- */

export interface Sec {
  num: string;
  eyebrow: string;
  heading: string;
  intro: string;
}

export interface ReportCopy {
  /** Shown above the headline. The offer's name. */
  kicker: string;
  /** The report's one-line thesis. */
  headline: string;
  /** The honesty promise. This is the differentiator; change it carefully. */
  promise: string;
  sections: {
    standing: Sec;
    questions: Sec;
    opportunities: Sec;
    peers: Sec;
    blindSpots: Sec;
    evidence: Sec;
  };
  /** Label above a question's supporting research. */
  whyLabel: string;
  /** Label above what an answer would change. */
  changesLabel: string;
  /** Label above a sizing block's declared assumptions. */
  assumptionsLabel: string;
  closing: { heading: string; body: string[]; ctaLabel: string };
  sourcesHeading: string;
  /** Rendered when a section has no content. Honesty over a blank space. */
  emptySection: string;
}

export const COPY: ReportCopy = {
  kicker: 'AI Exposure Report',
  headline: 'What AI is doing to your category, and where it touches you',
  promise:
    'Every number in this report carries a source you can open, or it is left as a {blank} for you to ' +
    'fill in. We have not estimated anything silently. Where the evidence runs out, we say so and stop — ' +
    'that boundary is a section of its own, and it is the part worth talking about.',

  sections: {
    standing: {
      num: '01',
      eyebrow: 'What we think we see',
      heading: 'From the outside, this is how it looks',
      intro: '',
    },
    opportunities: {
      num: '02',
      eyebrow: 'What we would build',
      heading: 'Three ideas you may not have considered',
      intro:
        'Not "add AI to your operation". Specific enough to argue with, and sequenced the way we would ' +
        'actually do it. Where we have put numbers on one they are our own assumptions, labelled as ' +
        'such — the point is the order of magnitude, and your correction is worth more than our estimate.',
    },
    questions: {
      num: '03',
      eyebrow: 'What we would ask you',
      heading: 'The questions that would sharpen those ideas',
      intro:
        'We have read your public surface and nothing else. These are the questions whose answers would ' +
        'change the advice above, and the reason each one is worth your time sits underneath it.',
    },
    peers: {
      num: '04',
      eyebrow: 'What comparable companies did',
      heading: 'Who has moved, and whether it worked',
      intro: '',
    },
    blindSpots: {
      num: '05',
      eyebrow: 'Where we are probably wrong',
      heading: 'What we could not see from outside',
      intro:
        'This is built entirely from public evidence, so some of it will be wrong or out of date. These ' +
        'are the places we would bet on being wrong first.',
    },
    evidence: {
      num: '06',
      eyebrow: 'The evidence',
      heading: 'Everything above, and where it came from',
      intro:
        'Every statement traces to one of these, and every one carries a source you can open. Nothing ' +
        'here is our characterisation of you — it is your own words, a dated published source, or a ' +
        'figure from a named data provider with the date we pulled it.',
    },
  },
  whyLabel: 'Why we’re asking',
  changesLabel: 'What your answer changes',
  assumptionsLabel: 'What we assumed — correct us',

  closing: {
    heading: 'Where this goes next',
    body: [
      'The questions above are the agenda. An hour with us is where you answer them, correct what we got ' +
        'wrong, and we tell you which of these is actually worth doing — no preparation, no deck, no charge.',
      'If the answer is that there is something worth building, the next step is an AI Production Roadmap. ' +
        'If there isn’t, we will tell you that instead.',
    ],
    ctaLabel: 'Book the hour',
  },

  sourcesHeading: 'Sources & retrieval dates',
  emptySection:
    'We found nothing here we could source. That absence is itself worth a conversation — it usually ' +
    'means the evidence is internal rather than missing.',
};

/** Blind spots true of every report built from the outside, not just this one. */
export const UNIVERSAL_UNKNOWNS = [
  'Which of the steps we found is actually expensive, as opposed to merely visible from outside',
  'What you have already tried here, and what you decided against and why',
];
