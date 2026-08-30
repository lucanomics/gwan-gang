import { SUBJECTS, SUBJECT_META, type Subject } from './exam';
import { isDue } from './review';
import type { Attempt, Question, ReviewItem } from './types';

/** Rolled-up per-question history, rebuilt from the attempt log. */
export interface QuestionStats {
  exposures: number;
  wrong: number;
  lastAttemptAt: number | null;
  lastCorrect: boolean | null;
  lastErrorType: Attempt['errorType'];
  lastConfidence: Attempt['confidence'];
}

export const EMPTY_STATS: QuestionStats = {
  exposures: 0,
  wrong: 0,
  lastAttemptAt: null,
  lastCorrect: null,
  lastErrorType: undefined,
  lastConfidence: undefined,
};

export function buildStats(attempts: Attempt[]): Map<string, QuestionStats> {
  const map = new Map<string, QuestionStats>();
  for (const attempt of attempts) {
    const at = Date.parse(attempt.attemptedAt);
    const current = map.get(attempt.questionId) ?? { ...EMPTY_STATS };
    current.exposures += 1;
    if (!attempt.correct) current.wrong += 1;
    if (current.lastAttemptAt === null || at >= current.lastAttemptAt) {
      current.lastAttemptAt = Number.isNaN(at) ? current.lastAttemptAt : at;
      current.lastCorrect = attempt.correct;
      current.lastErrorType = attempt.errorType;
      current.lastConfidence = attempt.confidence;
    }
    map.set(attempt.questionId, current);
  }
  return map;
}

/** Discrimination errors ("헷갈림") are the most valuable thing to re-drill. */
export const ERROR_MULTIPLIER = {
  knowledge: 1.5,
  confusion: 1.8,
  mistake: 0.8,
} as const;

const CONFIDENCE_MULTIPLIER = {
  guess: 1.4,
  unsure: 1.25,
  know: 0.9,
} as const;

const HOUR = 3_600_000;
/** A question answered inside this window is held back unless nothing else is left. */
export const COOLDOWN_MS = 15 * 60_000;

export interface PriorityBreakdown {
  weakness: number;
  recency: number;
  subject: number;
  error: number;
  uncertainty: number;
  reviewDue: number;
  exposureDamping: number;
  priority: number;
}

/**
 * Explainable heuristic priority. Every factor is a plain multiplier so the
 * "why am I seeing this" panel can print the same numbers the engine used.
 */
export function priorityOf(
  question: Question,
  stats: QuestionStats,
  review: ReviewItem | undefined,
  now: number,
): PriorityBreakdown {
  const seen = stats.exposures > 0;
  const wrongRatio = seen ? stats.wrong / stats.exposures : 0;
  const weakness = seen ? 0.6 + 2.4 * wrongRatio : 1;

  let recency = 1.2;
  if (seen && stats.lastAttemptAt !== null) {
    const hours = Math.max(0, (now - stats.lastAttemptAt) / HOUR);
    recency = 0.25 + 1.25 * Math.min(1, hours / 48);
  }

  const subject = SUBJECT_META[question.subject].drillMultiplier;

  const error =
    stats.lastCorrect === false && stats.lastErrorType
      ? ERROR_MULTIPLIER[stats.lastErrorType]
      : 1;

  const uncertainty = stats.lastConfidence
    ? CONFIDENCE_MULTIPLIER[stats.lastConfidence]
    : 1;

  let reviewDue = 1;
  if (review) {
    if (review.retired) reviewDue = 0.6;
    else if (isDue(review, now)) reviewDue = 2.5;
    else reviewDue = 0.8;
  }

  const exposureDamping = 1 / (1 + 0.12 * Math.max(0, stats.exposures - 1));

  const priority =
    weakness * recency * subject * error * uncertainty * reviewDue * exposureDamping;

  return { weakness, recency, subject, error, uncertainty, reviewDue, exposureDamping, priority };
}

export interface SelectionContext {
  questions: Question[];
  stats: Map<string, QuestionStats>;
  reviews: Map<string, ReviewItem>;
  now?: number;
  /** Ids to never return (already queued in the current session). */
  exclude?: ReadonlySet<string>;
  random?: () => number;
}

