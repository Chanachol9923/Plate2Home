/**
 * Plate matching thresholds and weights. Covered by lib/matching/score.test.ts, where each
 * value is exercised by realistic examples; change them only together with those tests.
 */
export const matchConfig = {
  /** Substitution / insertion / deletion of an unrelated character. */
  editCost: 1,
  /** Adjacent swap (e.g. 1243 for 1234). */
  transposeCost: 0.8,
  /** `?` against any character. Uncertainty is charged separately via `wildcardPenalty`. */
  wildcardCost: 0,
  /** Subtracted from the similarity for every `?` on either side. */
  wildcardPenalty: 0.04,
  /** More wildcards than this (both sides together) can never produce a match. */
  maxWildcards: 3,
  /** One side has the leading digit, the other doesn't (people often omit the `1` in 1กข). */
  prefixMissingCost: 0.5,

  /** A near match allows at most about one misread in the series (prefix + letters)… */
  maxSeriesCost: 1,
  /** …and at most about one misread in the number. */
  maxNumberCost: 1,

  /** Both provinces known and equal. */
  provinceMatchBonus: 0.05,
  /**
   * Both provinces known and different. The same letters+number exist in every province, so
   * this is large: only an otherwise perfect match survives as "near" (OCR may have misread
   * the province). 1 - 0.28 = 0.72 ≥ nearThreshold, but even one confusable misread
   * (≈ -0.05) drops below it.
   */
  provinceMismatchPenalty: 0.28,

  /** Minimum similarity for a "อาจตรงกัน" (near) match. */
  nearThreshold: 0.7,
} as const;

export type MatchConfig = typeof matchConfig;
