import clsx from 'clsx';
import { Check, X } from 'lucide-react';

export interface ChoiceListProps {
  choices: string[];
  selected: number | null;
  correctAnswer: number;
  revealed: boolean;
  onSelect: (index: number) => void;
  showShortcuts: boolean;
}

/**
 * Correctness is never communicated by colour alone — every state also carries
 * an icon and a text label for screen readers.
 */
export function ChoiceList({
  choices,
  selected,
  correctAnswer,
  revealed,
  onSelect,
  showShortcuts,
}: ChoiceListProps) {
  return (
    <ul className="space-y-2">
      {choices.map((choice, index) => {
        const isCorrect = index === correctAnswer;
        const isPicked = index === selected;
        const state = !revealed
          ? 'idle'
          : isCorrect
            ? 'correct'
            : isPicked
              ? 'wrong'
              : 'muted';

        return (
          <li key={index}>
            <button
              type="button"
              disabled={revealed}
              onClick={() => onSelect(index)}
              aria-pressed={isPicked}
              className={clsx(
                'tap flex w-full items-start gap-3 rounded-xl border p-3 text-left text-[15px] leading-relaxed transition-colors',
                state === 'idle' &&
                  'border-ink-200 bg-white hover:border-brand-400 hover:bg-brand-50 active:bg-brand-100 dark:border-ink-700 dark:bg-ink-900 dark:hover:border-brand-500 dark:hover:bg-brand-500/10',
                state === 'correct' &&
                  'border-emerald-500 bg-emerald-50 text-emerald-900 dark:bg-emerald-500/15 dark:text-emerald-100',
                state === 'wrong' &&
                  'border-rose-500 bg-rose-50 text-rose-900 dark:bg-rose-500/15 dark:text-rose-100',
                state === 'muted' &&
                  'border-ink-200 bg-ink-50 text-ink-500 dark:border-ink-800 dark:bg-ink-900/60 dark:text-ink-400',
              )}
            >
              <span
                aria-hidden
                className={clsx(
                  'mt-0.5 flex h-6 w-6 flex-none items-center justify-center rounded-full text-xs font-black',
                  state === 'correct' && 'bg-emerald-600 text-white',
                  state === 'wrong' && 'bg-rose-600 text-white',
                  (state === 'idle' || state === 'muted') &&
                    'bg-ink-200 text-ink-600 dark:bg-ink-700 dark:text-ink-200',
                )}
              >
                {state === 'correct' ? (
                  <Check className="h-4 w-4" strokeWidth={3} />
                ) : state === 'wrong' ? (
                  <X className="h-4 w-4" strokeWidth={3} />
                ) : (
                  index + 1
                )}
              </span>
              <span className="flex-1">{choice}</span>
              {revealed && (isCorrect || isPicked) ? (
                <span
                  className={clsx(
                    'mt-0.5 flex-none text-[11px] font-bold',
                    isCorrect ? 'text-emerald-700 dark:text-emerald-300' : 'text-rose-700 dark:text-rose-300',
                  )}
                >
                  {isCorrect ? '정답' : '내 답'}
                </span>
              ) : null}
              {!revealed && showShortcuts ? (
                <kbd className="mt-0.5 hidden flex-none rounded border border-ink-300 px-1 text-[10px] text-ink-400 sm:block dark:border-ink-700">
                  {index + 1}
                </kbd>
              ) : null}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
