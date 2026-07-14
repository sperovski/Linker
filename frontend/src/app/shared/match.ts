/**
 * Match scores are a share of an internship's required skills the student has.
 * With most roles listing 3 skills the raw number can only land on 0/33/67/100,
 * which reads as false precision — so the UI shows a band and keeps the raw
 * percentage in the tooltip and on the detail view.
 */

/** Below this, no match badge renders at all — a 0% is never shown to a student. */
export const MATCH_BADGE_MIN_SCORE = 20;

export const MATCH_STRONG_MIN = 70;
export const MATCH_GOOD_MIN = 45;

export type MatchBand = 'strong' | 'good' | 'possible';

/** The band for a score, or null when it is too low (or absent) to show. */
export function matchBand(score: number | null): MatchBand | null {
  if (score === null || score < MATCH_BADGE_MIN_SCORE) {
    return null;
  }
  if (score >= MATCH_STRONG_MIN) return 'strong';
  if (score >= MATCH_GOOD_MIN) return 'good';
  return 'possible';
}

export const MATCH_BAND_LABELS: Record<MatchBand, string> = {
  strong: 'Strong match',
  good: 'Good match',
  possible: 'Possible match',
};

/** "You have 2 of 3 required skills" — null when the breakdown isn't available. */
export function matchExplanation(matched: number | null, required: number | null): string | null {
  if (matched === null || required === null || required === 0) {
    return null;
  }
  return `You have ${matched} of ${required} required skill${required === 1 ? '' : 's'}`;
}
