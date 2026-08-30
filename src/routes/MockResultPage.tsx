import { useMemo, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import clsx from 'clsx';
import { AlertTriangle } from 'lucide-react';
import { Button, Card, Chip, LinkButton, SectionTitle } from '../components/ui';
import { QuestionBadges } from '../components/QuestionBadges';
import { useStore } from '../lib/store';
import { useQuestionsById } from '../hooks/useDerived';
import { SUBJECTS, SUBJECT_CUTOFF_CORRECT, SUBJECT_META } from '../lib/exam';
import { evaluateExam, scoreBand } from '../lib/scoring';

export default function MockResultPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const mocks = useStore((s) => s.mocks);
  const startSession = useStore((s) => s.startSession);
  const byId = useQuestionsById();
  const [busy, setBusy] = useState(false);

  const mock = mocks.find((m) => m.id === id);
  const result = mock?.result;

  const weakTopics = useMemo(() => {
    if (!result) return [];
    const map = new Map<string, number>();
    result.wrongQuestionIds.forEach((qid) => {
      const question = byId.get(qid);
      if (!question) return;
      const key = `${SUBJECT_META[question.subject].short} · ${question.topic ?? '기타'}`;
      map.set(key, (map.get(key) ?? 0) + 1);
    });
    return [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
  }, [byId, result]);

  if (!mock || !result) return <Navigate to="/mock" replace />;

  const evaluation = evaluateExam(result.correctBySubject);
  const band = scoreBand(result.weightedTotal);

  const drill = async () => {
    setBusy(true);
    const session = await startSession({ mode: 'review', count: 10 });
    setBusy(false);
    if (session) navigate('/session');
  };

  return (
    <div className="space-y-4">
      <Card className="text-center">
        <p className="text-xs font-bold uppercase tracking-widest text-ink-400">모의고사 결과</p>
        <p className="mt-2 text-5xl font-black tabular-nums">
          {result.weightedTotal.toFixed(1)}
          <span className="text-2xl text-ink-400"> / 100</span>
        </p>
        <div className="mt-3 flex flex-wrap justify-center gap-1.5">
          <Chip tone={band.tone}>{band.label}</Chip>
          <Chip
            tone={
              result.passed
                ? 'bg-emerald-500/12 text-emerald-700 ring-emerald-500/30 dark:text-emerald-300'
                : 'bg-rose-500/12 text-rose-700 ring-rose-500/30 dark:text-rose-300'
            }
          >
            {result.passed ? '합격 기준 충족' : '불합격'}
          </Chip>
          {mock.allowedUnverified ? (
            <Chip tone="bg-amber-500/12 text-amber-700 ring-amber-500/30 dark:text-amber-300">
              미검증 문제 포함 · 참고용
            </Chip>
          ) : null}
        </div>
        {!result.passed && evaluation.metScoreThreshold && result.cutoffFailures.length ? (
          <p className="mt-3 rounded-xl bg-rose-50 p-3 text-xs font-semibold text-rose-800 dark:bg-rose-500/10 dark:text-rose-200">
            총점은 60점을 넘었지만{' '}
            {result.cutoffFailures.map((s) => SUBJECT_META[s].name).join(', ')} 과락으로 불합격입니다.
          </p>
        ) : null}
        <p className="mt-3 text-xs text-ink-400">
          소요 {Math.round(result.durationMs / 60000)}분 · 미응답 {result.unansweredQuestionIds.length}문제
        </p>
      </Card>

      <section>
        <SectionTitle>과목별</SectionTitle>
        <ul className="space-y-2">
          {SUBJECTS.map((subject) => {
            const correct = result.correctBySubject[subject] ?? 0;
            const failed = result.cutoffFailures.includes(subject);
            return (
              <Card as="li" key={subject} className="flex items-center justify-between gap-3 py-3">
                <div>
                  <p className="text-sm font-bold">{SUBJECT_META[subject].name}</p>
                  <p className="mt-0.5 text-[11px] text-ink-400">
                    환산 {evaluation.contribution[subject].toFixed(1)}점 · 문항당{' '}
                    {SUBJECT_META[subject].pointsPerCorrect}점
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {failed ? (
                    <Chip tone="bg-rose-500/12 text-rose-700 ring-rose-500/30 dark:text-rose-300">
                      <AlertTriangle aria-hidden className="h-3 w-3" />
                      과락
                    </Chip>
                  ) : null}
                  <span
                    className={clsx(
                      'text-lg font-black tabular-nums',
                      failed && 'text-rose-600 dark:text-rose-400',
                    )}
                  >
                    {correct}
                    <span className="text-sm text-ink-400"> / 25</span>
                  </span>
                </div>
              </Card>
            );
          })}
        </ul>
        <p className="mt-2 text-[11px] text-ink-400">
          과락 기준: 과목당 {SUBJECT_CUTOFF_CORRECT}문제(40%) 미만이면 총점과 무관하게 불합격입니다.
        </p>
      </section>

      {weakTopics.length ? (
        <section>
          <SectionTitle>약한 주제</SectionTitle>
          <div className="flex flex-wrap gap-1.5">
            {weakTopics.map(([topic, count]) => (
              <Chip key={topic} tone="bg-rose-500/12 text-rose-700 ring-rose-500/25 dark:text-rose-300">
                {topic} {count}
              </Chip>
            ))}
          </div>
        </section>
      ) : null}

      <section>
        <SectionTitle>틀린 문제 ({result.wrongQuestionIds.length})</SectionTitle>
        <ul className="space-y-2">
          {result.wrongQuestionIds.slice(0, 25).map((qid) => {
            const question = byId.get(qid);
            if (!question) return null;
            const picked = mock.answers[qid];
            return (
              <Card as="li" key={qid} className="py-3">
                <QuestionBadges question={question} />
                <p className="mt-2 line-clamp-2 text-sm font-semibold leading-relaxed">
                  {question.question}
                </p>
                <p className="mt-1 text-xs text-ink-500 dark:text-ink-400">
                  {picked === undefined ? '미응답' : `내 답 ${picked + 1}번`} · 정답{' '}
                  {question.correctAnswer + 1}번
                </p>
              </Card>
            );
          })}
        </ul>
        {result.wrongQuestionIds.length > 25 ? (
          <p className="mt-2 text-center text-xs text-ink-400">
            25개까지 표시했습니다. 나머지는 오답 복습에서 이어집니다.
          </p>
        ) : null}
      </section>

      <div className="space-y-2">
        <Button variant="primary" size="lg" full disabled={busy} onClick={() => void drill()}>
          바로 오답 10문제 훈련
        </Button>
        <LinkButton to="/mock" variant="ghost" full>
          모의고사 목록
        </LinkButton>
      </div>
    </div>
  );
}
