import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import clsx from 'clsx';
import { Button, Card, Chip, EmptyState, LinkButton, SectionTitle } from '../components/ui';
import { QuestionBadges } from '../components/QuestionBadges';
import { useStore } from '../lib/store';
import { useQuestionsById } from '../hooks/useDerived';
import { isDue } from '../lib/review';
import { relativeFromNow } from '../lib/date';
import { SUBJECT_META, SUBJECTS, type Subject } from '../lib/exam';
import { ERROR_TYPE_LABEL, type ErrorType } from '../lib/types';

type Filter = 'due' | 'all' | ErrorType | Subject;

const ERROR_FILTERS: ErrorType[] = ['knowledge', 'confusion', 'mistake'];

export default function WrongPage() {
  const navigate = useNavigate();
  const reviews = useStore((s) => s.reviews);
  const startSession = useStore((s) => s.startSession);
  const byId = useQuestionsById();
  const [filter, setFilter] = useState<Filter>('due');
  const [busy, setBusy] = useState(false);

  const now = Date.now();

  const open = useMemo(
    () => reviews.filter((r) => !r.retired && byId.has(r.questionId)),
    [byId, reviews],
  );
  const dueCount = useMemo(() => open.filter((r) => isDue(r, now)).length, [now, open]);

  const visible = useMemo(() => {
    const list = open.filter((item) => {
      if (filter === 'all') return true;
      if (filter === 'due') return isDue(item, now);
      if (ERROR_FILTERS.includes(filter as ErrorType)) return item.errorType === filter;
      return item.subject === filter;
    });
    return list.sort((a, b) => Date.parse(a.dueAt) - Date.parse(b.dueAt));
  }, [filter, now, open]);

  const start = async (options: Parameters<typeof startSession>[0]) => {
    setBusy(true);
    const session = await startSession(options);
    setBusy(false);
    if (session) navigate('/session');
  };

  if (!open.length) {
    return (
      <EmptyState
        title="복습할 오답이 없습니다"
        description="문제를 풀다가 틀리면 여기에 쌓이고, 짧은 간격으로 다시 물어봅니다."
      >
        <LinkButton to="/" variant="primary" full>
          홈으로
        </LinkButton>
      </EmptyState>
    );
  }

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-xl font-black">오답</h1>
        <p className="mt-1 text-sm text-ink-500 dark:text-ink-400">
          지금 복습할 오답 <span className="font-bold text-ink-800 dark:text-ink-100">{dueCount}</span>개 · 미완료{' '}
          {open.length}개
        </p>
      </header>

      {/* When nothing is due yet the queue still opens, just labelled honestly. */}
      <Button
        variant="primary"
        size="lg"
        full
        disabled={busy}
        onClick={() =>
          void start(
            dueCount > 0
              ? { mode: 'review', count: Math.min(20, dueCount), dueOnly: true }
              : { mode: 'review', count: Math.min(20, open.length) },
          )
        }
      >
        {dueCount > 0
          ? `지금 복습할 오답 ${Math.min(20, dueCount)}개`
          : `예정 복습 미리 보기 ${Math.min(20, open.length)}개`}
      </Button>
      {dueCount === 0 ? (
        <p className="-mt-2 text-center text-xs text-ink-400">
          아직 복습 시간이 되지 않았습니다. 조금 뒤에 다시 물어봅니다.
        </p>
      ) : null}

      <div className="grid grid-cols-3 gap-2">
        {ERROR_FILTERS.map((type) => {
          const count = open.filter((r) => r.errorType === type).length;
          return (
            <Button
              key={type}
              size="sm"
              disabled={busy || count === 0}
              onClick={() => void start({ mode: 'review', count: Math.min(15, count), errorType: type })}
            >
              {ERROR_TYPE_LABEL[type]} {count}
            </Button>
          );
        })}
      </div>

      <section>
        <SectionTitle>목록</SectionTitle>
        <div className="-mx-4 mb-3 flex gap-1.5 overflow-x-auto px-4 pb-1">
          <FilterChip active={filter === 'due'} onClick={() => setFilter('due')}>
            지금 복습 {dueCount}
          </FilterChip>
          <FilterChip active={filter === 'all'} onClick={() => setFilter('all')}>
            전체 {open.length}
          </FilterChip>
          {ERROR_FILTERS.map((type) => (
            <FilterChip key={type} active={filter === type} onClick={() => setFilter(type)}>
              {ERROR_TYPE_LABEL[type]}
            </FilterChip>
          ))}
          {SUBJECTS.map((subject) => (
            <FilterChip key={subject} active={filter === subject} onClick={() => setFilter(subject)}>
              {SUBJECT_META[subject].short}
            </FilterChip>
          ))}
        </div>

        {visible.length === 0 ? (
          <Card>
            <p className="text-sm text-ink-500">이 조건에 해당하는 오답이 없습니다.</p>
          </Card>
        ) : (
          <ul className="space-y-2">
            {visible.slice(0, 40).map((item) => {
              const question = byId.get(item.questionId);
              if (!question) return null;
              const due = isDue(item, now);
              return (
                <Card as="li" key={item.questionId} className="py-3">
                  <div className="flex items-start justify-between gap-2">
                    <QuestionBadges question={question} />
                    <span
                      className={clsx(
                        'flex-none text-[11px] font-bold tabular-nums',
                        due ? 'text-rose-600 dark:text-rose-400' : 'text-ink-400',
                      )}
                    >
                      {due ? '지금' : relativeFromNow(item.dueAt, now)}
                    </span>
                  </div>
                  <p className="mt-2 line-clamp-2 text-sm font-semibold leading-relaxed">
                    {question.question}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px] text-ink-400">
                    <Chip>{ERROR_TYPE_LABEL[item.errorType]}</Chip>
                    <span>틀린 횟수 {item.lapses}</span>
                    <span>·</span>
                    <span>단계 {item.stage}</span>
                  </div>
                </Card>
              );
            })}
          </ul>
        )}
        {visible.length > 40 ? (
          <p className="mt-2 text-center text-xs text-ink-400">
            상위 40개만 표시했습니다. 나머지는 복습 세션에서 순서대로 나옵니다.
          </p>
        ) : null}
      </section>
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={clsx(
        'flex-none rounded-full px-3 py-1.5 text-xs font-bold transition-colors',
        active
          ? 'bg-ink-900 text-white dark:bg-white dark:text-ink-900'
          : 'bg-ink-100 text-ink-600 hover:bg-ink-200 dark:bg-ink-800 dark:text-ink-300 dark:hover:bg-ink-700',
      )}
    >
      {children}
    </button>
  );
}
