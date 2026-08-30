import { describe, expect, it } from 'vitest';
import {
  cutoffFailures,
  cutoffStatus,
  emptyCounts,
  evaluateExam,
  pointsToTarget,
  scoreBand,
  weightedScore,
  type SubjectCounts,
} from './scoring';
import { PASS_SCORE, SUBJECT_CUTOFF_CORRECT } from './exam';

const counts = (history: number, resources: number, law: number, tourism: number): SubjectCounts => ({
  history,
  resources,
  law,
  tourism,
});

describe('weightedScore', () => {
  it('gives 관광국사 1.6 points and every other subject 0.8 per correct answer', () => {
    expect(weightedScore(counts(1, 0, 0, 0))).toBe(1.6);
    expect(weightedScore(counts(0, 1, 0, 0))).toBe(0.8);
    expect(weightedScore(counts(0, 0, 1, 0))).toBe(0.8);
    expect(weightedScore(counts(0, 0, 0, 1))).toBe(0.8);
  });

  it('returns 100 for a perfect exam and 0 for an empty one', () => {
    expect(weightedScore(counts(25, 25, 25, 25))).toBe(100);
    expect(weightedScore(emptyCounts())).toBe(0);
  });

  it('is exact at the 60 point boundary despite floating point weights', () => {
    // 25 history (40) + 25 law (20) = 60.0 exactly.
    expect(weightedScore(counts(25, 0, 25, 0))).toBe(60);
    expect(weightedScore(counts(25, 0, 25, 0)) >= PASS_SCORE).toBe(true);
  });

  it('clamps impossible counts to the 25-question ceiling and ignores negatives', () => {
    expect(weightedScore(counts(30, 0, 0, 0))).toBe(40);
    expect(weightedScore(counts(-5, 0, 0, 0))).toBe(0);
  });
});

describe('cutoffFailures', () => {
  it('flags every subject below 10 of 25', () => {
    expect(cutoffFailures(counts(9, 25, 25, 25))).toEqual(['history']);
    expect(cutoffFailures(counts(10, 10, 10, 10))).toEqual([]);
    expect(cutoffFailures(counts(0, 0, 0, 0)).length).toBe(4);
  });

  it('treats exactly 10 as passing the 40% line', () => {
    expect(SUBJECT_CUTOFF_CORRECT).toBe(10);
    expect(cutoffFailures(counts(10, 10, 10, 10))).toEqual([]);
    expect(cutoffFailures(counts(9, 10, 10, 10))).toEqual(['history']);
  });
});

describe('evaluateExam', () => {
  it('passes at exactly 60 with no 과락', () => {
    const result = evaluateExam(counts(25, 10, 25, 0));
    expect(result.weightedTotal).toBe(68);
    expect(evaluateExam(counts(20, 10, 10, 10)).weightedTotal).toBe(56);

    const boundary = evaluateExam(counts(15, 12, 10, 11));
    expect(boundary.weightedTotal).toBe(50.4);
    expect(boundary.passed).toBe(false);
  });

  it('passes on the exact 60.0 boundary', () => {
    const result = evaluateExam(counts(20, 10, 10, 15));
    expect(result.weightedTotal).toBe(60);
    expect(result.metScoreThreshold).toBe(true);
    expect(result.passed).toBe(true);
  });

  it('fails just below 60', () => {
    const result = evaluateExam(counts(20, 10, 10, 14));
    expect(result.weightedTotal).toBe(59.2);
    expect(result.passed).toBe(false);
  });

  it('fails a 60+ total when one subject sits at 9 — the 과락 override', () => {
    const result = evaluateExam(counts(25, 25, 9, 12));
    expect(result.weightedTotal).toBeGreaterThan(60);
    expect(result.metScoreThreshold).toBe(true);
    expect(result.cutoffFailures).toEqual(['law']);
    expect(result.passed).toBe(false);
  });

  it('passes when every subject is exactly at the cutoff and the total clears 60', () => {
    const all10 = evaluateExam(counts(10, 10, 10, 10));
    expect(all10.weightedTotal).toBe(40);
    expect(all10.cutoffFailures).toEqual([]);
    // 40 < 60, so the cutoff being met is not by itself enough.
    expect(all10.passed).toBe(false);
  });

  it('rewards strong 관광국사 more than strong minor subjects', () => {
    const strongHistory = evaluateExam(counts(25, 10, 10, 10));
    const weakHistory = evaluateExam(counts(10, 25, 25, 25));
    expect(strongHistory.weightedTotal).toBe(64);
    expect(weakHistory.weightedTotal).toBe(76);
    // 25 extra history answers are worth 40 points; 45 extra minor answers 36.
    expect(weightedScore(counts(25, 0, 0, 0))).toBe(40);
  });

  it('reports a perfect and an empty exam correctly', () => {
    const max = evaluateExam(counts(25, 25, 25, 25));
    expect(max.weightedTotal).toBe(100);
    expect(max.passed).toBe(true);

    const zero = evaluateExam(emptyCounts());
    expect(zero.weightedTotal).toBe(0);
    expect(zero.passed).toBe(false);
    expect(zero.cutoffFailures.length).toBe(4);
  });

  it('splits the weighted total into per-subject contributions', () => {
    const result = evaluateExam(counts(10, 10, 10, 10));
    expect(result.contribution).toEqual({
      history: 16,
      resources: 8,
      law: 8,
      tourism: 8,
    });
  });
});

describe('scoreBand', () => {
  it('maps scores onto the study status bands', () => {
    expect(scoreBand(54.9).label).toBe('매우 위험');
    expect(scoreBand(55).label).toBe('위험');
    expect(scoreBand(59.9).label).toBe('위험');
    expect(scoreBand(60).label).toBe('턱걸이 구간');
    expect(scoreBand(64.9).label).toBe('턱걸이 구간');
    expect(scoreBand(65).label).toBe('목표 구간');
    expect(scoreBand(69.9).label).toBe('목표 구간');
    expect(scoreBand(70).label).toBe('완충 구간');
    expect(scoreBand(100).label).toBe('완충 구간');
  });
});

describe('cutoffStatus', () => {
  it('warns below 12 and fails below 10 expected correct', () => {
    expect(cutoffStatus(9.9).status).toBe('fail');
    expect(cutoffStatus(10).status).toBe('warn');
    expect(cutoffStatus(11.9).status).toBe('warn');
    expect(cutoffStatus(12).status).toBe('safe');
  });
});

describe('pointsToTarget', () => {
  it('never reports a negative gap', () => {
    expect(pointsToTarget(62.4, 65)).toBe(2.6);
    expect(pointsToTarget(71, 70)).toBe(0);
  });
});