interface Scored {
  question: Question;
  priority: number;
  cooling: boolean;
}

function score(ctx: SelectionContext, pool: Question[]): Scored[] {
  const now = ctx.now ?? Date.now();
  return pool.map((question) => {
    const stats = ctx.stats.get(question.id) ?? EMPTY_STATS;
    const { priority } = priorityOf(question, stats, ctx.reviews.get(question.id), now);
    const cooling =
      stats.lastAttemptAt !== null && now - stats.lastAttemptAt < COOLDOWN_MS;
    return { question, priority, cooling };
  });
}

/** Priority-weighted sampling without replacement — high priority wins, but not every time. */
function sample(items: Scored[], count: number, random: () => number): Question[] {
  const pool = [...items];
  const picked: Question[] = [];
  while (picked.length < count && pool.length > 0) {
    const total = pool.reduce((sum, item) => sum + Math.max(item.priority, 0.0001), 0);
    let roll = random() * total;
    let index = pool.length - 1;
    for (let i = 0; i < pool.length; i += 1) {
      roll -= Math.max(pool[i].priority, 0.0001);
      if (roll <= 0) {
        index = i;
        break;
      }
    }
    picked.push(pool[index].question);
    pool.splice(index, 1);
  }
  return picked;
}

/**
 * Mixed-session subject quotas.
 *
 * 관광국사 gets roughly 35% of a mixed session (3-4 of 10) because it is worth
 * double, and the weakest remaining subject gets the largest share of the rest —
 * but every subject with content still appears, so a session never collapses
 * onto one topic.
 */
export function subjectQuotas(
  count: number,
  available: Record<Subject, number>,
  accuracy: Partial<Record<Subject, number | null>> = {},
): Record<Subject, number> {
  const quotas: Record<Subject, number> = { history: 0, resources: 0, law: 0, tourism: 0 };
  const capacity = (s: Subject) => Math.max(0, available[s] ?? 0);
  const withContent = SUBJECTS.filter((s) => capacity(s) > 0);
  if (!withContent.length || count <= 0) return quotas;

  let remaining = Math.min(count, withContent.reduce((sum, s) => sum + capacity(s), 0));

  if (withContent.includes('history')) {
    const target = Math.min(
      Math.max(1, Math.round(count * 0.35)),
      capacity('history'),
      remaining,
    );
    quotas.history = target;
    remaining -= target;
  }

  const others = withContent.filter((s) => s !== 'history');
  if (others.length && remaining > 0) {
    // Weaker subject -> bigger weight. Unknown accuracy is treated as mid-range.
    const weights = others.map((s) => {
      const acc = accuracy[s];
      const gap = acc === null || acc === undefined ? 0.4 : 1 - acc;
      return 1 + 1.6 * gap;
    });
    const total = weights.reduce((a, b) => a + b, 0);
    const raw = others.map((_, i) => (remaining * weights[i]) / total);
    const floors = raw.map((v) => Math.floor(v));

    others.forEach((s, i) => {
      quotas[s] = Math.min(floors[i], capacity(s));
    });
    let assigned = others.reduce((sum, s) => sum + quotas[s], 0);

    const order = others
      .map((s, i) => ({ s, frac: raw[i] - floors[i] }))
      .sort((a, b) => b.frac - a.frac);
    let guard = 0;
    while (assigned < remaining && guard < 64) {
      let moved = false;
      for (const { s } of order) {
        if (assigned >= remaining) break;
        if (quotas[s] < capacity(s)) {
          quotas[s] += 1;
          assigned += 1;
          moved = true;
        }
      }
      if (!moved) break;
      guard += 1;
    }
    remaining -= assigned;
  }

  // Anything left over (a subject ran out of questions) goes back to whoever has room.
  let guard = 0;
  while (remaining > 0 && guard < 64) {
    let moved = false;
    for (const s of withContent) {
      if (remaining <= 0) break;
      if (quotas[s] < capacity(s)) {
        quotas[s] += 1;
        remaining -= 1;
        moved = true;
      }
    }
    if (!moved) break;
    guard += 1;
  }

  return quotas;
}

export interface MixedSelectionOptions extends SelectionContext {
  count: number;
  accuracy?: Partial<Record<Subject, number | null>>;
}

