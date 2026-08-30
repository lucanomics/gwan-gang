import { describe, expect, it } from 'vitest';
import { mockPool, practicePool } from './pool';
import { makeQuestion } from './testing';
import { DEFAULT_PREFERENCES } from './types';

const bank = [
  makeQuestion({ id: 'official', sourceType: 'official-past-exam', verificationStatus: 'verified' }),
  makeQuestion({ id: 'mine', sourceType: 'user-authored', verificationStatus: 'unverified' }),
  makeQuestion({ id: 'ai', sourceType: 'ai-generated', verificationStatus: 'unverified' }),
  makeQuestion({ id: 'demo', sourceType: 'sample', verificationStatus: 'unverified' }),
];

describe('practicePool', () => {
  it('includes everything by default', () => {
    expect(practicePool(bank, DEFAULT_PREFERENCES).map((q) => q.id)).toEqual([
      'official',
      'mine',
      'ai',
      'demo',
    ]);
  });

  it('drops samples when the learner turns them off', () => {
    const pool = practicePool(bank, { ...DEFAULT_PREFERENCES, includeSamples: false });
    expect(pool.map((q) => q.id)).not.toContain('demo');
  });

  it('drops unverified content when the learner turns it off, samples included', () => {
    const pool = practicePool(bank, {
      ...DEFAULT_PREFERENCES,
      includeUnverifiedInPractice: false,
      includeSamples: false,
    });
    expect(pool.map((q) => q.id)).toEqual(['official']);
  });
});

describe('mockPool', () => {
  it('is verified-only unless explicitly overridden', () => {
    expect(mockPool(bank, false).map((q) => q.id)).toEqual(['official']);
    expect(mockPool(bank, true)).toHaveLength(4);
  });
});
