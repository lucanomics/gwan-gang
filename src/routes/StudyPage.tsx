import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { GitCompareArrows, Play } from 'lucide-react';
import { Button, Card, Chip, EmptyState, LinkButton, SectionTitle } from '../components/ui';
import { useStore } from '../lib/store';
import { usePracticePool } from '../hooks/useDerived';
import { SUBJECTS, SUBJECT_META, type Subject } from '../lib/exam';

export default function StudyPage() {
  const navigate = useNavigate();
  const startSession = useStore((s) => s.startSession);
  const questions = useStore((s) => s.questions);
  const { counts, total } = usePracticePool();
  const [busy, setBusy] = useState<string | null>(null);

  const confusionCount = questions.filter((q) => (q.confusionPair?.length ?? 0) > 0).length;

  const launch = async (key: string, options: Parameters<typeof startSession>[0]) => {
    setBusy(key);
    const session = await startSession(options);
    setBusy(null);
    if (session) navigate('/session');
  };

  if (total === 0) {
    return (
      <EmptyState
        title="문제은행을 추가하면 학습을 시작할 수 있습니다."
        description="문제를 가져오면 과목별 훈련과 VS 모드가 열립니다."
      >
        <LinkButton to="/data" variant="primary" full>
          문제 가져오기
        </LinkButton>
      </EmptyState>
    );
  }

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-xl font-black">학습</h1>
        <p className="mt-1 text-sm text-ink-500 dark:text-ink-400">
          무엇을 풀지 고민되면 홈의 <span className="font-semibold">지금 10문제</span>가 정답입니다.
        </p>
      </header>

      <section>
        <SectionTitle>빠른 시작</SectionTitle>
        <div className="grid grid-cols-2 gap-2">
          <Button
            variant="primary"
            size="lg"
            disabled={busy !== null}
            onClick={() => void launch('q10', { mode: 'quick10', count: 10 })}
          >
            <Play aria-hidden className="h-5 w-5" />
            10문제
          </Button>
          <Button
            size="lg"
            disabled={busy !== null}
            onClick={() => void launch('q5', { mode: 'quick5', count: 5 })}
          >
            5문제만
          </Button>
        </div>
      </section>

      <section>
        <SectionTitle>과목별 25문제</SectionTitle>
        <ul className="space-y-2">
          {SUBJECTS.map((subject) => (
            <li key={subject}>
              <SubjectRow
                subject={subject}
                available={counts[subject]}
                busy={busy === subject}
                disabled={busy !== null || counts[subject] === 0}
                onStart={() =>
                  void launch(subject, {
                    mode: 'subject25',
                    subject,
                    count: Math.min(25, counts[subject]),
                  })
                }
              />
            </li>
          ))}
        </ul>
      </section>

      <section>
        <SectionTitle>헷갈림 VS 모드</SectionTitle>
        <Card>
          <div className="flex items-start gap-3">
            <GitCompareArrows aria-hidden className="mt-0.5 h-5 w-5 flex-none text-brand-500" />
            <div className="flex-1">
              <p className="text-sm font-bold">비슷해서 틀리는 개념만 골라 훈련</p>
              <p className="mt-1 text-xs text-ink-500 dark:text-ink-400">
                등록/신고/허가/지정, 유사한 왕·사건·자원처럼 구분이 필요한 문제만 모읍니다.
              </p>
              <p className="mt-2 text-xs text-ink-400">
                대상 문제 {confusionCount}개
                {confusionCount === 0 ? ' · confusionPair 태그가 있는 문제가 필요합니다' : ''}
              </p>
            </div>
          </div>
          <Button
            variant="primary"
            full
            className="mt-3"
            disabled={busy !== null || confusionCount === 0}
            onClick={() => void launch('vs', { mode: 'vs', count: Math.min(10, confusionCount) })}
          >
            VS 문제 풀기
          </Button>
        </Card>
      </section>
    </div>
  );
}

function SubjectRow({
  subject,
  available,
  busy,
  disabled,
  onStart,
}: {
  subject: Subject;
  available: number;
  busy: boolean;
  disabled: boolean;
  onStart: () => void;
}) {
  const meta = SUBJECT_META[subject];
  return (
    <Card className="flex items-center justify-between gap-3 py-3">
      <div>
        <p className="text-sm font-bold">{meta.name}</p>
        <p className="mt-0.5 flex items-center gap-1.5 text-xs text-ink-400">
          <span>보유 {available}문제</span>
          {subject === 'history' ? (
            <Chip tone="bg-amber-500/12 text-amber-700 ring-amber-500/30 dark:text-amber-300">
              배점 2배
            </Chip>
          ) : null}
        </p>
      </div>
      <Button size="sm" onClick={onStart} disabled={disabled}>
        {busy ? '준비 중…' : available === 0 ? '문제 없음' : '시작'}
      </Button>
    </Card>
  );
}
