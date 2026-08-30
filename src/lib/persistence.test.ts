import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { clearEverything, loadSnapshot, putAttempts, putQuestions, putReviews, setMeta } from './db';
import { useStore } from './store';
import { buildBackup, parseBackup } from './backup';
import { makeAttempt, makeBank } from './testing';
import { DEFAULT_PREFERENCES } from './types';

/** Simulates closing the tab and opening it again: memory is gone, IndexedDB is not. */
async function reload(): Promise<void> {
  useStore.setState({
    ready: false,
    questions: [],
    attempts: [],
    reviews: [],
    sessions: [],
    mocks: [],
    notes: [],
    activeSessionId: undefined,
    activeMockId: undefined,
    preferences: { ...DEFAULT_PREFERENCES },
  });
  await useStore.getState().boot();
}

beforeEach(async () => {
  await clearEverything();
  useStore.setState({ ready: false, persistError: null, bootError: null });
});

describe('first launch', () => {
  it('seeds the fictional development samples so the app is never a dead end', async () => {
    await useStore.getState().boot();
    const state = useStore.getState();
    expect(state.questions.length).toBeGreaterThan(0);
    expect(state.questions.every((q) => q.sourceType === 'sample')).toBe(true);
    expect(state.questions.every((q) => q.verificationStatus === 'unverified')).toBe(true);
  });

  it('does not re-seed samples the learner deleted', async () => {
    await useStore.getState().boot();
    const ids = useStore.getState().questions.map((q) => q.id);
    await useStore.getState().removeQuestions(ids);
    expect(useStore.getState().questions).toHaveLength(0);

    await reload();
    expect(useStore.getState().questions).toHaveLength(0);
  });
});

describe('study state survives a reload', () => {
  it('keeps attempts, wrong-answer classification and the review schedule', async () => {
    await useStore.getState().boot();
    await useStore.getState().addQuestions(makeBank(3));

    const session = await useStore.getState().startSession({ mode: 'quick5', count: 5 });
    expect(session).not.toBeNull();

    const firstId = session!.questionIds[0];
    const question = useStore.getState().questions.find((q) => q.id === firstId)!;
    const wrongChoice = (question.correctAnswer + 1) % question.choices.length;

    await useStore.getState().answerQuestion({ questionId: firstId, selectedAnswer: wrongChoice });
    await useStore.getState().classifyError(firstId, 'confusion');

    await reload();

    const state = useStore.getState();
    const attempt = state.attempts.find((a) => a.questionId === firstId);
    expect(attempt).toBeDefined();
    expect(attempt!.correct).toBe(false);
    expect(attempt!.errorType).toBe('confusion');

    const review = state.reviews.find((r) => r.questionId === firstId);
    expect(review).toBeDefined();
    expect(review!.errorType).toBe('confusion');
    expect(review!.lapses).toBe(1);
  });

  it('resumes an interrupted session at the right question', async () => {
    await useStore.getState().boot();
    await useStore.getState().addQuestions(makeBank(3));
    const session = await useStore.getState().startSession({ mode: 'quick10', count: 10 });
    const firstId = session!.questionIds[0];

    await useStore.getState().answerQuestion({ questionId: firstId, selectedAnswer: 0 });
    await useStore.getState().advanceSession();

    await reload();

    const state = useStore.getState();
    const resumed = state.sessions.find((s) => s.id === state.activeSessionId);
    expect(resumed).toBeDefined();
    expect(resumed!.cursor).toBe(1);
    expect(resumed!.questionIds).toEqual(session!.questionIds);
  });

  it('advances the review ladder when a due question is answered correctly', async () => {
    await useStore.getState().boot();
    await useStore.getState().addQuestions(makeBank(3));
    const bankQuestion = useStore.getState().questions.find((q) => q.id === 'law-0')!;

    await useStore.getState().startSession({ mode: 'quick5', count: 5 });
    await useStore.getState().answerQuestion({
      questionId: bankQuestion.id,
      selectedAnswer: (bankQuestion.correctAnswer + 1) % 4,
    });
    await useStore.getState().classifyError(bankQuestion.id, 'knowledge');
    expect(useStore.getState().reviews.find((r) => r.questionId === bankQuestion.id)!.stage).toBe(0);

    await useStore.getState().startSession({ mode: 'quick5', count: 5 });
    await useStore.getState().answerQuestion({
      questionId: bankQuestion.id,
      selectedAnswer: bankQuestion.correctAnswer,
    });

    const review = useStore.getState().reviews.find((r) => r.questionId === bankQuestion.id)!;
    expect(review.stage).toBe(1);
    expect(review.streak).toBe(1);
  });

  it('records the same answer only once even if the UI fires twice', async () => {
    await useStore.getState().boot();
    await useStore.getState().addQuestions(makeBank(3));
    const session = await useStore.getState().startSession({ mode: 'quick5', count: 5 });
    const id = session!.questionIds[0];

    await useStore.getState().answerQuestion({ questionId: id, selectedAnswer: 0 });
    await useStore.getState().answerQuestion({ questionId: id, selectedAnswer: 1 });

    expect(useStore.getState().attempts.filter((a) => a.questionId === id)).toHaveLength(1);
  });
});

