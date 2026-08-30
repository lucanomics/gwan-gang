import { useMemo } from 'react';
import { Sparkles } from 'lucide-react';
import { Card, Chip, EmptyState, LinkButton, Meter, SectionTitle } from '../components/ui';
import { useStore } from '../lib/store';
import { useDDay, useEstimate, useExpectedCounts, useWeakness } from '../hooks/useDerived';
import { SUBJECTS, SUBJECT_META } from '../lib/exam';
import { cutoffStatus, scoreBand } from '../lib/scoring';
import { describeMoves, leverageTo } from '../lib/leverage';
import { ERROR_TYPE_LABEL, type ErrorType } from '../lib/types';

const ERROR_TYPES: ErrorType[] = ['knowledge', 'confusion', 'mistake'];

export default function StatsPage() {
  const estimate = useEstimate();
  const weakness = useWeakness();
  const expected = useExpectedCounts();
  const dday = useDDay();
  const mocks = useStore((s) => s.mocks);
  const attempts = useStore((s) => s.attempts);

  const plans = useMemo(
    () => [65, 70].map((target) => leverageTo(expected, target)),
    [expected],
  );

  const errorTotal = ERROR_TYPES.reduce((sum, t) => sum + weakness.errorDistribution[t], 0);
  const finishedMocks = mocks.filter((m) => m.result);

  if (attempts.length === 0) {
    return (
      <EmptyState
        title="아직 훈련 기록이 없습니다"
        description="문제를 풀면 과목별 정답률, 과락 위험, 취약 주제가 여기에 쌓입니다."
      >
        <LinkButton to="/" variant="primary" full>
          지금 10문제 풀기
        </LinkButton>
      </EmptyState>
    );
  }

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-xl font-black">통계</h1>
        <p className="mt-1 text-sm text-ink-500 dark:text-ink-400">
          {dday.label} · 결정에 필요한 것만 봅니다.
        </p>
      </header>

      <Card>
        <div className="grid grid-cols-3 gap-3 text-center">
          <div>
            <p className="text-2xl font-black tabular-nums">{weakness.todayCount}</p>
            <p className="text-[11px] text-ink-400">오늘 문제</p>
          </div>
          <div>
            <p className="text-2xl font-black tabular-nums">
              {weakness.todayCount
                ? Math.round((weakness.todayCorrect / weakness.todayCount) * 100)
                : 0}
              %
            </p>
            <p className="text-[11px] text-ink-400">오늘 정답률</p>
          </div>
          <div>
            <p className="text-2xl font-black tabular-nums">{weakness.dueCount}</p>
            <p className="text-[11px] text-ink-400">복습 대기</p>
          </div>
        </div>
      </Card>

      <section>
        <SectionTitle>과목별 상태</SectionTitle>
        <Card>
          <p className="text-xs text-ink-500 dark:text-ink-400">최근 훈련 추정치</p>
          <p className="mt-1 text-3xl font-black tabular-nums">
            {estimate.weightedTotal === null ? (
              <span className="text-xl text-ink-400">데이터 부족</span>
            ) : (
              <>
                {estimate.weightedTotal.toFixed(1)}
                <span className="text-base text-ink-400"> / 100</span>{' '}
                <Chip tone={scoreBand(estimate.weightedTotal).tone}>
                  {scoreBand(estimate.weightedTotal).label}
                </Chip>
              </>
            )}
          </p>

          <ul className="mt-4 space-y-3">
            {SUBJECTS.map((subject) => {
              const est = estimate.bySubject[subject];
              const meta = SUBJECT_META[subject];
              const cutoff = est.expectedCorrect === null ? null : cutoffStatus(est.expectedCorrect);
              return (
                <li key={subject}>
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-semibold">
                      {meta.name}
                      <span className="ml-1.5 text-[11px] font-normal text-ink-400">
                        {est.attempts}문제 기록
                      </span>
                    </span>
                    <span className="flex items-center gap-2">
                      {cutoff && cutoff.status !== 'safe' ? <Chip tone={cutoff.tone}>{cutoff.label}</Chip> : null}
                      <span className="font-bold tabular-nums">
                        {est.expectedCorrect === null ? (
                          <span className="text-xs text-ink-400">데이터 부족</span>
                        ) : (
                          `${est.expectedCorrect.toFixed(1)} / 25`
                        )}
                      </span>
                    </span>
                  </div>
                  <div className="mt-1">
                    <Meter
                      value={est.expectedCorrect ?? 0}
                      max={meta.questionCount}
                      tone={
                        cutoff?.status === 'fail'
                          ? 'bg-rose-500'
                          : cutoff?.status === 'warn'
                            ? 'bg-amber-500'
                            : 'bg-brand-500'
                      }
                      label={`${meta.name} ${est.expectedCorrect ?? 0} / 25`}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        </Card>
      </section>

      <section>
        <SectionTitle>점수 레버리지</SectionTitle>
        <Card>
          {!estimate.sufficient ? (
            <p className="text-sm text-ink-500 dark:text-ink-400">
              모든 과목에서 8문제 이상 풀면 목표까지 필요한 문항 수를 계산합니다.
            </p>
          ) : (
            <ul className="space-y-4">
              {plans.map((plan) => (
                <li key={plan.target}>
                  <p className="text-sm font-bold">
                    {plan.target}점까지{' '}
                    {plan.reached ? (
                      <span className="text-emerald-600 dark:text-emerald-400">이미 도달</span>
                    ) : (
                      <span className="tabular-nums text-brand-600 dark:text-brand-400">
                        +{plan.gap.toFixed(1)}
                      </span>
                    )}
                  </p>
                  {plan.cutoffFixes.length ? (
                    <p className="mt-1 text-xs font-semibold text-rose-600 dark:text-rose-400">
                      먼저 과락 해소: {describeMoves(plan.cutoffFixes)}
                    </p>
                  ) : null}
                  {!plan.reached && plan.options.length ? (
                    <div className="mt-1.5 space-y-1">
                      <p className="text-[11px] text-ink-400">가능한 개선 예</p>
                      {plan.options.map((moves, i) => (
                        <p key={i} className="text-xs font-semibold text-ink-700 dark:text-ink-200">
                          · {describeMoves(moves)}
                        </p>
                      ))}
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
          <p className="mt-3 text-[11px] leading-relaxed text-ink-400">
            산술적으로 필요한 추가 정답 수입니다. 실제로 그만큼 맞출 수 있다는 예측이 아닙니다.
          </p>
        </Card>
      </section>

      <section>
        <SectionTitle>오답 유형</SectionTitle>
        <Card>
          {errorTotal === 0 ? (
            <p className="text-sm text-ink-500">아직 분류된 오답이 없습니다.</p>
          ) : (
            <ul className="space-y-2">
              {ERROR_TYPES.map((type) => {
                const count = weakness.errorDistribution[type];
                return (
                  <li key={type}>
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-semibold">{ERROR_TYPE_LABEL[type]}</span>
                      <span className="tabular-nums font-bold">{count}</span>
                    </div>
                    <div className="mt-1">
                      <Meter
                        value={count}
                        max={errorTotal}
                        tone={
                          type === 'confusion'
                            ? 'bg-violet-500'
                            : type === 'knowledge'
                              ? 'bg-sky-500'
                              : 'bg-ink-400'
                        }
                        label={`${ERROR_TYPE_LABEL[type]} ${count}`}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </section>

      <section>
        <SectionTitle>취약 주제</SectionTitle>
        <Card>
          {weakness.topics.length === 0 ? (
            <p className="text-sm text-ink-500">아직 충분한 데이터가 없습니다.</p>
          ) : (
            <ul className="space-y-2">
              {weakness.topics.slice(0, 8).map((topic) => (
                <li
                  key={`${topic.subject}-${topic.topic}`}
                  className="flex items-center justify-between gap-3 text-sm"
                >
                  <span>
                    <span className="text-[11px] text-ink-400">{SUBJECT_META[topic.subject].short}</span>{' '}
                    <span className="font-semibold">{topic.topic}</span>
                  </span>
                  <span className="flex-none tabular-nums text-xs text-ink-500 dark:text-ink-400">
                    {Math.round(topic.accuracy * 100)}% · 오답 {topic.wrong}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </section>

      {finishedMocks.length ? (
        <section>
          <SectionTitle>모의고사 기록</SectionTitle>
          <Card>
            <ul className="space-y-2">
              {finishedMocks.slice(0, 5).map((mock) => (
                <li key={mock.id} className="flex items-center justify-between text-sm">
                  <span className="text-xs text-ink-400">{(mock.submittedAt ?? '').slice(0, 10)}</span>
                  <span className="flex items-center gap-2">
                    {mock.result!.cutoffFailures.length ? (
                      <Chip tone="bg-rose-500/12 text-rose-700 ring-rose-500/30 dark:text-rose-300">과락</Chip>
                    ) : null}
                    <span className="font-black tabular-nums">{mock.result!.weightedTotal.toFixed(1)}</span>
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        </section>
      ) : null}

      <LinkButton to="/ai" variant="secondary" full>
        <Sparkles aria-hidden className="h-4 w-4" />
        AI 학습팩 만들기
      </LinkButton>
    </div>
  );
}
