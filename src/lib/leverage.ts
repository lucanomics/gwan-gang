import { SUBJECTS, SUBJECT_CUTOFF_CORRECT, SUBJECT_META, type Subject } from './exam';
import { weightedScore, type SubjectCounts } from './scoring';

export interface LeverageMove {
  subject: Subject;
  count: number;
  /** True when this move exists to clear a 과락, not to add points. */
  mandatory: boolean;
}

export interface LeveragePlan {
  target: number;
  /** Weighted points still missing. 0 when the target is already met. */
  gap: number;
  reached: boolean;
  /** Ranked equivalent ways to close the gap, cheapest in questions first. */
  options: LeverageMove[][];
  /** Subjects that must be lifted to 10/25 whatever the total says. */
  cutoffFixes: LeverageMove[];
}

const MAX_EXTRA_PER_SUBJECT = 10;
const MAX_OPTIONS = 3;

function headroom(subject: Subject, current: number): number {
  return Math.max(0, Math.floor(SUBJECT_META[subject].questionCount - current));
}

/**
 * Pure arithmetic: how many more correct answers, and where, reach a target score.
 * It says nothing about whether the learner *will* get them right.
 */
export function leverageTo(current: SubjectCounts, target: number): LeveragePlan {
  const base = weightedScore(current);

  const cutoffFixes: LeverageMove[] = [];
  const afterFixes: SubjectCounts = { ...current };
  for (const subject of SUBJECTS) {
    const short = SUBJECT_CUTOFF_CORRECT - current[subject];
    if (short > 0) {
      const count = Math.min(Math.ceil(short), headroom(subject, current[subject]));
      if (count > 0) {
        cutoffFixes.push({ subject, count, mandatory: true });
        afterFixes[subject] = current[subject] + count;
      }
    }
  }

  const scoreAfterFixes = weightedScore(afterFixes);
  const gap = Math.max(0, Math.round((target - base) * 10) / 10);
  if (base >= target) {
    return { target, gap: 0, reached: true, options: [], cutoffFixes };
  }

  const remaining = Math.max(0, Math.round((target - scoreAfterFixes) * 10) / 10);
  const candidates: { moves: LeverageMove[]; questions: number; points: number }[] = [];

  const limits = SUBJECTS.map((s) =>
    Math.min(MAX_EXTRA_PER_SUBJECT, headroom(s, afterFixes[s])),
  );

  const counts = [0, 0, 0, 0];
  const walk = (index: number) => {
    if (index === SUBJECTS.length) {
      const questions = counts.reduce((a, b) => a + b, 0);
      if (questions === 0) return;
      let points = 0;
      SUBJECTS.forEach((s, i) => {
        points += counts[i] * SUBJECT_META[s].pointsPerCorrect;
      });
      points = Math.round(points * 10) / 10;
      if (points < remaining) return;
      // Reject padded plans: dropping any single question must break the target.
      const minimal = SUBJECTS.every((s, i) => {
        if (counts[i] === 0) return true;
        return Math.round((points - SUBJECT_META[s].pointsPerCorrect) * 10) / 10 < remaining;
      });
      if (!minimal) return;
      const moves: LeverageMove[] = [];
      SUBJECTS.forEach((s, i) => {
        if (counts[i] > 0) moves.push({ subject: s, count: counts[i], mandatory: false });
      });
      candidates.push({ moves, questions, points });
      return;
    }
    for (let n = 0; n <= limits[index]; n += 1) {
      counts[index] = n;
      walk(index + 1);
    }
    counts[index] = 0;
  };
  walk(0);

  candidates.sort((a, b) => {
    if (a.questions !== b.questions) return a.questions - b.questions;
    // Prefer plans spread over fewer subjects — easier to act on.
    if (a.moves.length !== b.moves.length) return a.moves.length - b.moves.length;
    return a.points - b.points;
  });

  const seen = new Set<string>();
  const options: LeverageMove[][] = [];
  for (const candidate of candidates) {
    const key = candidate.moves.map((m) => `${m.subject}:${m.count}`).join('|');
    if (seen.has(key)) continue;
    seen.add(key);
    options.push(candidate.moves);
    if (options.length >= MAX_OPTIONS) break;
  }

  return { target, gap, reached: false, options, cutoffFixes };
}

export function describeMoves(moves: LeverageMove[]): string {
  return moves
    .map((m) => `${SUBJECT_META[m.subject].short} +${m.count}`)
    .join(' · ');
}
