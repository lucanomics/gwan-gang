import { create } from 'zustand';
import { MOCK_DURATION_MS, TOTAL_QUESTIONS, type Subject } from './exam';
import * as db from './db';
import { uid } from './id';
import { buildStats, selectBySubject, selectConfusion, selectMixed, selectReview } from './adaptive';
import { buildMock, gradeMock } from './mock';
import { practicePool } from './pool';
import { scheduleAfterHit, scheduleAfterMiss } from './review';
import { SAMPLE_QUESTIONS } from '../data/sampleQuestions';
import { DEFAULT_PREFERENCES } from './types';
import type {
  Attempt,
  Confidence,
  ConceptNote,
  ErrorType,
  MockExam,
  Preferences,
  Question,
  ReviewItem,
  SessionAnswer,
  SessionMode,
  StudySession,
} from './types';

const SEEDED_KEY = 'samplesSeeded';

export interface StartSessionOptions {
  mode: SessionMode;
  count: number;
  subject?: Subject;
  errorType?: ErrorType;
  dueOnly?: boolean;
}

export interface AnswerInput {
  questionId: string;
  selectedAnswer: number;
  responseTimeMs?: number;
  confidence?: Confidence;
}

interface StoreState {
  ready: boolean;
  bootError: string | null;
  persistError: string | null;

  questions: Question[];
  attempts: Attempt[];
  reviews: ReviewItem[];
  sessions: StudySession[];
  mocks: MockExam[];
  notes: ConceptNote[];
  preferences: Preferences;
  activeSessionId?: string;
  activeMockId?: string;

  boot: () => Promise<void>;

  startSession: (options: StartSessionOptions) => Promise<StudySession | null>;
  answerQuestion: (input: AnswerInput) => Promise<{ correct: boolean; attemptId: string } | null>;
  classifyError: (questionId: string, errorType: ErrorType) => Promise<void>;
  advanceSession: () => Promise<void>;
  finishSession: () => Promise<void>;
  extendSession: (count: number) => Promise<void>;
  retryWrong: () => Promise<StudySession | null>;

  startMock: (allowUnverified: boolean) => Promise<{ mock: MockExam | null; shortfall: Record<Subject, number> }>;
  answerMock: (questionId: string, selectedAnswer: number) => Promise<void>;
  submitMock: () => Promise<MockExam | null>;

  addQuestions: (questions: Question[]) => Promise<void>;
  removeQuestions: (ids: string[]) => Promise<void>;

  saveNote: (note: Omit<ConceptNote, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }) => Promise<void>;
  removeNote: (id: string) => Promise<void>;

  setPreferences: (patch: Partial<Preferences>) => Promise<void>;
  restore: (payload: {
    questions: Question[];
    attempts: Attempt[];
    reviews: ReviewItem[];
    sessions: StudySession[];
    mocks: MockExam[];
    notes: ConceptNote[];
    preferences: Preferences;
  }) => Promise<void>;
  resetProgress: () => Promise<void>;
  resetEverything: () => Promise<void>;
}

function nowISO(): string {
  return new Date().toISOString();
}

/** React StrictMode mounts effects twice; only one boot may touch the database. */
let bootInFlight: Promise<void> | null = null;

/** Persistence failures must never take the study loop down with them. */
async function guard(set: (patch: Partial<StoreState>) => void, run: () => Promise<void>): Promise<void> {
  try {
    await run();
  } catch (error) {
    set({
      persistError:
        error instanceof Error ? error.message : '저장 중 알 수 없는 오류가 발생했습니다',
    });
  }
}

