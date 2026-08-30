import { SUBJECTS, SUBJECT_META, type Subject } from './exam';
import { seoulDateOf } from './date';
import { isDue } from './review';
import type { Attempt, ErrorType, Question, ReviewItem } from './types';

export interface TopicStat {
  subject: Subject;
  topic: string;
  attempts: number;
  wrong: number;
  accuracy: number;
  /** wrong count weighted by subject value — what actually costs points. */
  cost: number;
}

export interface WeaknessReport {
  topics: TopicStat[];
  errorDistribution: Record<ErrorType, number>;
  confusionPairs: string[];
  recentWrong: { question: Question; attemptedAt: string; errorType?: ErrorType }[];
  dueCount: number;
  openReviewCount: number;
  todayCount: number;
  todayCorrect: number;
}

const UNTAGGED = '기타';

export function analyseWeakness(
  attempts: Attempt[],
  questionsById: Map<string, Question>,
  reviews: ReviewItem[],
  options: { now?: number; todayISO?: string; recentWrongLimit?: number } = {},
): WeaknessReport {
  const now = options.now ?? Date.now();
  const limit = options.recentWrongLimit ?? 12;

  const topicMap = new Map<string, TopicStat>();
  const errorDistribution: Record<ErrorType, number> = {
    knowledge: 0,
    confusion: 0,
    mistake: 0,
  };
  const confusion = new Set<string>();
  const recentWrong: WeaknessReport['recentWrong'] = [];

  let todayCount = 0;
  let todayCorrect = 0;

  const ordered = [...attempts].sort(
    (a, b) => Date.parse(b.attemptedAt) - Date.parse(a.attemptedAt),
  );

  for (const attempt of ordered) {
    const question = questionsById.get(attempt.questionId);
    if (!question) continue;

    if (options.todayISO && seoulDateOf(attempt.attemptedAt) === options.todayISO) {
      todayCount += 1;
      if (attempt.correct) todayCorrect += 1;
    }

    const topic = question.topic?.trim() || question.chapter?.trim() || UNTAGGED;
    const key = `${question.subject}::${topic}`;
    const stat = topicMap.get(key) ?? {
      subject: question.subject,
      topic,
      attempts: 0,
      wrong: 0,
      accuracy: 0,
      cost: 0,
    };
    stat.attempts += 1;
    if (!attempt.correct) stat.wrong += 1;
    stat.accuracy = (stat.attempts - stat.wrong) / stat.attempts;
    stat.cost = stat.wrong * SUBJECT_META[question.subject].pointsPerCorrect;
    topicMap.set(key, stat);

    if (!attempt.correct) {
      if (attempt.errorType) errorDistribution[attempt.errorType] += 1;
      question.confusionPair?.forEach((pair) => confusion.add(pair));
      if (
        recentWrong.length < limit &&
        !recentWrong.some((r) => r.question.id === question.id)
      ) {
        recentWrong.push({
          question,
          attemptedAt: attempt.attemptedAt,
          errorType: attempt.errorType,
        });
      }
    }
  }

  const topics = [...topicMap.values()]
    .filter((t) => t.attempts >= 2 && t.wrong > 0)
    .sort((a, b) => b.cost - a.cost || a.accuracy - b.accuracy);

  return {
    topics,
    errorDistribution,
    confusionPairs: [...confusion].slice(0, 20),
    recentWrong,
    dueCount: reviews.filter((r) => isDue(r, now)).length,
    openReviewCount: reviews.filter((r) => !r.retired).length,
    todayCount,
    todayCorrect,
  };
}

/** Subjects ordered from weakest to strongest by expected correct answers. */
export function weakestSubjects(
  expected: Partial<Record<Subject, number | null>>,
): Subject[] {
  return [...SUBJECTS].sort((a, b) => {
    const va = expected[a] ?? -1;
    const vb = expected[b] ?? -1;
    return va - vb;
  });
}
