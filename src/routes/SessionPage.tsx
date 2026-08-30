import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { ChevronRight, X } from 'lucide-react';
import clsx from 'clsx';
import { ChoiceList } from '../components/ChoiceList';
import { QuestionBadges } from '../components/QuestionBadges';
import { Button, Card, Chip, LinkButton } from '../components/ui';
import { useStore } from '../lib/store';
import { useActiveSession, useEstimate, useQuestionsById } from '../hooks/useDerived';
import { SUBJECT_META } from '../lib/exam';
import { ERROR_TYPE_LABEL, type ErrorType } from '../lib/types';
import { formatClock } from '../lib/date';

const ERROR_TYPES: ErrorType[] = ['knowledge', 'confusion', 'mistake'];

export default function SessionPage() {
  const navigate = useNavigate();
  const session = useActiveSession();
  const byId = useQuestionsById();
  const preferences = useStore((s) => s.preferences);
  const answerQuestion = useStore((s) => s.answerQuestion);
  const classifyError = useStore((s) => s.classifyError);
  const advanceSession = useStore((s) => s.advanceSession);
  const finishSession = useStore((s) => s.finishSession);

  const [selected, setSelected] = useState<number | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const shownAt = useRef<number>(Date.now());
  /** Blocks a second Enter/tap from skipping the next question while the
   *  advance is still in flight. */
  const advancing = useRef(false);

  const questionId = session?.questionIds[session.cursor];
  const question = questionId ? byId.get(questionId) : undefined;
  const done = Boolean(session && session.cursor >= session.questionIds.length);

  // Reset per-question UI state whenever the cursor moves.
  useEffect(() => {
    setSelected(null);
    setRevealed(false);
    setElapsed(0);
    shownAt.current = Date.now();
    advancing.current = false;
  }, [questionId]);

  useEffect(() => {
    if (!preferences.showQuestionTimer || revealed || !question) return;
    const timer = window.setInterval(() => {
      setElapsed(Date.now() - shownAt.current);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [preferences.showQuestionTimer, revealed, question]);

  const submit = useCallback(
    async (index: number) => {
      if (revealed || !question) return;
      setSelected(index);
      setRevealed(true);
      await answerQuestion({
        questionId: question.id,
        selectedAnswer: index,
        responseTimeMs: Date.now() - shownAt.current,
      });
    },
    [answerQuestion, question, revealed],
  );

  const next = useCallback(async () => {
    if (advancing.current) return;
    advancing.current = true;
    await advanceSession();
  }, [advanceSession]);

  const classify = useCallback(
    async (errorType: ErrorType) => {
      if (!question || advancing.current) return;
      advancing.current = true;
      await classifyError(question.id, errorType);
      await advanceSession();
    },
    [advanceSession, classifyError, question],
  );

  // Keyboard shortcuts: 1-4 to answer, Enter to move on. Ignored while typing.
  useEffect(() => {
    if (!preferences.keyboardShortcuts) return;
    const handler = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return;

      if (!revealed && question) {
        const index = Number.parseInt(event.key, 10) - 1;
        if (index >= 0 && index < question.choices.length) {
          event.preventDefault();
          void submit(index);
        }
        return;
      }
      if (revealed && event.key === 'Enter') {
        event.preventDefault();
        void next();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [next, preferences.keyboardShortcuts, question, revealed, submit]);

  if (!session) return <Navigate to="/" replace />;
  if (done) return <SessionResult onLeave={() => void finishSession().then(() => navigate('/'))} />;

  if (!question) {
    return (
      <Card>
        <p className="text-sm font-semibold">이 문제를 찾을 수 없습니다.</p>
        <p className="mt-1 text-xs text-ink-500">
          문제은행에서 삭제되었을 수 있습니다. 다음 문제로 넘어갑니다.
        </p>
        <Button variant="primary" full className="mt-3" onClick={() => void next()}>
          다음 문제
        </Button>
      </Card>
    );
  }

  const answered = session.cursor;
  const total = session.questionIds.length;
  const correct = selected !== null && selected === question.correctAnswer;

  return (
    <div className="animate-fade-in space-y-4">
      <header className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className={clsx('text-xs font-bold', SUBJECT_META[question.subject].accent)}>
            {SUBJECT_META[question.subject].name}
          </span>
          <span className="text-xs tabular-nums text-ink-400">
            {answered + 1} / {total}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {preferences.showQuestionTimer && !revealed ? (
            <span className="text-xs tabular-nums text-ink-400">{formatClock(elapsed)}</span>
          ) : null}
          <button
            type="button"
            onClick={() => void finishSession().then(() => navigate('/'))}
            className="rounded-lg p-2 text-ink-400 hover:bg-ink-100 hover:text-ink-700 dark:hover:bg-ink-800"
            aria-label="세션 종료"
          >
            <X aria-hidden className="h-5 w-5" />
          </button>
        </div>
      </header>

      <div
        className="h-1 w-full overflow-hidden rounded-full bg-ink-200 dark:bg-ink-800"
        role="progressbar"
        aria-valuenow={answered}
        aria-valuemin={0}
        aria-valuemax={total}
        aria-label="세션 진행률"
      >
        <div
          className="h-full rounded-full bg-brand-500 transition-[width]"
          style={{ width: `${(answered / total) * 100}%` }}
        />
      </div>

      <Card>
        <QuestionBadges question={question} showSubject={false} />
        <h1 className="mt-3 text-[17px] font-bold leading-relaxed">{question.question}</h1>
      </Card>

      <ChoiceList
        choices={question.choices}
        selected={selected}
        correctAnswer={question.correctAnswer}
        revealed={revealed}
        onSelect={(index) => void submit(index)}
        showShortcuts={preferences.keyboardShortcuts}
      />

      {revealed ? (
        <div className="animate-fade-in space-y-3">
          <Card
            className={clsx(
              correct
                ? 'border-emerald-400/70 bg-emerald-50 dark:border-emerald-500/40 dark:bg-emerald-500/10'
                : 'border-rose-400/70 bg-rose-50 dark:border-rose-500/40 dark:bg-rose-500/10',
            )}
          >
            <p
              className={clsx(
                'text-sm font-black',
                correct ? 'text-emerald-800 dark:text-emerald-200' : 'text-rose-800 dark:text-rose-200',
              )}
            >
              {correct ? '정답' : '오답'}
              {!correct ? (
                <span className="ml-2 font-bold">
                  정답: {question.correctAnswer + 1}번
                </span>
              ) : null}
            </p>
            {question.explanation ? (
              <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-ink-700 dark:text-ink-200">
                {question.explanation}
              </p>
            ) : (
              <p className="mt-2 text-xs text-ink-500">등록된 해설이 없습니다.</p>
            )}
            {question.confusionPair?.length ? (
              <p className="mt-2 text-xs text-ink-500 dark:text-ink-400">
                헷갈리기 쉬운 개념: {question.confusionPair.join(' · ')}
              </p>
            ) : null}
          </Card>

          {!correct ? (
            <div>
              <p className="mb-2 text-xs font-bold text-ink-500 dark:text-ink-400">
                왜 틀렸나요? (복습 주기가 달라집니다)
              </p>
              <div className="grid grid-cols-3 gap-2">
                {ERROR_TYPES.map((type) => (
                  <Button key={type} onClick={() => void classify(type)}>
                    {ERROR_TYPE_LABEL[type]}
                  </Button>
                ))}
              </div>
              <Button variant="ghost" size="sm" full className="mt-2" onClick={() => void next()}>
                분류 없이 다음
              </Button>
            </div>
          ) : (
            <Button variant="primary" size="lg" full onClick={() => void next()}>
              다음 문제
              <ChevronRight aria-hidden className="h-5 w-5" />
            </Button>
          )}
        </div>
      ) : null}
    </div>
  );
}

function SessionResult({ onLeave }: { onLeave: () => void }) {
  const session = useActiveSession();
  const byId = useQuestionsById();
  const estimate = useEstimate();
  const extendSession = useStore((s) => s.extendSession);
  const retryWrong = useStore((s) => s.retryWrong);
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);

  const summary = useMemo(() => {
    if (!session) return null;
    const answers = Object.values(session.answers);
    const correct = answers.filter((a) => a.correct).length;
    const wrong = answers.filter((a) => !a.correct);
    const topics = new Map<string, number>();
    wrong.forEach((a) => {
      const question = byId.get(a.questionId);
      if (!question) return;
      const key = `${SUBJECT_META[question.subject].short} · ${question.topic ?? '기타'}`;
      topics.set(key, (topics.get(key) ?? 0) + 1);
    });
    return {
      correct,
      total: answers.length,
      wrongCount: wrong.length,
      topics: [...topics.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3),
    };
  }, [byId, session]);

  if (!session || !summary) return <Navigate to="/" replace />;

  return (
    <div className="animate-fade-in space-y-4 pt-6">
      <Card className="text-center">
        <p className="text-xs font-bold uppercase tracking-widest text-ink-400">세션 완료</p>
        <p className="mt-2 text-5xl font-black tabular-nums">
          {summary.correct}
          <span className="text-2xl text-ink-400"> / {summary.total}</span>
        </p>
        <p className="mt-3 text-sm text-ink-500 dark:text-ink-400">
          최근 훈련 점수{' '}
          <span className="font-bold text-ink-800 dark:text-ink-100">
            {estimate.weightedTotal === null ? '데이터 부족' : estimate.weightedTotal.toFixed(1)}
          </span>
        </p>
        {summary.topics.length ? (
          <div className="mt-3 flex flex-wrap justify-center gap-1.5">
            {summary.topics.map(([topic, count]) => (
              <Chip key={topic} tone="bg-rose-500/12 text-rose-700 ring-rose-500/25 dark:text-rose-300">
                {topic} {count}
              </Chip>
            ))}
          </div>
        ) : null}
      </Card>

      <div className="space-y-2">
        {summary.wrongCount > 0 ? (
          <Button
            variant="primary"
            size="lg"
            full
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              const retry = await retryWrong();
              setBusy(false);
              if (!retry) navigate('/');
            }}
          >
            오답 {summary.wrongCount}개 다시
          </Button>
        ) : null}
        <Button
          size="lg"
          full
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            await extendSession(10);
            setBusy(false);
          }}
        >
          10문제 더
        </Button>
        <Button variant="ghost" full onClick={onLeave}>
          종료
        </Button>
        <p className="pt-2 text-center text-xs text-ink-400">
          <Link to="/wrong" className="underline underline-offset-4">
            오답 목록 보기
          </Link>
        </p>
      </div>
      <LinkButton to="/" variant="ghost" size="sm" full>
        홈으로
      </LinkButton>
    </div>
  );
}
