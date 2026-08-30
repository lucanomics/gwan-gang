import { useMemo, useRef, useState } from 'react';
import { Download, FileJson, Trash2, Upload } from 'lucide-react';
import { Button, Card, Chip, SectionTitle } from '../components/ui';
import { CopyButton } from '../components/CopyButton';
import { useStore } from '../lib/store';
import { CSV_TEMPLATE, importQuestions, type ImportReport } from '../lib/import';
import { buildBackup, parseBackup } from '../lib/backup';
import { downloadText, timestampSlug } from '../lib/file';
import { isValidISODate } from '../lib/date';
import { SUBJECTS, SUBJECT_META } from '../lib/exam';
import { SOURCE_LABEL } from '../lib/types';

const JSON_EXAMPLE = `[
  {
    "id": "law-2024-001",
    "subject": "law",
    "topic": "관광진흥법",
    "question": "문제 본문",
    "choices": ["선택지1", "선택지2", "선택지3", "선택지4"],
    "correctAnswer": 0,
    "explanation": "간결한 해설 (2~5줄)",
    "sourceType": "official-past-exam",
    "sourceLabel": "2024년 정기 1차",
    "sourceYear": 2024,
    "verificationStatus": "verified",
    "tags": ["등록", "주체"]
  }
]`;

export default function DataPage() {
  const store = useStore();
  const [report, setReport] = useState<ImportReport | null>(null);
  const [pasted, setPasted] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [confirmReset, setConfirmReset] = useState<'progress' | 'all' | null>(null);
  const questionFileRef = useRef<HTMLInputElement>(null);
  const backupFileRef = useRef<HTMLInputElement>(null);

  const existingIds = useMemo(
    () => new Set(store.questions.map((q) => q.id)),
    [store.questions],
  );

  const bankSummary = useMemo(() => {
    const bySubject = { history: 0, resources: 0, law: 0, tourism: 0 } as Record<string, number>;
    const bySource = new Map<string, number>();
    let verified = 0;
    for (const q of store.questions) {
      bySubject[q.subject] += 1;
      bySource.set(q.sourceType, (bySource.get(q.sourceType) ?? 0) + 1);
      if (q.verificationStatus === 'verified') verified += 1;
    }
    return { bySubject, bySource: [...bySource.entries()], verified, total: store.questions.length };
  }, [store.questions]);

  const runImport = async (text: string, filename: string) => {
    setBusy(true);
    setMessage(null);
    const result = importQuestions(text, filename, existingIds);
    setReport(result);
    if (result.questions.length) {
      await store.addQuestions(result.questions);
      setMessage(`${result.questions.length}문제를 가져왔습니다.`);
    }
    setBusy(false);
  };

  const onQuestionFile = async (file: File | undefined) => {
    if (!file) return;
    await runImport(await file.text(), file.name);
  };

  const onBackupFile = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    const parsed = parseBackup(await file.text());
    if (!parsed.data) {
      setMessage(parsed.errors.join(' / '));
      setBusy(false);
      return;
    }
    await store.restore(parsed.data);
    const dropped = Object.entries(parsed.skipped)
      .map(([k, v]) => `${k} ${v}건`)
      .join(', ');
    setMessage(`백업을 복원했습니다.${dropped ? ` (형식 오류로 제외: ${dropped})` : ''}`);
    setBusy(false);
  };

  const exportBackup = () => {
    const payload = buildBackup({
      questions: store.questions,
      attempts: store.attempts,
      reviews: store.reviews,
      sessions: store.sessions,
      mocks: store.mocks,
      notes: store.notes,
      preferences: store.preferences,
    });
    downloadText(`gwan-gang-backup-${timestampSlug()}.json`, JSON.stringify(payload, null, 2));
    setMessage('백업 파일을 내려받았습니다.');
  };

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-xl font-black">데이터</h1>
        <p className="mt-1 text-sm text-ink-500 dark:text-ink-400">
          모든 데이터는 이 브라우저에만 저장됩니다. 서버로 전송되지 않습니다.
        </p>
      </header>

      {message ? (
        <p role="status" className="rounded-xl bg-brand-50 px-3 py-2 text-sm font-semibold text-brand-800 dark:bg-brand-500/10 dark:text-brand-200">
          {message}
        </p>
      ) : null}

      <section>
        <SectionTitle>문제은행</SectionTitle>
        <Card>
          <p className="text-sm">
            총 <span className="font-black tabular-nums">{bankSummary.total}</span>문제 · 검증됨{' '}
            <span className="font-black tabular-nums">{bankSummary.verified}</span>
          </p>
          <ul className="mt-2 space-y-1 text-xs text-ink-500 dark:text-ink-400">
            {SUBJECTS.map((subject) => (
              <li key={subject} className="flex justify-between">
                <span>{SUBJECT_META[subject].name}</span>
                <span className="tabular-nums">{bankSummary.bySubject[subject]}</span>
              </li>
            ))}
          </ul>
          {bankSummary.bySource.length ? (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {bankSummary.bySource.map(([source, count]) => (
                <Chip key={source}>
                  {SOURCE_LABEL[source as keyof typeof SOURCE_LABEL] ?? source} {count}
                </Chip>
              ))}
            </div>
          ) : null}
        </Card>
      </section>

      <section>
        <SectionTitle>문제 가져오기</SectionTitle>
        <Card>
          <input
            ref={questionFileRef}
            type="file"
            accept=".json,.csv,application/json,text/csv"
            className="sr-only"
            onChange={(event) => {
              void onQuestionFile(event.target.files?.[0]);
              event.target.value = '';
            }}
          />
          <Button
            variant="primary"
            full
            disabled={busy}
            onClick={() => questionFileRef.current?.click()}
          >
            <Upload aria-hidden className="h-4 w-4" />
            JSON / CSV 파일 선택
          </Button>

          <p className="mt-4 text-xs font-bold text-ink-500 dark:text-ink-400">
            또는 JSON을 직접 붙여넣기
          </p>
          <textarea
            value={pasted}
            onChange={(event) => setPasted(event.target.value)}
            rows={5}
            spellCheck={false}
            placeholder='[{"id":"...","subject":"law", ...}]'
            className="mt-1 w-full rounded-xl border border-ink-200 bg-white p-3 font-mono text-xs dark:border-ink-700 dark:bg-ink-950"
          />
          <Button
            full
            className="mt-2"
            disabled={busy || pasted.trim().length === 0}
            onClick={() => void runImport(pasted, 'pasted.json')}
          >
            붙여넣은 내용 가져오기
          </Button>

          {report ? <ImportReportView report={report} /> : null}
        </Card>
      </section>

      <section id="format">
        <SectionTitle>형식</SectionTitle>
        <Card>
          <p className="text-xs font-bold">JSON</p>
          <pre className="mt-1 overflow-x-auto rounded-xl bg-ink-900 p-3 text-[11px] leading-relaxed text-ink-100">
            {JSON_EXAMPLE}
          </pre>
          <CopyButton text={JSON_EXAMPLE} label="JSON 예시 복사" />

          <p className="mt-4 text-xs font-bold">CSV (answer 열은 1~4)</p>
          <pre className="mt-1 overflow-x-auto rounded-xl bg-ink-900 p-3 text-[11px] leading-relaxed text-ink-100">
            {CSV_TEMPLATE}
          </pre>
          <CopyButton text={CSV_TEMPLATE} label="CSV 템플릿 복사" />

          <ul className="mt-4 space-y-1 text-[11px] leading-relaxed text-ink-500 dark:text-ink-400">
            <li>· subject: history / resources / law / tourism</li>
            <li>· JSON의 correctAnswer는 0부터, CSV의 answer는 1부터 셉니다.</li>
            <li>· 선택지는 정확히 4개여야 합니다.</li>
            <li>· sourceType은 필수입니다. AI 생성 문제는 항상 미검증으로 저장됩니다.</li>
          </ul>
        </Card>
      </section>

      <section>
        <SectionTitle>백업</SectionTitle>
        <Card className="space-y-2">
          <Button full onClick={exportBackup}>
            <Download aria-hidden className="h-4 w-4" />
            데이터 내보내기
          </Button>
          <input
            ref={backupFileRef}
            type="file"
            accept=".json,application/json"
            className="sr-only"
            onChange={(event) => {
              void onBackupFile(event.target.files?.[0]);
              event.target.value = '';
            }}
          />
          <Button full disabled={busy} onClick={() => backupFileRef.current?.click()}>
            <FileJson aria-hidden className="h-4 w-4" />
            데이터 가져오기 (백업 복원)
          </Button>
          <p className="text-[11px] leading-relaxed text-ink-400">
            복원하면 현재 브라우저의 학습 기록이 백업 내용으로 교체됩니다.
          </p>
        </Card>
      </section>

      <section>
        <SectionTitle>설정</SectionTitle>
        <Card className="space-y-3">
          <Toggle
            checked={store.preferences.includeUnverifiedInPractice}
            onChange={(v) => void store.setPreferences({ includeUnverifiedInPractice: v })}
            label="일반 학습에 미검증 문제 포함"
            hint="AI 생성·직접 입력 문제를 연습에 사용합니다. 모의고사에는 별도 설정이 필요합니다."
          />
          <Toggle
            checked={store.preferences.includeSamples}
            onChange={(v) => void store.setPreferences({ includeSamples: v })}
            label="개발용 샘플 문제 포함"
            hint="가상 내용의 데모 문제입니다. 점수 추정에는 절대 반영되지 않습니다."
          />
          <Toggle
            checked={store.preferences.showQuestionTimer}
            onChange={(v) => void store.setPreferences({ showQuestionTimer: v })}
            label="문제별 타이머 표시"
          />
          <Toggle
            checked={store.preferences.keyboardShortcuts}
            onChange={(v) => void store.setPreferences({ keyboardShortcuts: v })}
            label="키보드 단축키 (1~4 선택, Enter 다음)"
          />

          <div>
            <label htmlFor="simulated-date" className="text-sm font-semibold">
              날짜 시뮬레이션
            </label>
            <p className="mb-1 text-[11px] text-ink-400">
              D-day와 최종 복습 모드 확인용입니다. 비우면 실제 오늘 날짜(Asia/Seoul)를 씁니다.
            </p>
            <input
              id="simulated-date"
              type="date"
              value={store.preferences.simulatedDate ?? ''}
              onChange={(event) => {
                const value = event.target.value;
                void store.setPreferences({
                  simulatedDate: value && isValidISODate(value) ? value : undefined,
                });
              }}
              className="w-full rounded-xl border border-ink-200 bg-white p-3 text-sm dark:border-ink-700 dark:bg-ink-950"
            />
          </div>
        </Card>
      </section>

      <section>
        <SectionTitle>초기화</SectionTitle>
        <Card className="space-y-2">
          {confirmReset === null ? (
            <>
              <Button variant="danger" full onClick={() => setConfirmReset('progress')}>
                <Trash2 aria-hidden className="h-4 w-4" />
                학습기록 초기화
              </Button>
              <Button variant="ghost" full onClick={() => setConfirmReset('all')}>
                문제은행까지 전체 삭제
              </Button>
            </>
          ) : (
            <div role="alertdialog" aria-labelledby="reset-title">
              <p id="reset-title" className="text-sm font-bold text-rose-700 dark:text-rose-300">
                {confirmReset === 'progress'
                  ? '학습 기록(오답·복습·모의고사)을 모두 지웁니다. 되돌릴 수 없습니다.'
                  : '문제은행과 메모를 포함한 모든 데이터를 지웁니다. 되돌릴 수 없습니다.'}
              </p>
              <p className="mt-1 text-xs text-ink-500">
                먼저 <span className="font-semibold">데이터 내보내기</span>로 백업하는 것을 권합니다.
              </p>
              <div className="mt-3 flex gap-2">
                <Button className="flex-1" onClick={() => setConfirmReset(null)}>
                  취소
                </Button>
                <Button
                  variant="danger"
                  className="flex-1"
                  onClick={async () => {
                    if (confirmReset === 'progress') await store.resetProgress();
                    else await store.resetEverything();
                    setConfirmReset(null);
                    setMessage('초기화했습니다.');
                  }}
                >
                  삭제
                </Button>
              </div>
            </div>
          )}
        </Card>
      </section>
    </div>
  );
}

