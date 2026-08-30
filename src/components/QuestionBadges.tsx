import { AlertTriangle, ShieldCheck } from 'lucide-react';
import { Chip } from './ui';
import { SOURCE_LABEL, type Question } from '../lib/types';
import { SUBJECT_META } from '../lib/exam';

const SOURCE_TONE: Record<Question['sourceType'], string> = {
  'official-past-exam': 'bg-brand-500/12 text-brand-700 ring-brand-500/30 dark:text-brand-300',
  'public-official': 'bg-emerald-500/12 text-emerald-700 ring-emerald-500/30 dark:text-emerald-300',
  'user-authored': 'bg-ink-500/10 text-ink-600 ring-ink-500/25 dark:text-ink-300',
  'ai-generated': 'bg-violet-500/12 text-violet-700 ring-violet-500/30 dark:text-violet-300',
  licensed: 'bg-amber-500/12 text-amber-700 ring-amber-500/30 dark:text-amber-300',
  sample: 'bg-orange-500/12 text-orange-700 ring-orange-500/30 dark:text-orange-300',
};

/**
 * Provenance is never optional and never hidden: every place a question is
 * shown, the learner can see where it came from and whether it is verified.
 */
export function QuestionBadges({ question, showSubject = true }: { question: Question; showSubject?: boolean }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {showSubject ? (
        <Chip tone="bg-ink-900/5 text-ink-700 ring-ink-900/10 dark:bg-white/5 dark:text-ink-200 dark:ring-white/10">
          {SUBJECT_META[question.subject].name}
        </Chip>
      ) : null}
      {question.topic ? (
        <Chip tone="bg-ink-500/10 text-ink-500 ring-ink-500/20 dark:text-ink-400">
          {question.topic}
        </Chip>
      ) : null}
      <Chip tone={SOURCE_TONE[question.sourceType]}>{SOURCE_LABEL[question.sourceType]}</Chip>
      {question.verificationStatus === 'verified' ? (
        <Chip tone="bg-emerald-500/12 text-emerald-700 ring-emerald-500/30 dark:text-emerald-300">
          <ShieldCheck aria-hidden className="h-3 w-3" />
          검증됨
        </Chip>
      ) : (
        <Chip tone="bg-amber-500/12 text-amber-700 ring-amber-500/30 dark:text-amber-300">
          <AlertTriangle aria-hidden className="h-3 w-3" />
          미검증
        </Chip>
      )}
    </div>
  );
}
