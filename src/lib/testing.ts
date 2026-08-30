import type { Attempt, Question, Subject } from './types';

/** Test-only factories. Keeps the specs readable and the fixtures honest. */
export function makeQuestion(overrides: Partial<Question> & { id: string }): Question {
  return {
    subject: 'law',
    question: `문제 ${overrides.id}`,
    choices: ['가', '나', '다', '라'],
    correctAnswer: 0,
    explanation: '해설',
    sourceType: 'user-authored',
    verificationStatus: 'unverified',
    ...overrides,
  };
}

export function makeBank(perSubject: number, subjects: Subject[] = ['history', 'resources', 'law', 'tourism']): Question[] {
  const bank: Question[] = [];
  for (const subject of subjects) {
    for (let i = 0; i < perSubject; i += 1) {
      bank.push(
        makeQuestion({
          id: `${subject}-${i}`,
          subject,
          topic: `${subject}-topic-${i % 3}`,
          verificationStatus: 'verified',
          sourceType: 'official-past-exam',
        }),
      );
    }
  }
  return bank;
}

export function makeAttempt(overrides: Partial<Attempt> & { questionId: string }): Attempt {
  return {
    id: `a-${overrides.questionId}-${Math.random().toString(36).slice(2, 8)}`,
    selectedAnswer: 0,
    correct: true,
    attemptedAt: new Date().toISOString(),
    ...overrides,
  };
}

/** Deterministic PRNG so selection tests do not flake. */
export function seededRandom(seed = 42): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}