describe('mock exam persistence', () => {
  it('keeps a submitted mock result across a reload and files every miss for review', async () => {
    await useStore.getState().boot();
    await useStore.getState().addQuestions(makeBank(25));

    const { mock } = await useStore.getState().startMock(false);
    expect(mock).not.toBeNull();
    expect(mock!.questionIds).toHaveLength(100);

    // Answer every history question correctly, leave the rest blank.
    for (const id of mock!.questionIds) {
      const question = useStore.getState().questions.find((q) => q.id === id)!;
      if (question.subject === 'history') {
        await useStore.getState().answerMock(id, question.correctAnswer);
      }
    }

    const submitted = await useStore.getState().submitMock();
    expect(submitted!.result!.correctBySubject.history).toBe(25);
    expect(submitted!.result!.weightedTotal).toBe(40);
    expect(submitted!.result!.passed).toBe(false);
    expect(submitted!.result!.cutoffFailures).toEqual(['resources', 'law', 'tourism']);

    await reload();

    const state = useStore.getState();
    const stored = state.mocks.find((m) => m.id === submitted!.id);
    expect(stored!.result!.weightedTotal).toBe(40);
    expect(state.activeMockId).toBeUndefined();
    // Every wrong/unanswered question is queued for review.
    expect(state.reviews.length).toBe(75);
  });

  it('refuses to start a mock when verified content is short, and says so', async () => {
    await useStore.getState().boot();
    const { mock, shortfall } = await useStore.getState().startMock(false);
    expect(mock).toBeNull();
    expect(shortfall.history).toBe(25);
  });
});

describe('reset', () => {
  it('clears progress but keeps the question bank', async () => {
    await useStore.getState().boot();
    await useStore.getState().addQuestions(makeBank(3));
    await useStore.getState().startSession({ mode: 'quick5', count: 5 });
    await useStore.getState().answerQuestion({
      questionId: useStore.getState().sessions[0].questionIds[0],
      selectedAnswer: 0,
    });

    await useStore.getState().resetProgress();
    await reload();

    const state = useStore.getState();
    expect(state.attempts).toHaveLength(0);
    expect(state.sessions).toHaveLength(0);
    expect(state.questions.length).toBeGreaterThan(0);
  });

  it('clears everything without re-seeding samples afterwards', async () => {
    await useStore.getState().boot();
    await useStore.getState().resetEverything();
    await reload();
    expect(useStore.getState().questions).toHaveLength(0);
  });
});

describe('backup roundtrip', () => {
  it('exports and restores the full study state', async () => {
    await useStore.getState().boot();
    await useStore.getState().addQuestions(makeBank(3));
    await useStore.getState().startSession({ mode: 'quick5', count: 5 });
    const id = useStore.getState().sessions[0].questionIds[0];
    const question = useStore.getState().questions.find((q) => q.id === id)!;
    await useStore.getState().answerQuestion({
      questionId: id,
      selectedAnswer: (question.correctAnswer + 1) % 4,
    });
    await useStore.getState().classifyError(id, 'mistake');
    await useStore.getState().saveNote({ body: '등록과 신고는 다르다', subject: 'law' });

    const before = useStore.getState();
    const file = JSON.stringify(
      buildBackup({
        questions: before.questions,
        attempts: before.attempts,
        reviews: before.reviews,
        sessions: before.sessions,
        mocks: before.mocks,
        notes: before.notes,
        preferences: before.preferences,
      }),
    );

    await useStore.getState().resetEverything();
    expect(useStore.getState().attempts).toHaveLength(0);

    const parsed = parseBackup(file);
    expect(parsed.errors).toEqual([]);
    await useStore.getState().restore(parsed.data!);
    await reload();

    const after = useStore.getState();
    expect(after.questions.length).toBe(before.questions.length);
    expect(after.attempts.length).toBe(before.attempts.length);
    expect(after.reviews.length).toBe(before.reviews.length);
    expect(after.notes[0].body).toBe('등록과 신고는 다르다');
    expect(after.attempts[0].errorType).toBe('mistake');
  });
});

describe('the raw storage layer', () => {
  it('round-trips every store', async () => {
    const bank = makeBank(1);
    await putQuestions(bank);
    await putAttempts([makeAttempt({ questionId: bank[0].id })]);
    await putReviews([
      {
        questionId: bank[0].id,
        subject: bank[0].subject,
        stage: 0,
        errorType: 'knowledge',
        dueAt: new Date().toISOString(),
        lastReviewedAt: new Date().toISOString(),
        streak: 0,
        lapses: 1,
      },
    ]);
    await setMeta('preferences', { ...DEFAULT_PREFERENCES, showQuestionTimer: true });

    const snapshot = await loadSnapshot();
    expect(snapshot.questions).toHaveLength(4);
    expect(snapshot.attempts).toHaveLength(1);
    expect(snapshot.reviews).toHaveLength(1);
    expect(snapshot.preferences!.showQuestionTimer).toBe(true);
  });
});
