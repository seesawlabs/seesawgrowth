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
  headline: 'What we\u2019d tell you about AI if we had an hour',
  promise:
    'Every number here either links to where we got it, or it\u2019s a {blank} for you to fill in. We ' +
    'haven\u2019t quietly estimated anything. When we ran out of evidence, we stopped and said so.',

  sections: {
    standing: {
      num: '01',
      eyebrow: 'First read',
      heading: 'What we think is going on',
      intro: '',
    },
    opportunities: {
      num: '02',
      eyebrow: 'What we\u2019d build',
      heading: 'Three ideas you may not have considered',
      intro:
        'Specific enough to argue with, in the order we\u2019d do them. Where we\u2019ve put numbers on ' +
        'one, they\u2019re our guesses and we\u2019ve said so. Tell us how far off we are.',
    },
    questions: {
      num: '03',
      eyebrow: 'Questions',
      heading: 'What we\u2019d ask you first',
      intro:
        'We\u2019ve only read your website. These are the questions whose answers would change the ' +
        'advice above.',
    },
    peers: {
      num: '04',
      eyebrow: 'Competitors',
      heading: 'What companies like you have done',
      intro: '',
    },
    blindSpots: {
      num: '05',
      eyebrow: 'Caveats',
      heading: 'What we couldn\u2019t see',
      intro:
        'This is built from public information only, so some of it will be wrong or out of date. Here\u2019s ' +
        'where we\u2019d guess we got it wrong.',
    },
    evidence: {
      num: '06',
      eyebrow: 'Sources',
      heading: 'Where all this came from',
      intro:
        'Everything above traces back to one of these, and each one links to where we found it. None of ' +
        'it is us paraphrasing you \u2014 it\u2019s your own words, a dated article, or a figure from a ' +
        'named data provider with the date we pulled it.',
    },
  },
  whyLabel: 'Why we’re asking',
  changesLabel: 'What your answer changes',
  assumptionsLabel: 'Our guesses — correct them',

  closing: {
    heading: 'Where this goes next',
    body: [
      'We wrote this from the outside, so some of it will be wrong. An hour on a call is where you tell us ' +
        'which parts, and we tell you which of these ideas we\u2019d actually start with. No prep needed, ' +
        'and no charge.',
      'If there\u2019s something here we think you should build, we\u2019ll say so. If there isn\u2019t, ' +
        'we\u2019ll say that instead.',
    ],
    ctaLabel: 'Book the hour',
  },

  sourcesHeading: 'Sources & retrieval dates',
  emptySection:
    'We couldn\u2019t find anything here we could back up. That usually means the answer is inside your ' +
    'company rather than online, which is a good thing to talk through.',
};

/** Blind spots true of every report built from the outside, not just this one. */
export const UNIVERSAL_UNKNOWNS = [
  'Which of the steps we found actually costs you money, rather than just being easy to spot from outside',
  'What you\u2019ve already tried here, and what you decided against',
];
