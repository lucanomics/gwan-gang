import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, Clock, FileText } from 'lucide-react';
import { Button, Card, Chip, LinkButton, SectionTitle } from '../components/ui';
import { useStore } from '../lib/store';
import { useActiveMock, useVerifiedCounts } from '../hooks/useDerived';
import { MOCK_DURATION_MINUTES, SUBJECTS, SUBJECT_META, TOTAL_QUESTIONS } from '../lib/exam';
import { scoreBand } from '../lib/scoring';

export default function MockPage() {
  const navigate = useNavigate();
  const questions = useStore((s) => s.questions);
  const mocks = useStore((s) => s.mocks);
  const startMock = useStore((s) => s.startMock);
  const activeMock = useActiveMock();
  const verified = useVerifiedCounts();
  const [allowUnverified, setAllowUnverified] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pool = allowUnverified ? questions : questions.filter((q) => q.verificationStatus === 'verified');
  const available = SUBJECTS.map((subject) => ({
    subject,
    count: pool.filter((q) => q.subject === subject).length,
  }));
  const ready = available.every((a) => a.count >= SUBJECT_META[a.subject].questionCount);

  const finished = mocks
    .filter((m) => m.result)
    .sort((a, b) => Date.parse(b.submittedAt ?? '') - Date.parse(a.submittedAt ?? ''));

  const begin = async () => {
    setBusy(true);
    setError(null);
    const { mock } = await startMock(allowUnverified);
    setBusy(false);
    if (!mock) {
      setError('문제가 부족해 모의고사를 시작할 수 없습니다.');
      return;
    }
    navigate('/mock/run');
  };

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-xl font-black">실전 모의고사</h1>
        <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-ink-500 dark:text-ink-400">
          <span className="inline-flex items-center gap-1">
            <FileText aria-hidden className="h-4 w-4" />
            {TOTAL_QUESTIONS}문제 (과목당 25)
          </span>
          <span className="inline-flex items-center gap-1">
            <Clock aria-hidden className="h-4 w-4" />
            {MOCK_DURATION_MINUTES}분
          </span>
        </p>
      </header>

      {activeMock && !activeMock.submittedAt ? (
        <Card className="border-brand-400/60 bg-brand-50 dark:border-brand-500/40 dark:bg-brand-500/10">
          <p className="text-sm font-bold text-brand-800 dark:text-brand-200">
            진행 중인 모의고사가 있습니다
          </p>
          <p className="mt-1 text-xs text-brand-800/80 dark:text-brand-200/80">
            남은 시간은 시작 시각 기준으로 계속 흐릅니다.
          </p>
          <LinkButton to="/mock/run" variant="primary" full className="mt-3">
            이어서 응시
          </LinkButton>
        </Card>
      ) : null}

      <Card>
        <SectionTitle>사용 가능한 문제</SectionTitle>
        <ul className="space-y-1.5">
          {available.map(({ subject, count }) => {
            const need = SUBJECT_META[subject].questionCount;
            const ok = count >= need;
            return (
              <li key={subject} className="flex items-center justify-between text-sm">
                <span className="font-semibold">{SUBJECT_META[subject].name}</span>
                <span className={ok ? 'tabular-nums font-bold' : 'tabular-nums font-bold text-rose-600 dark:text-rose-400'}>
                  {count} / {need}
                  {ok ? '' : ` (${need - count} 부족)`}
                </span>
              </li>
            );
          })}
        </ul>

        <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-xl bg-ink-50 p-3 dark:bg-ink-800/60">
          <input
            type="checkbox"
            checked={allowUnverified}
            onChange={(event) => setAllowUnverified(event.target.checked)}
            className="mt-0.5 h-5 w-5 flex-none accent-brand-600"
          />
          <span className="text-xs leading-relaxed">
            <span className="font-bold">미검증 문제도 포함</span>
            <span className="block text-ink-500 dark:text-ink-400">
              AI 생성·샘플 문제가 실전 모의고사에 들어갑니다. 점수는 참고용으로만 보세요.
            </span>
          </span>
        </label>

        {!ready ? (
          <div className="mt-3 flex items-start gap-2 rounded-xl bg-amber-50 p-3 text-xs text-amber-800 dark:bg-amber-500/10 dark:text-amber-200">
            <AlertTriangle aria-hidden className="mt-0.5 h-4 w-4 flex-none" />
            <span>
              검증된 문제가 부족합니다 (현재 {verified.total}개). 빈 자리를 임의로 채우지 않습니다 —
              기출·공식자료를 가져오거나 위 옵션으로 미검증 문제를 허용하세요.
            </span>
          </div>
        ) : null}

        {error ? (
          <p role="alert" className="mt-3 text-xs font-semibold text-rose-600 dark:text-rose-400">
            {error}
          </p>
        ) : null}

        <Button
          variant="primary"
          size="lg"
          full
          className="mt-3"
          disabled={!ready || busy || Boolean(activeMock && !activeMock.submittedAt)}
          onClick={() => void begin()}
        >
          {busy ? '준비 중…' : `실전 ${TOTAL_QUESTIONS}문제 시작`}
        </Button>
        {!ready ? (
          <LinkButton to="/data" variant="ghost" size="sm" full className="mt-2">
            문제 가져오기
          </LinkButton>
        ) : null}
      </Card>

      {finished.length ? (
        <section>
          <SectionTitle>지난 결과</SectionTitle>
          <ul className="space-y-2">
            {finished.map((mock) => {
              const result = mock.result!;
              const band = scoreBand(result.weightedTotal);
              return (
                <li key={mock.id}>
                  <LinkButton to={`/mock/result/${mock.id}`} full className="justify-between">
                    <span className="flex flex-col items-start">
                      <span className="text-sm font-black tabular-nums">
                        {result.weightedTotal.toFixed(1)}점
                      </span>
                      <span className="text-[11px] font-normal text-ink-400">
                        {(mock.submittedAt ?? '').slice(0, 10)}
                        {mock.allowedUnverified ? ' · 미검증 포함' : ''}
                      </span>
                    </span>
                    <span className="flex items-center gap-1.5">
                      {result.cutoffFailures.length ? (
                        <Chip tone="bg-rose-500/12 text-rose-700 ring-rose-500/30 dark:text-rose-300">
                          과락
                        </Chip>
                      ) : null}
                      <Chip tone={band.tone}>{result.passed ? '합격' : '불합격'}</Chip>
                    </span>
                  </LinkButton>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
