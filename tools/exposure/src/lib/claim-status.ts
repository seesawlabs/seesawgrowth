/* ---------------------------------------------------------------------------
   How we know a claim, as a label. One function, three readers.

   The register prints it, the email draft is bound by it, and stage 07 is
   told it per claim. Before this file the label was bookkeeping in the
   renderer; now it is load-bearing, so it lives in lib where a stage can
   import it without pulling in a renderer.

     Verified   read on the page that publishes it: the subject's own site
                (stage 01), or a peer's own site (stage 03's own-surface pass)
     Cited      found through a citation-backed search and attributed to the
                page the citation named; the page was not read by us
     Tool data  returned by a paid data API (DataForSEO) with a pull date
     Ours       our own inference, carrying declared blanks rather than figures

   THE OUTBOUND RULE. An email that leaves the building may cite Verified
   claims only. Cited and Tool-data claims are call material by definition:
   said aloud, with the caveat that we did not read the page or that the
   figure is a vendor's estimate. Ours never leaves without being spoken.
   `isOutboundSafe` is that rule as a predicate, and stage 07 enforces it on
   the email draft.

   ABSENCE is not a tier here because the citation gates in stage 03 drop
   statements that assert what a company does not do. "We could not find" is
   written by the analyst as a finding about our search, never as a claim
   about the company, and the prompts say so.
--------------------------------------------------------------------------- */

import type { Claim } from './claim.ts';

export type ClaimStatusLabel = 'Verified' | 'Cited' | 'Tool data' | 'Ours';

export interface ClaimStatus {
  label: ClaimStatusLabel;
  /** CSS hook for the register pill. */
  cls: 'verified' | 'cited' | 'tool' | 'ours';
}

function readOnOwnSite(claim: Claim): boolean {
  if (claim.sources.length === 0) return false;
  const peer = (claim.peerName ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
  if (peer.length <= 3) return false;
  const stem = peer.slice(0, Math.min(peer.length, 8));
  return claim.sources.every((s) => {
    try {
      const host = new URL(s.url).hostname.replace(/^www\./, '').replace(/[^a-z0-9]/g, '');
      return host.includes(stem);
    } catch {
      return false;
    }
  });
}

export function claimStatus(claim: Claim): ClaimStatus {
  if (claim.tier === 'hypothesis') return { label: 'Ours', cls: 'ours' };
  if (claim.id.startsWith('dem-')) return { label: 'Tool data', cls: 'tool' };
  if (claim.tier === 'observed') return { label: 'Verified', cls: 'verified' };
  return readOnOwnSite(claim) ? { label: 'Verified', cls: 'verified' } : { label: 'Cited', cls: 'cited' };
}

/** May this claim be cited in something we send without a conversation around it? */
export function isOutboundSafe(claim: Claim): boolean {
  return claimStatus(claim).label === 'Verified';
}

/** Why a claim is call material rather than email material, for the reviewer. */
export function callMaterialReason(claim: Claim): string {
  switch (claimStatus(claim).label) {
    case 'Cited':
      return 'found through a citation-backed search; we did not read the page ourselves';
    case 'Tool data':
      return 'a data vendor’s figure with a pull date; say where it came from';
    case 'Ours':
      return 'our own inference; say so, and say what would confirm it';
    default:
      return '';
  }
}
