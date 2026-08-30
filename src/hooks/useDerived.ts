import { useMemo } from 'react';
import { useStore } from '../lib/store';
import { dday, isFinalReviewActive, isValidISODate, seoulToday } from '../lib/date';
import { estimatePractice, expectedCounts } from '../lib/estimate';
import { analyseWeakness } from '../lib/weakness';
import { practicePool } from '../lib/pool';
import type { Subject } from '../lib/exam';
import type { Question } from '../lib/types';

/** The single "what day is it" answer, honouring the date-simulation preference. */
export function useToday(): string {
  const simulated = useStore((s) => s.preferences.simulatedDate);
  return useMemo(() => {
    if (simulated && isValidISODate(simulated)) return simulated;
    return seoulToday();
  }, [simulated]);
}

export function useDDay() {
  const today = useToday();
  return useMemo(() => dday(today), [today]);
}

export function useFinalReview(): boolean {
  const today = useToday();
  return useMemo(() => isFinalReviewActive(today), [today]);
}

export function useQuestionsById(): Map<string, Question> {
  const questions = useStore((s) => s.questions);
  return useMemo(() => new Map(questions.map((q) => [q.id, q])), [questions]);
}

export function useEstimate() {
  const attempts = useStore((s) => s.attempts);
  const byId = useQuestionsById();
  return useMemo(() => estimatePractice(attempts, byId), [attempts, byId]);
}

export function useWeakness() {
  const attempts = useStore((s) => s.attempts);
  const reviews = useStore((s) => s.reviews);
  const byId = useQuestionsById();
  const today = useToday();
  return useMemo(
    () => analyseWeakness(attempts, byId, reviews, { todayISO: today }),
    [attempts, byId, reviews, today],
  );
}

export function useExpectedCounts() {
  const estimate = useEstimate();
  return useMemo(() => expectedCounts(estimate), [estimate]);
}

/** Questions available to normal practice, plus per-subject counts for empty states. */
export function usePracticePool() {
  const questions = useStore((s) => s.questions);
  const preferences = useStore((s) => s.preferences);
  return useMemo(() => {
    const pool = practicePool(questions, preferences);
    const counts = { history: 0, resources: 0, law: 0, tourism: 0 } as Record<Subject, number>;
    for (const q of pool) counts[q.subject] += 1;
    return { pool, counts, total: pool.length };
  }, [questions, preferences]);
}

export function useVerifiedCounts() {
  const questions = useStore((s) => s.questions);
  return useMemo(() => {
    const counts = { history: 0, resources: 0, law: 0, tourism: 0 } as Record<Subject, number>;
    let total = 0;
    for (const q of questions) {
      if (q.verificationStatus === 'verified') {
        counts[q.subject] += 1;
        total += 1;
      }
    }
    return { counts, total };
  }, [questions]);
}

export function useActiveSession() {
  const activeSessionId = useStore((s) => s.activeSessionId);
  const sessions = useStore((s) => s.sessions);
  return useMemo(
    () => sessions.find((s) => s.id === activeSessionId),
    [sessions, activeSessionId],
  );
}

export function useActiveMock() {
  const activeMockId = useStore((s) => s.activeMockId);
  const mocks = useStore((s) => s.mocks);
  return useMemo(() => mocks.find((m) => m.id === activeMockId), [mocks, activeMockId]);
}