export const useStore = create<StoreState>((set, get) => ({
  ready: false,
  bootError: null,
  persistError: null,

  questions: [],
  attempts: [],
  reviews: [],
  sessions: [],
  mocks: [],
  notes: [],
  preferences: { ...DEFAULT_PREFERENCES },
  activeSessionId: undefined,
  activeMockId: undefined,

  async boot() {
    if (get().ready) return;
    if (bootInFlight) return bootInFlight;
    bootInFlight = (async () => {
      await runBoot(set, get);
      bootInFlight = null;
    })();
    return bootInFlight;
  },

  async startSession(options) {
    const state = get();
    const pool = practicePool(state.questions, state.preferences);
    const stats = buildStats(state.attempts);
    const reviews = new Map(state.reviews.map((r) => [r.questionId, r]));

    let picked: Question[] = [];
    if (options.mode === 'review' || options.mode === 'final') {
      picked = selectReview({
        questions: state.questions,
        stats,
        reviews,
        count: options.count,
        errorType: options.errorType,
        subject: options.subject,
        dueOnly: options.dueOnly,
      });
      // Final review tops up from the adaptive pool when the queue runs dry.
      if (options.mode === 'final' && picked.length < options.count) {
        const exclude = new Set(picked.map((q) => q.id));
        picked = picked.concat(
          selectMixed({
            questions: pool,
            stats,
            reviews,
            count: options.count - picked.length,
            exclude,
          }),
        );
      }
    } else if (options.mode === 'subject25' && options.subject) {
      picked = selectBySubject({
        questions: pool,
        stats,
        reviews,
        subject: options.subject,
        count: options.count,
      });
    } else if (options.mode === 'vs') {
      picked = selectConfusion({ questions: pool, stats, reviews, count: options.count });
    } else {
      picked = selectMixed({ questions: pool, stats, reviews, count: options.count });
    }

    if (!picked.length) return null;

    const session: StudySession = {
      id: uid('s'),
      mode: options.mode,
      subject: options.subject,
      questionIds: picked.map((q) => q.id),
      cursor: 0,
      answers: {},
      startedAt: nowISO(),
    };

    set({
      sessions: [...get().sessions, session],
      activeSessionId: session.id,
      activeMockId: undefined,
    });
    await guard(set, async () => {
      await db.putSession(session);
      await db.setMeta('activeSessionId', session.id);
      await db.setMeta('activeMockId', undefined);
    });
    return session;
  },

  async answerQuestion(input) {
    const state = get();
    const session = state.sessions.find((s) => s.id === state.activeSessionId);
    if (!session) return null;
    const question = state.questions.find((q) => q.id === input.questionId);
    if (!question) return null;
    if (session.answers[input.questionId]) {
      return {
        correct: session.answers[input.questionId].correct,
        attemptId: '',
      };
    }

    const correct = input.selectedAnswer === question.correctAnswer;
    const at = nowISO();

    const attempt: Attempt = {
      id: uid('a'),
      questionId: question.id,
      selectedAnswer: input.selectedAnswer,
      correct,
      responseTimeMs: input.responseTimeMs,
      confidence: input.confidence,
      sessionId: session.id,
      attemptedAt: at,
    };

    const answer: SessionAnswer = {
      questionId: question.id,
      selectedAnswer: input.selectedAnswer,
      correct,
      responseTimeMs: input.responseTimeMs,
      confidence: input.confidence,
      answeredAt: at,
    };

    const updatedSession: StudySession = {
      ...session,
      answers: { ...session.answers, [question.id]: answer },
    };

    // A correct answer advances the review ladder; a wrong one waits for the
    // learner to classify it (몰랐음 / 헷갈림 / 실수) before being rescheduled.
    let reviews = state.reviews;
    const existing = state.reviews.find((r) => r.questionId === question.id);
    let reviewToPersist: ReviewItem | null = null;
    if (correct && existing && !existing.retired) {
      const next = scheduleAfterHit(existing);
      reviews = state.reviews.map((r) => (r.questionId === question.id ? next : r));
      reviewToPersist = next;
    }

    set({
      attempts: [...state.attempts, attempt],
      sessions: state.sessions.map((s) => (s.id === session.id ? updatedSession : s)),
      reviews,
    });

    await guard(set, async () => {
      await db.putAttempt(attempt);
      await db.putSession(updatedSession);
      if (reviewToPersist) await db.putReview(reviewToPersist);
    });

    return { correct, attemptId: attempt.id };
  },

  async classifyError(questionId, errorType) {
    const state = get();
    const session = state.sessions.find((s) => s.id === state.activeSessionId);
    const question = state.questions.find((q) => q.id === questionId);
    if (!question) return;

    const attempts = [...state.attempts];
    // Tag the most recent attempt on this question.
    for (let i = attempts.length - 1; i >= 0; i -= 1) {
      if (attempts[i].questionId === questionId) {
        attempts[i] = { ...attempts[i], errorType };
        break;
      }
    }
    const taggedAttempt = [...attempts].reverse().find((a) => a.questionId === questionId);

    const existing = state.reviews.find((r) => r.questionId === questionId);
    const review = scheduleAfterMiss(existing, {
      questionId,
      subject: question.subject,
      errorType,
    });
    const reviews = existing
      ? state.reviews.map((r) => (r.questionId === questionId ? review : r))
      : [...state.reviews, review];

    let sessions = state.sessions;
    let updatedSession: StudySession | null = null;
    if (session?.answers[questionId]) {
      updatedSession = {
        ...session,
        answers: {
          ...session.answers,
          [questionId]: { ...session.answers[questionId], errorType },
        },
      };
      sessions = state.sessions.map((s) => (s.id === session.id ? updatedSession! : s));
    }

    set({ attempts, reviews, sessions });
    await guard(set, async () => {
      if (taggedAttempt) await db.putAttempt(taggedAttempt);
      await db.putReview(review);
      if (updatedSession) await db.putSession(updatedSession);
    });
  },

  async advanceSession() {
    const state = get();
    const session = state.sessions.find((s) => s.id === state.activeSessionId);
    if (!session) return;
    const next = Math.min(session.cursor + 1, session.questionIds.length);
    const updated = { ...session, cursor: next };
    set({ sessions: state.sessions.map((s) => (s.id === session.id ? updated : s)) });
    await guard(set, () => db.putSession(updated));
  },

  async finishSession() {
    const state = get();
    const session = state.sessions.find((s) => s.id === state.activeSessionId);
    if (!session) {
      set({ activeSessionId: undefined });
      await guard(set, () => db.setMeta('activeSessionId', undefined));
      return;
    }
    const updated: StudySession = {
      ...session,
      finishedAt: session.finishedAt ?? nowISO(),
      cursor: session.questionIds.length,
    };
    set({
      sessions: state.sessions.map((s) => (s.id === session.id ? updated : s)),
      activeSessionId: undefined,
    });
    await guard(set, async () => {
      await db.putSession(updated);
      await db.setMeta('activeSessionId', undefined);
    });
  },

  async extendSession(count) {
    const state = get();
    const session = state.sessions.find((s) => s.id === state.activeSessionId);
    if (!session) return;
    const pool = practicePool(state.questions, state.preferences);
    const stats = buildStats(state.attempts);
    const reviews = new Map(state.reviews.map((r) => [r.questionId, r]));
    const extra = selectMixed({
      questions: pool,
      stats,
      reviews,
      count,
      exclude: new Set(session.questionIds),
    });
    if (!extra.length) return;
    const updated: StudySession = {
      ...session,
      questionIds: [...session.questionIds, ...extra.map((q) => q.id)],
      finishedAt: undefined,
    };
    set({ sessions: state.sessions.map((s) => (s.id === session.id ? updated : s)) });
    await guard(set, () => db.putSession(updated));
  },

  async retryWrong() {
    const state = get();
    const session = state.sessions.find((s) => s.id === state.activeSessionId);
    if (!session) return null;
    const wrongIds = Object.values(session.answers)
      .filter((a) => !a.correct)
      .map((a) => a.questionId);
    if (!wrongIds.length) return null;

    const retry: StudySession = {
      id: uid('s'),
      mode: session.mode,
      subject: session.subject,
      questionIds: wrongIds,
      cursor: 0,
      answers: {},
      startedAt: nowISO(),
    };
    set({ sessions: [...get().sessions, retry], activeSessionId: retry.id });
    await guard(set, async () => {
      await db.putSession(retry);
      await db.setMeta('activeSessionId', retry.id);
    });
    return retry;
  },

  async startMock(allowUnverified) {
    const state = get();
    const build = buildMock(state.questions, { allowUnverified });
    if (build.questionIds.length < TOTAL_QUESTIONS) {
      return { mock: null, shortfall: build.shortfall };
    }
    const startedAt = Date.now();
    const mock: MockExam = {
      id: uid('m'),
      questionIds: build.questionIds,
      answers: {},
      startedAt: new Date(startedAt).toISOString(),
      deadlineAt: new Date(startedAt + MOCK_DURATION_MS).toISOString(),
      allowedUnverified: allowUnverified,
    };
    set({ mocks: [...state.mocks, mock], activeMockId: mock.id, activeSessionId: undefined });
    await guard(set, async () => {
      await db.putMock(mock);
      await db.setMeta('activeMockId', mock.id);
      await db.setMeta('activeSessionId', undefined);
    });
    return { mock, shortfall: build.shortfall };
  },

  async answerMock(questionId, selectedAnswer) {
    const state = get();
    const mock = state.mocks.find((m) => m.id === state.activeMockId);
    if (!mock || mock.submittedAt) return;
    const updated: MockExam = {
      ...mock,
      answers: { ...mock.answers, [questionId]: selectedAnswer },
    };
    set({ mocks: state.mocks.map((m) => (m.id === mock.id ? updated : m)) });
    await guard(set, () => db.putMock(updated));
  },

  async submitMock() {
    const state = get();
    const mock = state.mocks.find((m) => m.id === state.activeMockId);
    if (!mock) return null;
    if (mock.submittedAt) return mock;

    const byId = new Map(state.questions.map((q) => [q.id, q]));
    const finishedAt = Date.now();
    const result = gradeMock(mock, byId, finishedAt);

    const attempts: Attempt[] = mock.questionIds.map((questionId) => {
      const question = byId.get(questionId);
      const selected = mock.answers[questionId];
      const answered = selected !== undefined && selected >= 0;
      return {
        id: uid('a'),
        questionId,
        selectedAnswer: answered ? selected : -1,
        correct: Boolean(question) && answered && selected === question!.correctAnswer,
        sessionId: mock.id,
        mock: true,
        attemptedAt: new Date(finishedAt).toISOString(),
      };
    });

    // Every mock miss enters the review queue as a knowledge gap; the learner
    // can re-classify it later from the wrong-answer screen.
    const reviewMap = new Map(state.reviews.map((r) => [r.questionId, r]));
    const newReviews: ReviewItem[] = [];
    for (const attempt of attempts) {
      if (attempt.correct) continue;
      const question = byId.get(attempt.questionId);
      if (!question) continue;
      const next = scheduleAfterMiss(reviewMap.get(attempt.questionId), {
        questionId: attempt.questionId,
        subject: question.subject,
        errorType: reviewMap.get(attempt.questionId)?.errorType ?? 'knowledge',
        now: finishedAt,
      });
      reviewMap.set(attempt.questionId, next);
      newReviews.push(next);
    }

    const updated: MockExam = {
      ...mock,
      submittedAt: new Date(finishedAt).toISOString(),
      result,
    };

    set({
      mocks: state.mocks.map((m) => (m.id === mock.id ? updated : m)),
      attempts: [...state.attempts, ...attempts],
      reviews: [...reviewMap.values()],
      activeMockId: undefined,
    });

    await guard(set, async () => {
      await db.putMock(updated);
      await db.putAttempts(attempts);
      await db.putReviews(newReviews);
      await db.setMeta('activeMockId', undefined);
    });

    return updated;
  },

  async addQuestions(incoming) {
    if (!incoming.length) return;
    const state = get();
    const map = new Map(state.questions.map((q) => [q.id, q]));
    incoming.forEach((q) => map.set(q.id, q));
    set({ questions: [...map.values()] });
    await guard(set, () => db.putQuestions(incoming));
  },

  async removeQuestions(ids) {
    if (!ids.length) return;
    const remove = new Set(ids);
    const state = get();
    set({ questions: state.questions.filter((q) => !remove.has(q.id)) });
    await guard(set, () => db.deleteQuestions(ids));
  },

  async saveNote(input) {
    const state = get();
    const at = nowISO();
    const existing = input.id ? state.notes.find((n) => n.id === input.id) : undefined;
    const note: ConceptNote = {
      id: existing?.id ?? uid('n'),
      subject: input.subject,
      topic: input.topic,
      tags: input.tags,
      body: input.body,
      createdAt: existing?.createdAt ?? at,
      updatedAt: at,
    };
    set({
      notes: existing
        ? state.notes.map((n) => (n.id === note.id ? note : n))
        : [...state.notes, note],
    });
    await guard(set, () => db.putNote(note));
  },

  async removeNote(id) {
    set({ notes: get().notes.filter((n) => n.id !== id) });
    await guard(set, () => db.deleteNote(id));
  },

  async setPreferences(patch) {
    const preferences = { ...get().preferences, ...patch };
    set({ preferences });
    await guard(set, () => db.setMeta('preferences', preferences));
  },

  async restore(payload) {
    set({
      questions: payload.questions,
      attempts: payload.attempts,
      reviews: payload.reviews,
      sessions: payload.sessions,
      mocks: payload.mocks,
      notes: payload.notes,
      preferences: { ...DEFAULT_PREFERENCES, ...payload.preferences },
      activeSessionId: undefined,
      activeMockId: undefined,
    });
    await guard(set, async () => {
      await db.clearEverything();
      await db.putQuestions(payload.questions);
      await db.putAttempts(payload.attempts);
      await db.putReviews(payload.reviews);
      for (const session of payload.sessions) await db.putSession(session);
      for (const mock of payload.mocks) await db.putMock(mock);
      for (const note of payload.notes) await db.putNote(note);
      await db.setMeta('preferences', { ...DEFAULT_PREFERENCES, ...payload.preferences });
      await db.setMeta(SEEDED_KEY, true);
    });
  },

  async resetProgress() {
    set({
      attempts: [],
      reviews: [],
      sessions: [],
      mocks: [],
      activeSessionId: undefined,
      activeMockId: undefined,
    });
    await guard(set, () => db.clearProgress());
  },

  async resetEverything() {
    set({
      questions: [],
      attempts: [],
      reviews: [],
      sessions: [],
      mocks: [],
      notes: [],
      preferences: { ...DEFAULT_PREFERENCES },
      activeSessionId: undefined,
      activeMockId: undefined,
    });
    await guard(set, async () => {
      await db.clearEverything();
      await db.setMeta(SEEDED_KEY, true);
    });
  },
}));

