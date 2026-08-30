import { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Flame, Play, Sparkles, Upload } from 'lucide-react';
import { ScoreHero } from '../components/ScoreHero';
import { Button, Card, Chip, EmptyState, LinkButton, SectionTitle } from '../components/ui';
import { useStore } from '../lib/store';
import {
  useActiveSession,
  useDDay,
  useEstimate,
  useFinalReview,
  usePracticePool,
  useWeakness,
} from '../hooks/useDerived';

export default function HomePage() {
  const navigate = useNavigate();
  const dday = useDDay();
  const estimate = useEstimate();
  const weakness = useWeakness();
  const finalReview = useFinalReview();
  const { total } = usePracticePool();
  const scorableContent = useStore((s) =>
    s.questions.some((q) => q.sourceType !== 'sample'),
  );
  const startSession = useStore((s) => s.startSession);
  const activeSession = useActiveSession();
  const [starting, setStarting] = useState<number | null>(null);

  const resumable =
    activeSession && !activeSession.finishedAt && activeSession.cursor < activeSession.questionIds.length
      ? activeSession
      : undefined;

  const start = useCallback(
    async (count: 5 | 10) => {
      setStarting(count);
      const session = await startSession({ mode: count === 5 ? 'quick5' : 'quick10', count });
      setStarting(null);
      if (session) navigate('/session');
    },
    [navigate, startSession],
  );

  if (total === 0) {
    return (
      <div className="space-y-4">
        <ScoreHero dday={dday} estimate={estimate} scorableContent={scorableContent} />
        <EmptyState
          title="문제은행을 추가하면 학습을 시작할 수 있습니다."
          description="JSON 또는 CSV로 문제를 가져오거나, AI에게 문제를 만들게 하는 프롬프트를 복사해 붙여넣으세요."
        >
          <LinkButton to="/data" variant="primary" size="lg" full>
            <Upload aria-hidden className="h-5 w-5" />
            문제 가져오기
          </LinkButton>
          <LinkButton to="/data#format" variant="secondary" full>
            형식 보기
          </LinkButton>
          <LinkButton to="/ai" variant="ghost" full>
            AI 문제 생성용 프롬프트 복사
          </LinkButton>
        </EmptyState>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <ScoreHero dday={dday} estimate={estimate} scorableContent={scorableContent} />

      {finalReview ? (
        <Card className="border-amber-400/60 bg-amber-50 dark:border-amber-500/40 dark:bg-amber-500/10">
          <div className="flex items-center gap-2">
            <Flame aria-hidden className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            <p className="text-sm font-bold text-amber-800 dark:text-amber-200">
              최종 복습 기간입니다
            </p>
          </div>
          <p className="mt-1 text-xs text-amber-800/80 dark:text-amber-200/80">
            새 내용보다 오답 · 헷갈림 · 과락 위험 과목을 먼저 도세요.
          </p>
          <LinkButton to="/final" variant="primary" size="md" full className="mt-3">
            FINAL REVIEW 열기
            <ArrowRight aria-hidden className="h-4 w-4" />
          </LinkButton>
        </Card>
      ) : null}

      {resumable ? (
        <Card className="border-brand-400/60 bg-brand-50 dark:border-brand-500/40 dark:bg-brand-500/10">
          <p className="text-sm font-bold text-brand-800 dark:text-brand-200">
            진행 중인 세션이 있습니다
          </p>
          <p className="mt-1 text-xs text-brand-800/80 dark:text-brand-200/80">
            {resumable.cursor} / {resumable.questionIds.length} 문제까지 풀었습니다.
          </p>
          <LinkButton to="/session" variant="primary" full className="mt-3">
            이어서 풀기
            <ArrowRight aria-hidden className="h-4 w-4" />
          </LinkButton>
        </Card>
      ) : null}

      <div className="space-y-2">
        <Button
          variant="primary"
          size="lg"
          full
          onClick={() => void start(10)}
          disabled={starting !== null}
        >
          <Play aria-hidden className="h-5 w-5" />
          {starting === 10 ? '문제 고르는 중…' : '지금 10문제'}
        </Button>

        <div className="grid grid-cols-2 gap-2">
          <Button onClick={() => void start(5)} disabled={starting !== null}>
            {starting === 5 ? '준비 중…' : '5문제만'}
          </Button>
          <LinkButton to="/wrong">
            오답 복습
            {weakness.dueCount > 0 ? (
              <Chip tone="bg-rose-500/15 text-rose-700 ring-rose-500/30 dark:text-rose-300">
                {weakness.dueCount}
              </Chip>
            ) : null}
          </LinkButton>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <LinkButton to="/study">과목별 25문제</LinkButton>
          <LinkButton to="/mock">실전 100문제</LinkButton>
        </div>
      </div>

      <section>
        <SectionTitle
          action={
            <LinkButton to="/ai" variant="ghost" size="sm">
              <Sparkles aria-hidden className="h-4 w-4" />
              AI 학습팩
            </LinkButton>
          }
        >
          오늘
        </SectionTitle>
        <Card>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
            <span>
              <span className="font-black tabular-nums">{weakness.todayCount}</span>
              <span className="text-ink-500 dark:text-ink-400">문제</span>
            </span>
            <span>
              정답{' '}
              <span className="font-black tabular-nums">
                {weakness.todayCount ? Math.round((weakness.todayCorrect / weakness.todayCount) * 100) : 0}%
              </span>
            </span>
          </div>
          <p className="mt-2 text-xs text-ink-500 dark:text-ink-400">
            복습 대기{' '}
            <span className="font-bold text-ink-700 dark:text-ink-200">{weakness.dueCount}</span>개
            {' · '}
            미완료 오답{' '}
            <span className="font-bold text-ink-700 dark:text-ink-200">{weakness.openReviewCount}</span>개
          </p>
          {weakness.topics.length ? (
            <p className="mt-3 text-xs text-ink-500 dark:text-ink-400">
              취약:{' '}
              <span className="font-semibold text-ink-700 dark:text-ink-200">
                {weakness.topics
                  .slice(0, 2)
                  .map((t) => t.topic)
                  .join(' · ')}
              </span>
            </p>
          ) : null}
        </Card>
      </section>
    </div>
  );
}