/** Balanced, adaptive multi-subject session (Quick 5 / Quick 10). */
export function selectMixed(options: MixedSelectionOptions): Question[] {
  const random = options.random ?? Math.random;
  const exclude = options.exclude ?? new Set<string>();
  const pool = options.questions.filter((q) => !exclude.has(q.id));
  if (!pool.length) return [];

  const scored = score(options, pool);
  const bySubject = new Map<Subject, Scored[]>();
  for (const item of scored) {
    const list = bySubject.get(item.question.subject) ?? [];
    list.push(item);
    bySubject.set(item.question.subject, list);
  }

  const available = { history: 0, resources: 0, law: 0, tourism: 0 } as Record<Subject, number>;
  for (const subject of SUBJECTS) available[subject] = bySubject.get(subject)?.length ?? 0;

  const quotas = subjectQuotas(options.count, available, options.accuracy ?? {});
  const picked: Question[] = [];

  for (const subject of SUBJECTS) {
    const quota = quotas[subject];
    if (quota <= 0) continue;
    const list = bySubject.get(subject) ?? [];
    picked.push(...pickFrom(list, quota, random));
  }

  // Top up if a subject came up short.
  if (picked.length < options.count) {
    const chosen = new Set(picked.map((q) => q.id));
    const rest = scored.filter((item) => !chosen.has(item.question.id));
    picked.push(...pickFrom(rest, options.count - picked.length, random));
  }

  return shuffle(picked, random).slice(0, options.count);
}

function pickFrom(list: Scored[], count: number, random: () => number): Question[] {
  if (count <= 0 || !list.length) return [];
  const fresh = list.filter((item) => !item.cooling);
  const usable = fresh.length >= count ? fresh : list;
  const ranked = [...usable].sort((a, b) => b.priority - a.priority);
  // Sample from a widened head of the ranking so sessions never repeat verbatim.
  const head = ranked.slice(0, Math.max(count * 3, count + 4));
  return sample(head, count, random);
}

/** Single-subject drill (Subject 25). */
export function selectBySubject(
  options: SelectionContext & { subject: Subject; count: number },
): Question[] {
  const random = options.random ?? Math.random;
  const exclude = options.exclude ?? new Set<string>();
  const pool = options.questions.filter(
    (q) => q.subject === options.subject && !exclude.has(q.id),
  );
  return pickFrom(score(options, pool), options.count, random);
}

/** Wrong-answer review: due items first, then the rest of the open queue. */
export function selectReview(
  options: SelectionContext & {
    count: number;
    errorType?: Attempt['errorType'];
    subject?: Subject;
    dueOnly?: boolean;
  },
): Question[] {
  const now = options.now ?? Date.now();
  const byId = new Map(options.questions.map((q) => [q.id, q]));
  const exclude = options.exclude ?? new Set<string>();

  const open = [...options.reviews.values()].filter((item) => {
    if (item.retired) return false;
    if (exclude.has(item.questionId)) return false;
    if (options.errorType && item.errorType !== options.errorType) return false;
    if (options.subject && item.subject !== options.subject) return false;
    if (options.dueOnly && !isDue(item, now)) return false;
    return byId.has(item.questionId);
  });

  open.sort((a, b) => {
    const dueA = isDue(a, now) ? 0 : 1;
    const dueB = isDue(b, now) ? 0 : 1;
    if (dueA !== dueB) return dueA - dueB;
    return Date.parse(a.dueAt) - Date.parse(b.dueAt);
  });

  const result: Question[] = [];
  for (const item of open) {
    const question = byId.get(item.questionId);
    if (question) result.push(question);
    if (result.length >= options.count) break;
  }
  return result;
}

/** VS / discrimination drill: questions that carry an explicit confusion pair. */
export function selectConfusion(
  options: SelectionContext & { count: number },
): Question[] {
  const random = options.random ?? Math.random;
  const exclude = options.exclude ?? new Set<string>();
  const pool = options.questions.filter(
    (q) => !exclude.has(q.id) && (q.confusionPair?.length ?? 0) > 0,
  );
  return pickFrom(score(options, pool), options.count, random);
}

export function shuffle<T>(items: T[], random: () => number = Math.random): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}
