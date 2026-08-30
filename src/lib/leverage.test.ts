import { describe, expect, it } from 'vitest';
import { describeMoves, leverageTo } from './leverage';
import { weightedScore } from './scoring';

describe('leverageTo', () => {
  it('reports nothing to do once the target is already met', () => {
    const plan = leverageTo({ history: 20, resources: 20, law: 20, tourism: 20 }, 65);
    expect(plan.reached).toBe(true);
    expect(plan.options).toEqual([]);
  });

  it('states the exact point gap', () => {
    const current = { history: 16, resources: 14, law: 11, tourism: 16 };
    expect(weightedScore(current)).toBe(58.4);
    expect(leverageTo(current, 65).gap).toBe(6.6);
    expect(leverageTo(current, 70).gap).toBe(11.6);
  });

  it('offers plans that actually reach the target', () => {
    const current = { history: 16, resources: 14, law: 11, tourism: 16 };
    const plan = leverageTo(current, 65);
    expect(plan.options.length).toBeGreaterThan(0);
    for (const moves of plan.options) {
      const after = { ...current };
      moves.forEach((move) => {
        after[move.subject] += move.count;
      });
      expect(weightedScore(after)).toBeGreaterThanOrEqual(65);
    }
  });

  it('ranks the cheapest plan first', () => {
    const plan = leverageTo({ history: 16, resources: 14, law: 11, tourism: 16 }, 65);
    const sizes = plan.options.map((moves) => moves.reduce((sum, m) => sum + m.count, 0));
    expect(sizes).toEqual([...sizes].sort((a, b) => a - b));
    // 6.6 points needs at least 5 history answers (5 x 1.6 = 8) or a mix.
    expect(sizes[0]).toBeLessThanOrEqual(6);
  });

  it('never proposes a padded plan', () => {
    const current = { history: 16, resources: 14, law: 11, tourism: 16 };
    const plan = leverageTo(current, 65);
    for (const moves of plan.options) {
      const after = { ...current };
      moves.forEach((move) => {
        after[move.subject] += move.count;
      });
      // Removing any one question must drop the plan below the target.
      for (const move of moves) {
        const trimmed = { ...after };
        trimmed[move.subject] -= 1;
        expect(weightedScore(trimmed)).toBeLessThan(65);
      }
    }
  });

  it('surfaces mandatory 과락 fixes separately from point gains', () => {
    const plan = leverageTo({ history: 22, resources: 20, law: 6, tourism: 20 }, 65);
    expect(plan.cutoffFixes).toEqual([{ subject: 'law', count: 4, mandatory: true }]);
    expect(describeMoves(plan.cutoffFixes)).toBe('법규 +4');
  });

  it('does not suggest more answers than a subject has questions', () => {
    const plan = leverageTo({ history: 25, resources: 25, law: 0, tourism: 25 }, 70);
    for (const moves of plan.options) {
      for (const move of moves) {
        expect(move.count).toBeLessThanOrEqual(25);
      }
    }
    expect(plan.cutoffFixes[0]).toEqual({ subject: 'law', count: 10, mandatory: true });
  });

  it('formats moves compactly', () => {
    expect(
      describeMoves([
        { subject: 'history', count: 1, mandatory: false },
        { subject: 'law', count: 2, mandatory: false },
      ]),
    ).toBe('국사 +1 · 법규 +2');
  });
});
