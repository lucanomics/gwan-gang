import type { Preferences, Question } from './types';

/**
 * Which questions a normal practice session may draw from.
 *
 * Sample content is clearly labelled development filler; unverified content is
 * anything the learner or an AI wrote. Both are allowed in practice (the
 * learner opts in), but neither is ever counted as exam-grade evidence.
 */
export function practicePool(questions: Question[], prefs: Preferences): Question[] {
  return questions.filter((q) => {
    if (q.sourceType === 'sample') return prefs.includeSamples;
    if (q.verificationStatus === 'unverified') return prefs.includeUnverifiedInPractice;
    return true;
  });
}

/** Questions eligible for a serious Mock 100. Verified only, unless overridden. */
export function mockPool(questions: Question[], allowUnverified: boolean): Question[] {
  if (allowUnverified) return questions;
  return questions.filter((q) => q.verificationStatus === 'verified');
}

export function byId(questions: Question[]): Map<string, Question> {
  return new Map(questions.map((q) => [q.id, q]));
}
