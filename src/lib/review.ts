import type { ErrorType, ReviewItem, Subject } from './types';

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/**
 * Six-day cram ladder, not a long-term SRS.
 *
 * "헷갈림" comes back fastest because discrimination decays fastest;
 * "실수" only needs one look the next day.
 */
export const REVIEW_LADDER: Record<ErrorType, number[]> = {
  knowledge: [10 * MINUTE, 6 * HOUR, DAY, 2 * DAY],
  confusion: [5 * MINUTE, 3 * HOUR, DAY, 2 * DAY],
  mistake: [DAY, 2 * DAY],
};

export function intervalFor(errorType: ErrorType, stage: number): number {
  const ladder = REVIEW_LADDER[errorType];
  const index = Math.min(Math.max(stage, 0), ladder.length - 1);
  return ladder[index];
}

/** Whether a stage has walked off the end of the ladder — the item is learned for now. */
export function isLadderComplete(errorType: ErrorType, stage: number): boolean {
  return stage >= REVIEW_LADDER[errorType].length;
}

/** A miss (first or repeat) resets the item to the start of its ladder. */
export function scheduleAfterMiss(
  existing: ReviewItem | undefined,
  params: { questionId: string; subject: Subject; errorType: ErrorType; now?: number },
): ReviewItem {
  const now = params.now ?? Date.now();
  return {
    questionId: params.questionId,
    subject: params.subject,
    stage: 0,
    errorType: params.errorType,
    dueAt: new Date(now + intervalFor(params.errorType, 0)).toISOString(),
    lastReviewedAt: new Date(now).toISOString(),
    streak: 0,
    lapses: (existing?.lapses ?? 0) + 1,
    retired: false,
  };
}

/** A correct recall advances one rung; walking off the end retires the item. */
export function scheduleAfterHit(item: ReviewItem, now: number = Date.now()): ReviewItem {
  const nextStage = item.stage + 1;
  const complete = isLadderComplete(item.errorType, nextStage);
  return {
    ...item,
    stage: nextStage,
    streak: item.streak + 1,
    lastReviewedAt: new Date(now).toISOString(),
    dueAt: complete
      ? new Date(now + 7 * DAY).toISOString()
      : new Date(now + intervalFor(item.errorType, nextStage)).toISOString(),
    retired: complete,
  };
}

export function isDue(item: ReviewItem, now: number = Date.now()): boolean {
  if (item.retired) return false;
  const due = Date.parse(item.dueAt);
  return Number.isNaN(due) ? true : due <= now;
}

/** Due items, most overdue first. */
export function dueReviews(items: ReviewItem[], now: number = Date.now()): ReviewItem[] {
  return items
    .filter((item) => isDue(item, now))
    .sort((a, b) => Date.parse(a.dueAt) - Date.parse(b.dueAt));
}

/** Everything still on a ladder, whether or not it is due yet. */
export function openReviews(items: ReviewItem[]): ReviewItem[] {
  return items.filter((item) => !item.retired);
}
