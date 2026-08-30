import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import clsx from 'clsx';
import { ChevronLeft, ChevronRight, Grid3x3 } from 'lucide-react';
import { Button, Card } from '../components/ui';
import { useStore } from '../lib/store';
import { useActiveMock, useQuestionsById } from '../hooks/useDerived';
import { formatClock } from '../lib/date';
import { mockRemainingMs } from '../lib/mock';
import { SUBJECT_META } from '../lib/exam';

export default function MockRunPage() {
  const navigate = useNavigate();
  const mock = useActiveMock();
  const byId = useQuestionsById();
  const answerMock = useStore((s) => s.answerMock);
  const submitMock = useStore((s) => s.submitMock);

  const [index, setIndex] = useState(0);
  const [remaining, setRemaining] = useState(() => (mock ? mockRemainingMs(mock) : 0));
  const [navigatorOpen, setNavigatorOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const submitting = useRef(false);

  const finish = useCallback(async () => {
    if (submitting.current) return;
    submitting.current = true;
    const submitted = await submitMock();
    if (submitted) navigate(`/mock/result/${submitted.id}`, { replace: true });
    else navigate('/mock', { replace: true });
  }, [navigate, submitMock]);

  // The deadline is wall-clock and persisted, so refreshing or backgrounding
  // the tab cannot buy extra time.
  useEffect(() => {
    if (!mock || mock.submittedAt) return;
    const tick = () => {
      const left = mockRemainingMs(mock);
      setRemaining(left);
      if (left <= 0) void finish();
    };
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [finish, mock]);

  // Escape leaves the submit dialog rather than trapping the learner in it.
  useEffect(() => {
    if (!confirming) return;
    const handler = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setConfirming(false);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [confirming]);

  const unanswered = useMemo(() => {
    if (!mock) return [];
    return mock.questionIds.filter((id) => mock.answers[id] === undefined);
  }, [mock]);

  if (!mock) return <Navigate to="/mock" replace />;
  if (mock.submittedAt) return <Navigate to={`/mock/result/${mock.id}`} replace />;

  const questionId = mock.questionIds[index];
  const question = byId.get(questionId);
  const selected = mock.answers[questionId];
  const total = mock.questionIds.length;
  const answeredCount = total - unanswered.length;
  const lowTime = remaining <= 5 * 60_000;

  return (
    <div className="space-y-3">
      <header className="sticky top-0 z-10 -mx-4 flex items-center justify-between gap-2 border-b border-ink-200 bg-ink-50/95 px-4 py-2 backdrop-blur dark:border-ink-800 dark:bg-ink-950/95">
        <span className="text-xs font-bold tabular-nums text-ink-500 dark:text-ink-400">
          {index + 1} / {total}
        </span>
        <span
          className={clsx(
            'rounded-lg px-2 py-1 text-sm font-black tabular-nums',
            lowTime
              ? 'bg-rose-500/15 text-rose-700 dark:text-rose-300'
              : 'bg-ink-900/5 text-ink-700 dark:bg-white/10 dark:text-ink-100',
          )}
          role="timer"
          aria-label={`남은 시간 ${formatClock(remaining)}`}
        >
          {formatClock(remaining)}
        </span>
        <button
          type="button"
          onClick={() => setNavigatorOpen((v) => !v)}
          aria-expanded={navigatorOpen}
          className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-bold text-ink-600 hover:bg-ink-100 dark:text-ink-300 dark:hover:bg-ink-800"
        >
          <Grid3x3 aria-hidden className="h-4 w-4" />
          {answeredCount}/{total}
        </button>
      </header>

      {navigatorOpen ? (
        <Card>
          <p className="mb-2 text-xs font-bold text-ink-500 dark:text-ink-400">
            문제 이동 · 미표시({unanswered.length}개)는 아직 답하지 않은 문제입니다
          </p>
          <div className="grid grid-cols-10 gap-1">
            {mock.questionIds.map((id, i) => {
              const answered = mock.answers[id] !== undefined;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => {
                    setIndex(i);
                    setNavigatorOpen(false);
                  }}
                  aria-label={`${i + 1}번 문제${answered ? ' (응답함)' : ' (미응답)'}`}
                  className={clsx(
                    'flex h-8 items-center justify-center rounded text-[11px] font-bold tabular-nums',
                    i === index && 'ring-2 ring-brand-500',
                    answered
                      ? 'bg-ink-800 text-white dark:bg-ink-200 dark:text-ink-900'
                      : 'bg-ink-100 text-ink-500 dark:bg-ink-800 dark:text-ink-400',
                  )}
                >
                  {i + 1}
                </button>
              );
            })}
          </div>
        </Card>
      ) : null}

      {question ? (
        <>
          <Card>
            <p className="text-xs font-bold text-ink-400">{SUBJECT_META[question.subject].name}</p>
            <h1 className="mt-2 text-[17px] font-bold leading-relaxed">{question.question}</h1>
          </Card>

          <ul className="space-y-2">
            {question.choices.map((choice, choiceIndex) => (
              <li key={choiceIndex}>
                <button
                  type="button"
                  onClick={() => void answerMock(questionId, choiceIndex)}
                  aria-pressed={selected === choiceIndex}
                  className={clsx(
                    'tap flex w-full items-start gap-3 rounded-xl border p-3 text-left text-[15px] leading-relaxed',
                    selected === choiceIndex
                      ? 'border-brand-500 bg-brand-50 dark:bg-brand-500/15'
                      : 'border-ink-200 bg-white hover:border-brand-300 dark:border-ink-700 dark:bg-ink-900',
                  )}
                >
                  <span
                    aria-hidden
                    className={clsx(
                      'mt-0.5 flex h-6 w-6 flex-none items-center justify-center rounded-full text-xs font-black',
                      selected === choiceIndex
                        ? 'bg-brand-600 text-white'
                        : 'bg-ink-200 text-ink-600 dark:bg-ink-700 dark:text-ink-200',
                    )}
                  >
                    {choiceIndex + 1}
                  </span>
                  <span className="flex-1">{choice}</span>
                </button>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <Card>
          <p className="text-sm text-ink-500">이 문제를 불러올 수 없습니다. 다음 문제로 넘어가세요.</p>
        </Card>
      )}

      <div className="flex items-center gap-2">
        <Button
          className="flex-1"
          disabled={index === 0}
          onClick={() => setIndex((i) => Math.max(0, i - 1))}
        >
          <ChevronLeft aria-hidden className="h-5 w-5" />
          이전
        </Button>
        {index < total - 1 ? (
          <Button variant="primary" className="flex-1" onClick={() => setIndex((i) => Math.min(total - 1, i + 1))}>
            다음
            <ChevronRight aria-hidden className="h-5 w-5" />
          </Button>
        ) : (
          <Button variant="primary" className="flex-1" onClick={() => setConfirming(true)}>
            제출
          </Button>
        )}
      </div>

      <Button variant="ghost" size="sm" full onClick={() => setConfirming(true)}>
        지금 제출하기
      </Button>

      {confirming ? (
        <div
          className="fixed inset-0 z-30 flex items-end justify-center bg-black/50 p-4 sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby="submit-title"
        >
          <Card className="w-full max-w-sm">
            <h2 id="submit-title" tabIndex={-1} ref={(el) => el?.focus()} className="text-base font-black outline-none">
              제출할까요?
            </h2>
            <p className="mt-2 text-sm text-ink-600 dark:text-ink-300">
              {unanswered.length > 0 ? (
                <>
                  아직 <span className="font-bold text-rose-600 dark:text-rose-400">{unanswered.length}문제</span>에
                  답하지 않았습니다. 미응답은 오답으로 채점됩니다.
                </>
              ) : (
                '모든 문제에 답했습니다.'
              )}
            </p>
            <div className="mt-4 flex gap-2">
              <Button className="flex-1" onClick={() => setConfirming(false)}>
                계속 풀기
              </Button>
              <Button variant="primary" className="flex-1" onClick={() => void finish()}>
                제출
              </Button>
            </div>
            {unanswered.length > 0 ? (
              <Button
                variant="ghost"
                size="sm"
                full
                className="mt-2"
                onClick={() => {
                  const first = mock.questionIds.indexOf(unanswered[0]);
                  if (first >= 0) setIndex(first);
                  setConfirming(false);
                }}
              >
                첫 미응답 문제로 이동
              </Button>
            ) : null}
          </Card>
        </div>
      ) : null}
    </div>
  );
}
