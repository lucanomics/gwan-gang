import { useMemo, useState } from 'react';
import { Download, Trash2 } from 'lucide-react';
import { Button, Card, Chip, SectionTitle } from '../components/ui';
import { CopyButton } from '../components/CopyButton';
import { useStore } from '../lib/store';
import { useEstimate, useToday, useWeakness } from '../hooks/useDerived';
import {
  buildSnapshot,
  chatgptPrompt,
  geminiPrompt,
  notebookLmMarkdown,
  questionGenPrompt,
} from '../lib/studyPack';
import { downloadText, timestampSlug } from '../lib/file';
import { SUBJECTS, SUBJECT_META, type Subject } from '../lib/exam';

type Tab = 'chatgpt' | 'gemini' | 'notebooklm' | 'generate';

const TABS: { id: Tab; label: string }[] = [
  { id: 'chatgpt', label: 'ChatGPT Study' },
  { id: 'gemini', label: 'Gemini Study' },
  { id: 'notebooklm', label: 'NotebookLM' },
  { id: 'generate', label: '문제 생성' },
];

export default function StudyPackPage() {
  const estimate = useEstimate();
  const weakness = useWeakness();
  const today = useToday();
  const notes = useStore((s) => s.notes);
  const saveNote = useStore((s) => s.saveNote);
  const removeNote = useStore((s) => s.removeNote);

  const [tab, setTab] = useState<Tab>('chatgpt');
  const [includeNotes, setIncludeNotes] = useState(false);
  const [genCount, setGenCount] = useState(10);
  const [noteBody, setNoteBody] = useState('');
  const [noteSubject, setNoteSubject] = useState<Subject | ''>('');
  const [noteTopic, setNoteTopic] = useState('');

  const snapshot = useMemo(
    () => buildSnapshot({ estimate, weakness, todayISO: today, notes }),
    [estimate, notes, today, weakness],
  );

  const text = useMemo(() => {
    switch (tab) {
      case 'chatgpt':
        return chatgptPrompt(snapshot);
      case 'gemini':
        return geminiPrompt(snapshot);
      case 'notebooklm':
        return notebookLmMarkdown(snapshot, includeNotes);
      case 'generate':
        return questionGenPrompt(snapshot, genCount);
    }
  }, [genCount, includeNotes, snapshot, tab]);

  const copyLabel: Record<Tab, string> = {
    chatgpt: 'ChatGPT Study용 복사',
    gemini: 'Gemini Study용 복사',
    notebooklm: 'NotebookLM용 Markdown 복사',
    generate: 'AI 문제 생성용 프롬프트 복사',
  };

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-xl font-black">AI 학습팩</h1>
        <p className="mt-1 text-sm leading-relaxed text-ink-500 dark:text-ink-400">
          지금 내 약점 그대로를 다른 AI 튜터에 넘깁니다. API 연동 없이 복사·붙여넣기만 하면 됩니다.
        </p>
      </header>

      <Card>
        <p className="text-xs font-bold text-ink-500 dark:text-ink-400">현재 스냅샷</p>
        <p className="mt-1 text-sm">
          {snapshot.dday.label} ·{' '}
          {snapshot.weightedTotal === null ? (
            <span className="font-bold text-ink-400">데이터 부족</span>
          ) : (
            <span className="font-black tabular-nums">{snapshot.weightedTotal.toFixed(1)}점</span>
          )}{' '}
          · 복습 대기 {snapshot.dueCount}
        </p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {snapshot.subjects.map((s) => (
            <Chip key={s.subject}>
              {SUBJECT_META[s.subject].short}{' '}
              {s.expectedCorrect === null ? '—' : s.expectedCorrect.toFixed(1)}
            </Chip>
          ))}
        </div>
        {snapshot.weakTopics.length === 0 ? (
          <p className="mt-2 text-[11px] text-ink-400">
            취약 주제가 아직 없습니다. 문제를 조금 더 풀면 프롬프트가 더 정확해집니다.
          </p>
        ) : null}
      </Card>

      <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4">
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setTab(item.id)}
            aria-pressed={tab === item.id}
            className={
              tab === item.id
                ? 'flex-none rounded-full bg-ink-900 px-3 py-1.5 text-xs font-bold text-white dark:bg-white dark:text-ink-900'
                : 'flex-none rounded-full bg-ink-100 px-3 py-1.5 text-xs font-bold text-ink-600 dark:bg-ink-800 dark:text-ink-300'
            }
          >
            {item.label}
          </button>
        ))}
      </div>

      {tab === 'notebooklm' ? (
        <label className="flex cursor-pointer items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={includeNotes}
            onChange={(event) => setIncludeNotes(event.target.checked)}
            className="h-5 w-5 accent-brand-600"
          />
          내가 쓴 개념 메모 포함 ({notes.length}개)
        </label>
      ) : null}

      {tab === 'generate' ? (
        <label className="flex items-center gap-2 text-sm">
          문항 수
          <select
            value={genCount}
            onChange={(event) => setGenCount(Number(event.target.value))}
            className="rounded-lg border border-ink-200 bg-white px-2 py-1.5 text-sm dark:border-ink-700 dark:bg-ink-950"
          >
            {[5, 10, 15, 20].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      <CopyButton text={text} label={copyLabel[tab]} variant="primary" />

      {tab === 'notebooklm' ? (
        <Button
          full
          onClick={() =>
            downloadText(`gwan-gang-snapshot-${timestampSlug()}.md`, text, 'text/markdown')
          }
        >
          <Download aria-hidden className="h-4 w-4" />
          Markdown 파일로 내보내기
        </Button>
      ) : null}

      <Card>
        <SectionTitle>미리보기</SectionTitle>
        <pre className="max-h-96 overflow-auto whitespace-pre-wrap break-words text-[11px] leading-relaxed text-ink-600 dark:text-ink-300">
          {text}
        </pre>
      </Card>

      {tab === 'generate' ? (
        <Card className="bg-brand-50 dark:bg-brand-500/10">
          <p className="text-xs font-bold text-brand-800 dark:text-brand-200">되돌아오는 길</p>
          <ol className="mt-1 space-y-1 text-xs leading-relaxed text-brand-900/80 dark:text-brand-100/80">
            <li>1. 위 프롬프트를 ChatGPT / Gemini에 붙여넣습니다.</li>
            <li>2. 출력된 JSON 배열을 그대로 복사합니다.</li>
            <li>3. 데이터 화면의 &quot;JSON 직접 붙여넣기&quot;에 넣고 가져오기.</li>
          </ol>
        </Card>
      ) : null}

      <section>
        <SectionTitle>개념 메모</SectionTitle>
        <Card>
          <textarea
            value={noteBody}
            onChange={(event) => setNoteBody(event.target.value)}
            rows={3}
            placeholder="헷갈린 개념, 정리한 비교, 내 표현으로 쓴 요약…"
            className="w-full rounded-xl border border-ink-200 bg-white p-3 text-sm dark:border-ink-700 dark:bg-ink-950"
          />
          <div className="mt-2 flex gap-2">
            <select
              value={noteSubject}
              onChange={(event) => setNoteSubject(event.target.value as Subject | '')}
              aria-label="과목"
              className="flex-none rounded-lg border border-ink-200 bg-white px-2 py-2 text-sm dark:border-ink-700 dark:bg-ink-950"
            >
              <option value="">과목</option>
              {SUBJECTS.map((subject) => (
                <option key={subject} value={subject}>
                  {SUBJECT_META[subject].short}
                </option>
              ))}
            </select>
            <input
              value={noteTopic}
              onChange={(event) => setNoteTopic(event.target.value)}
              placeholder="주제 (선택)"
              aria-label="주제"
              className="min-w-0 flex-1 rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm dark:border-ink-700 dark:bg-ink-950"
            />
          </div>
          <Button
            variant="primary"
            full
            className="mt-2"
            disabled={noteBody.trim().length === 0}
            onClick={async () => {
              await saveNote({
                body: noteBody.trim(),
                subject: noteSubject || undefined,
                topic: noteTopic.trim() || undefined,
              });
              setNoteBody('');
              setNoteTopic('');
            }}
          >
            메모 추가
          </Button>
          <p className="mt-2 text-[11px] leading-relaxed text-ink-400">
            메모는 이 브라우저에만 저장됩니다. 교재 원문을 그대로 옮겨 적지 마세요.
          </p>

          {notes.length ? (
            <ul className="mt-3 space-y-2">
              {[...notes]
                .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))
                .slice(0, 10)
                .map((note) => (
                  <li
                    key={note.id}
                    className="rounded-xl bg-ink-50 p-3 text-sm dark:bg-ink-800/60"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="flex-1 whitespace-pre-line leading-relaxed">{note.body}</p>
                      <button
                        type="button"
                        onClick={() => void removeNote(note.id)}
                        aria-label="메모 삭제"
                        className="flex-none rounded-lg p-1.5 text-ink-400 hover:bg-ink-200 hover:text-rose-600 dark:hover:bg-ink-700"
                      >
                        <Trash2 aria-hidden className="h-4 w-4" />
                      </button>
                    </div>
                    {note.subject || note.topic ? (
                      <p className="mt-1 text-[11px] text-ink-400">
                        {[note.subject ? SUBJECT_META[note.subject].short : null, note.topic]
                          .filter(Boolean)
                          .join(' · ')}
                      </p>
                    ) : null}
                  </li>
                ))}
            </ul>
          ) : null}
        </Card>
      </section>
    </div>
  );
}