async function runBoot(
  set: (patch: Partial<StoreState>) => void,
  get: () => StoreState,
): Promise<void> {
  if (!db.hasIndexedDB()) {
    set({
      ready: true,
      bootError:
        '이 브라우저에서는 저장소(IndexedDB)를 사용할 수 없습니다. 학습 기록이 저장되지 않습니다.',
      questions: SAMPLE_QUESTIONS,
    });
    return;
  }

  try {
    const snapshot = await db.loadSnapshot();
    let questions = snapshot.questions;

    // Seed the fictional development samples exactly once, so a learner who
    // deletes them does not get them back on the next launch.
    const seeded = await (await db.getDB()).get('meta', SEEDED_KEY);
    if (!seeded && questions.length === 0) {
      await db.putQuestions(SAMPLE_QUESTIONS);
      await db.setMeta(SEEDED_KEY, true);
      questions = SAMPLE_QUESTIONS;
    }

    set({
      ready: true,
      bootError: null,
      questions,
      attempts: snapshot.attempts,
      reviews: snapshot.reviews,
      sessions: snapshot.sessions,
      mocks: snapshot.mocks,
      notes: snapshot.notes,
      preferences: { ...DEFAULT_PREFERENCES, ...(snapshot.preferences ?? {}) },
      activeSessionId: snapshot.activeSessionId,
      activeMockId: snapshot.activeMockId,
    });
  } catch (error) {
    // A blocked or corrupt database must still leave a usable app.
    set({
      ready: true,
      bootError:
        error instanceof Error
          ? `저장소를 열지 못했습니다: ${error.message}`
          : '저장소를 열지 못했습니다',
      questions: get().questions.length ? get().questions : SAMPLE_QUESTIONS,
    });
  }
}
