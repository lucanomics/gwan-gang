import { Link } from 'react-router-dom';
import { SUBJECTS, SUBJECT_META } from '../lib/exam';
import { cutoffStatus, scoreBand } from '../lib/scoring';
import { Card, Chip, Meter } from './ui';
import type { PracticeEstimate } from '../lib/estimate';
import type { DDay } from '../lib/date';

/**
 * The four questions the home screen must answer instantly:
 * how close is the exam, what is my score, which subject is dangerous,
 * and what should I do right now (the CTA lives below this block).
 */
export function ScoreHero({
  dday,
  estimate,
  scorableContent = true,
}: {
  dday: DDay;
  estimate: PracticeEstimate;
  /** False when the bank holds only development samples, which never score. */
  scorableContent?: boolean;
}) {
  const band = estimate.weightedTotal === null ? null : scoreBand(estimate.weightedTotal);

  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-ink-400">
            GWAN<span className="text-brand-500">:</span>GANG
          </p>
          <h1 className="mt-1 text-sm font-semibold text-ink-500 dark:text-ink-400">
            관광통역안내사 1차 벼락치기
          </h1>
        </div>
        <div className="text-right">
          <p className="text-2xl font-black tabular-nums leading-none">{dday.label}</p>
          <p className="mt-1 text-[11px] text-ink-400">2026-09-05</p>
        </div>
      </div>

      <div className="mt-5">
        <p className="text-xs font-semibold text-ink-500 dark:text-ink-400">현재 훈련 기준 점수</p>
        {estimate.weightedTotal === null ? (
          <div className="mt-1 flex items-baseline gap-2">
            <p className="text-3xl font-black text-ink-400">데이터 부족</p>
          </div>
        ) : (
          <div className="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <p className="text-4xl font-black tabular-nums">
              {estimate.weightedTotal.toFixed(1)}
              <span className="ml-1 text-base font-bold text-ink-400">/ 100</span>
            </p>
            {band ? <Chip tone={band.tone}>{band.label}</Chip> : null}
          </div>
        )}
        <p className="mt-1 text-[11px] leading-relaxed text-ink-400">
          {estimate.weightedTotal !== null
            ? '최근 훈련 기록 기반 추정치입니다. 합격선 60점 · 과목별 10/25 이상.'
            : scorableContent
              ? '과목마다 8문제 이상 풀면 추정치가 나옵니다. 합격선은 60점입니다.'
              : '지금은 개발용 샘플 문제뿐입니다. 샘플은 점수에 반영되지 않으니 실제 문제를 가져오세요.'}
        </p>
      </div>

      <ul className="mt-4 space-y-2.5">
        {SUBJECTS.map((subject) => {
          const est = estimate.bySubject[subject];
          const meta = SUBJECT_META[subject];
          const cutoff = est.expectedCorrect === null ? null : cutoffStatus(est.expectedCorrect);
          return (
            <li key={subject}>
              <div className="flex items-center justify-between gap-2 text-sm">
                <span className="font-semibold">{meta.name}</span>
                <span className="flex items-center gap-2">
                  {cutoff && cutoff.status !== 'safe' ? (
                    <Chip tone={cutoff.tone}>{cutoff.label}</Chip>
                  ) : null}
                  <span className="tabular-nums font-bold">
                    {est.expectedCorrect === null ? (
                      <span className="text-xs font-semibold text-ink-400">데이터 부족</span>
                    ) : (
                      <>
                        {est.expectedCorrect.toFixed(1)}
                        <span className="text-ink-400"> / 25</span>
                      </>
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
                  label={`${meta.name} 예상 정답 ${est.expectedCorrect ?? 0} / ${meta.questionCount}`}
                />
              </div>
            </li>
          );
        })}
      </ul>

      <Link
        to="/stats"
        className="mt-4 inline-block text-xs font-semibold text-brand-600 underline underline-offset-4 dark:text-brand-400"
      >
        점수 레버리지 · 상세 통계 보기
      </Link>
    </Card>
  );
}
