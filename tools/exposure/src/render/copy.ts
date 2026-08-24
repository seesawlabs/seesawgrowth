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
    strengths: Sec;
    weaknesses: Sec;
    market: Sec;
    peers: Sec;
    considerations: Sec;
    arithmetic: Sec;
    boundary: Sec;
    evidence: Sec;
  };
  needHeading: string;
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
      eyebrow: 'Where you stand',
      heading: 'What we think is actually going on',
      intro: '',
    },
    strengths: {
      num: '02',
      eyebrow: 'Where you are strong',
      heading: 'What you have that your category mostly does not',
      intro: '',
    },
    weaknesses: {
      num: '03',
      eyebrow: 'Where you are exposed',
      heading: 'What we would worry about in your position',
      intro: '',
    },
    market: {
      num: '04',
      eyebrow: 'Your category',
      heading: 'Which way the market is moving',
      intro: '',
    },
    peers: {
      num: '05',
      eyebrow: 'What comparable companies did',
      heading: 'Who has moved, how, and whether it worked',
      intro: '',
    },
    considerations: {
      num: '06',
      eyebrow: 'What to weigh',
      heading: 'The decisions this puts in front of you',
      intro: '',
    },
    arithmetic: {
      num: '07',
      eyebrow: 'The arithmetic',
      heading: 'We can see the shape of these. We can’t finish the maths',
      intro:
        'Each of these needs numbers only you have. We have left them blank rather than guessing, so ' +
        'the sum you reach is yours and not ours.',
    },
    boundary: {
      num: '08',
      eyebrow: 'The boundary',
      heading: 'What we couldn’t determine from the outside',
      intro:
        'This report is built entirely from public evidence. These are the things that would change its ' +
        'conclusions and that no amount of research can reach.',
    },
    evidence: {
      num: '09',
      eyebrow: 'The evidence',
      heading: 'Everything above, and where it came from',
      intro:
        'Every statement in this report traces to one of these, and every one of these carries a source ' +
        'you can open. Nothing here is our characterisation of you — it is your own words, a dated ' +
        'published source, or a figure from a named data provider with the date we pulled it.',
    },
  },

  needHeading: 'What we’d need from you',

  closing: {
    heading: 'Where this goes next',
    body: [
      'The blanks above are the agenda. A one-hour **AI Reality Check** fills them in and tells you where ' +
        'you actually stand — no preparation, no deck, and no charge.',
      'If the answer is that there is something worth building, the next step is an AI Production Roadmap. ' +
        'If it isn’t, we will tell you that instead.',
    ],
    ctaLabel: 'Book the Reality Check',
  },

  sourcesHeading: 'Sources & retrieval dates',
  emptySection:
    'We found nothing here we could source. That absence is itself worth a conversation — it usually ' +
    'means the evidence is internal rather than missing.',
};

/** Two extra boundary lines that are true of every report, not just this one. */
export const UNIVERSAL_UNKNOWNS = [
  'Which of the manual steps we found is actually expensive, as opposed to merely visible',
  'What your systems of record already talk to, and where the handoffs break',
];