function Toggle({
  checked,
  onChange,
  label,
  hint,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
  hint?: string;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-0.5 h-5 w-5 flex-none accent-brand-600"
      />
      <span className="text-sm">
        <span className="font-semibold">{label}</span>
        {hint ? <span className="block text-[11px] text-ink-400">{hint}</span> : null}
      </span>
    </label>
  );
}

function ImportReportView({ report }: { report: ImportReport }) {
  return (
    <div className="mt-4 rounded-xl bg-ink-50 p-3 dark:bg-ink-800/60">
      <p className="text-sm font-bold">
        가져오기 결과: 성공 {report.questions.length} / 전체 {report.total}
      </p>
      {report.duplicatesInBank.length ? (
        <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">
          기존 문제 {report.duplicatesInBank.length}개를 같은 id로 덮어썼습니다.
        </p>
      ) : null}
      {report.errors.length ? (
        <>
          <p className="mt-2 text-xs font-bold text-rose-700 dark:text-rose-300">
            오류 {report.errors.length}건
          </p>
          <ul className="mt-1 max-h-48 space-y-1 overflow-y-auto text-[11px] leading-relaxed text-rose-700 dark:text-rose-300">
            {report.errors.slice(0, 20).map((error, i) => (
              <li key={i}>
                {error.row > 0 ? `${error.row}행` : '파일'}
                {error.id ? ` (${error.id})` : ''}: {error.messages.join(' / ')}
              </li>
            ))}
          </ul>
          {report.errors.length > 20 ? (
            <p className="mt-1 text-[11px] text-ink-400">…외 {report.errors.length - 20}건</p>
          ) : null}
        </>
      ) : (
        <p className="mt-1 text-xs text-emerald-700 dark:text-emerald-300">오류 없음</p>
      )}
    </div>
  );
}
