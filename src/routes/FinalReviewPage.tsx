import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Flame } from 'lucide-react';
import { Button, Card, Chip, SectionTitle } from '../components/ui';
import { useStore } from '../lib/store';
import { useDDay, useEstimate, useFinalReview, useWeakness } from '../hooks/useDerived';
import { SUBJECTS, SUBJECT_META } from '../lib/exam';
import { cutoffStatus } from '../lib/scoring';

/**
 * From 2026-09-04 the app leads with review instead of new content.
 * Other modes stay reachable — this screen just makes the right choice obvious.
 */
export default function FinalReviewPage() {
  const navigate = useNavigate();
  const dday = useDDay();
  const active = useFinalReview();
  const estimate = useEstimate();
  const weakness = useWeakness();
  const reviews = useStore((s) => s.reviews);
  const startSession = useStore((s) => s.startSession);
  const [busy, setBusy] = useState(false);

  const open = reviews.filter((r) => !r.retired);
  const confusionCount = open.filter((r) => r.errorType === 'confusion').length;

  const riskySubjects = useMemo(
    () =>
      SUBJECTS.filter((subject) => {
        const expected = estimate.bySubject[subject].expectedCorrect;
        return expected !== null && cutoffStatus(expected).status !== 'safe';
      }),
    [estimate],
  );

  const launch = async (options: Parameters<typeof startSession>[0]) => {
    setBusy(true);
    const session = await startSession(options);
    setBusy(false);
    if (session) navigate('/session');
  };

  return (
    <div className="space-y-4">
      <header>
        <div className="flex items-center gap-2">
          <Flame aria-hidden className="h-5 w-5 text-amber-500" />
          <h1 className="text-xl font-black">FINAL REVIEW</h1>
          <Chip tone="bg-ink-900/5 text-ink-600 ring-ink-900/10 dark:bg-white/10 dark:text-ink-200">
            {dday.label}
          </Chip>
        </div>
        <p className="mt-1 text-sm text-ink-500 dark:text-ink-400">
          {active
            ? '새 내용보다 이미 틀린 것, 헷갈리는 것, 과락 위험 과목을 먼저 돌립니다.'
            : '아직 최종 복습 기간(9월 4일부터)은 아니지만 언제든 사용할 수 있습니다.'}
        </p>
      </header>

      <Card>
        <div className="grid grid-cols-3 gap-3 text-center">
          <div>
            <p className="text-2xl font-black tabular-nums">{open.length}</p>
            <p className="text-[11px] text-ink-400">오답</p>
          </div>
          <div>
            <p className="text-2xl font-black tabular-nums">{confusionCount}</p>
            <p className="text-[11px] text-ink-400">헷갈림</p>
          </div>
          <div>
            <p className="text-2xl font-black tabular-nums">{riskySubjects.length}</p>
            <p className="text-[11px] text-ink-400">과락위험 과목</p>
          </div>
        </div>
        {riskySubjects.length ? (
          <p className="mt-3 rounded-xl bg-rose-50 p-2.5 text-xs font-semibold text-rose-800 dark:bg-rose-500/10 dark:text-rose-200">
            {riskySubjects.map((s) => SUBJECT_META[s].name).join(', ')} — 여기부터 도세요.
          </p>
        ) : null}
      </Card>

      <section>
        <SectionTitle>지금 할 것</SectionTitle>
        <div className="space-y-2">
          {riskySubjects.map((subject) => (
            <Button
              key={subject}
              variant="primary"
              size="lg"
              full
              disabled={busy}
              onClick={() => void launch({ mode: 'final', subject, count: 20 })}
            >
              {SUBJECT_META[subject].short} 최종 20
            </Button>
          ))}

          <Button
            variant={riskySubjects.length ? 'secondary' : 'primary'}
            size="lg"
            full
            disabled={busy || open.length === 0}
            onClick={() => void launch({ mode: 'review', count: Math.min(20, open.length) })}
          >
            전체 오답 {open.length ? `(${Math.min(20, open.length)})` : ''}
          </Button>

          <Button
            full
            disabled={busy || confusionCount === 0}
            onClick={() =>
              void launch({ mode: 'review', errorType: 'confusion', count: Math.min(15, confusionCount) })
            }
          >
            헷갈림 VS {confusionCount ? `(${Math.min(15, confusionCount)})` : ''}
          </Button>

          <Button full disabled={busy} onClick={() => void launch({ mode: 'final', count: 10 })}>
            10문제 랜덤
          </Button>
        </div>
      </section>

      {weakness.topics.length ? (
        <section>
          <SectionTitle>마지막으로 볼 주제</SectionTitle>
          <Card>
            <ul className="space-y-1.5">
              {weakness.topics.slice(0, 6).map((topic) => (
                <li key={`${topic.subject}-${topic.topic}`} className="flex justify-between text-sm">
                  <span>
                    <span className="text-[11px] text-ink-400">{SUBJECT_META[topic.subject].short}</span>{' '}
                    <span className="font-semibold">{topic.topic}</span>
                  </span>
                  <span className="tabular-nums text-xs text-ink-400">오답 {topic.wrong}</span>
                </li>
              ))}
            </ul>
          </Card>
        </section>
      ) : null}
    </div>
  );
}
