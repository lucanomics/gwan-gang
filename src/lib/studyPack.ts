import { SUBJECTS, SUBJECT_META, type Subject } from './exam';
import { dday, type DDay } from './date';
import { cutoffStatus } from './scoring';
import type { PracticeEstimate } from './estimate';
import type { WeaknessReport } from './weakness';
import type { ConceptNote, ErrorType } from './types';
import { ERROR_TYPE_LABEL } from './types';

export interface SnapshotSubject {
  subject: Subject;
  name: string;
  expectedCorrect: number | null;
  accuracy: number | null;
  attempts: number;
  cutoff: string;
}

export interface StudySnapshot {
  today: string;
  dday: DDay;
  weightedTotal: number | null;
  subjects: SnapshotSubject[];
  weakTopics: { subject: string; topic: string; accuracy: number; wrong: number }[];
  errorDistribution: Record<ErrorType, number>;
  confusionPairs: string[];
  /** Ids and topics only — question text is never exported. */
  recentWrong: { id: string; subject: string; topic: string; errorType?: string }[];
  dueCount: number;
  openReviewCount: number;
  notes: ConceptNote[];
}

export function buildSnapshot(params: {
  estimate: PracticeEstimate;
  weakness: WeaknessReport;
  todayISO: string;
  notes?: ConceptNote[];
}): StudySnapshot {
  const { estimate, weakness, todayISO } = params;

  const subjects: SnapshotSubject[] = SUBJECTS.map((subject) => {
    const est = estimate.bySubject[subject];
    return {
      subject,
      name: SUBJECT_META[subject].name,
      expectedCorrect: est.expectedCorrect,
      accuracy: est.accuracy,
      attempts: est.attempts,
      cutoff:
        est.expectedCorrect === null
          ? '데이터 부족'
          : cutoffStatus(est.expectedCorrect).label,
    };
  });

  return {
    today: todayISO,
    dday: dday(todayISO),
    weightedTotal: estimate.weightedTotal,
    subjects,
    weakTopics: weakness.topics.slice(0, 10).map((t) => ({
      subject: SUBJECT_META[t.subject].name,
      topic: t.topic,
      accuracy: Math.round(t.accuracy * 100),
      wrong: t.wrong,
    })),
    errorDistribution: weakness.errorDistribution,
    confusionPairs: weakness.confusionPairs,
    recentWrong: weakness.recentWrong.map((r) => ({
      id: r.question.id,
      subject: SUBJECT_META[r.question.subject].name,
      topic: r.question.topic || r.question.chapter || '기타',
      errorType: r.errorType ? ERROR_TYPE_LABEL[r.errorType] : undefined,
    })),
    dueCount: weakness.dueCount,
    openReviewCount: weakness.openReviewCount,
    notes: params.notes ?? [],
  };
}

function scoreLine(snapshot: StudySnapshot): string {
  return snapshot.weightedTotal === null
    ? '현재 훈련 기준 점수: 데이터 부족 (아직 추정 불가)'
    : `현재 훈련 기준 점수: ${snapshot.weightedTotal.toFixed(1)} / 100 (가중 환산, 합격선 60)`;
}

function subjectLines(snapshot: StudySnapshot): string {
  return snapshot.subjects
    .map((s) => {
      const expected =
        s.expectedCorrect === null
          ? '데이터 부족'
          : `${s.expectedCorrect.toFixed(1)}/25 (${Math.round((s.accuracy ?? 0) * 100)}%)`;
      return `- ${s.name}: ${expected} — ${s.cutoff}`;
    })
    .join('\n');
}

function weakTopicLines(snapshot: StudySnapshot): string {
  if (!snapshot.weakTopics.length) return '- (아직 취약 주제 데이터가 부족합니다)';
  return snapshot.weakTopics
    .map((t) => `- ${t.subject} / ${t.topic} — 정답률 ${t.accuracy}%, 오답 ${t.wrong}회`)
    .join('\n');
}

function errorLine(snapshot: StudySnapshot): string {
  const d = snapshot.errorDistribution;
  return `몰랐음 ${d.knowledge} · 헷갈림 ${d.confusion} · 실수 ${d.mistake}`;
}

function confusionLines(snapshot: StudySnapshot): string {
  if (!snapshot.confusionPairs.length) return '- (등록된 혼동 개념 없음)';
  return snapshot.confusionPairs.map((c) => `- ${c}`).join('\n');
}

const EXAM_CONTEXT = [
  '시험: 2026년 관광통역안내사 1차 필기시험 (2026-09-05)',
  '과목: 관광국사(25문항, 40%) · 관광자원해설(25문항, 20%) · 관광법규(25문항, 20%) · 관광학개론(25문항, 20%)',
  '합격 조건: 가중 환산 총점 60점 이상 + 모든 과목 40%(25문항 중 10문항) 이상',
  '목표: 65~70점 (만점이 아니라 확실한 합격)',
].join('\n');

/** ChatGPT Study Mode handoff: one question at a time, 15-25 minutes. */
export function chatgptPrompt(snapshot: StudySnapshot): string {
  return `너는 2026 관광통역안내사 1차 필기시험 대비 개인 튜터다. ChatGPT Study Mode(학습 모드)로 진행한다.
가능하면 사용 가능한 가장 강력한 추론 모델(예: GPT-5.6 Sol 계열)을 사용해 주세요.

[시험 정보]
${EXAM_CONTEXT}
남은 기간: ${snapshot.dday.label} (오늘 ${snapshot.today}, Asia/Seoul)

[내 현재 상태]
${scoreLine(snapshot)}
${subjectLines(snapshot)}
오답 유형 분포: ${errorLine(snapshot)}
복습 대기: ${snapshot.dueCount}개 (전체 미완료 오답 ${snapshot.openReviewCount}개)

[집중해야 할 취약 주제]
${weakTopicLines(snapshot)}

[헷갈리는 개념 쌍]
${confusionLines(snapshot)}

[진행 방식 — 반드시 지킬 것]
1. 15~25분 분량의 짧은 집중 세션으로 진행한다.
2. 반드시 한 번에 한 문제씩만 낸다. 내 답을 기다린 뒤 다음으로 넘어간다.
3. 위 취약 주제에 문제를 몰아서 배분한다. 이미 잘 하는 영역은 다루지 않는다.
4. 내가 틀리면 3~5줄로 간결하게 설명한다. 긴 강의는 하지 않는다.
5. 내가 "몰라서 틀린 것"인지 "헷갈려서 틀린 것"인지 구분해서 지적하고, 헷갈림이면 두 개념을 나란히 비교해 준다.
6. 실제 시험처럼 4지선다 형태를 기본으로 하되, 필요하면 단답 확인 질문을 섞는다.
7. 내가 자료(교재 사진, 필기 이미지, PDF)를 올리면 그 자료를 최우선 근거로 삼는다.
8. 근거가 불확실한 사실은 지어내지 말고 "확실하지 않다"고 말한다. 특히 법규의 숫자·기간·권한 주체는 추측하지 않는다.
9. 세션 마지막에 내가 다시 봐야 할 항목 5개를 목록으로 정리해 준다.

준비되면 첫 문제부터 시작해 줘.`;
}

/** Gemini Study Notebook handoff: 20-30 minute diagnostic + retest block. */
export function geminiPrompt(snapshot: StudySnapshot): string {
  return `너는 2026 관광통역안내사 1차 필기시험 대비 학습 코치다. Gemini Study Notebook에서 20~30분 진단·복습 블록을 진행한다.

[시험 정보]
${EXAM_CONTEXT}
남은 기간: ${snapshot.dday.label} (오늘 ${snapshot.today}, Asia/Seoul)

[내 현재 상태]
${scoreLine(snapshot)}
${subjectLines(snapshot)}
오답 유형 분포: ${errorLine(snapshot)}

[집중해야 할 취약 주제]
${weakTopicLines(snapshot)}

[헷갈리는 개념 쌍]
${confusionLines(snapshot)}

[진행 방식 — 반드시 지킬 것]
1. 내가 업로드한 학습 자료가 있으면 그것을 1차 근거로 삼는다. 자료에 없는 내용은 그렇다고 밝힌다.
2. 먼저 위 취약 주제에서 5~7문항의 짧은 진단 퀴즈를 낸다. 한 번에 한 문제씩.
3. 진단 결과에 따라 가장 약한 2개 주제만 골라 한 입 크기(3~5문장) 설명을 한다.
4. 설명 직후 곧바로 같은 개념을 다른 각도에서 다시 물어본다(즉시 재테스트).
5. 시험에서 실제로 갈리는 '구분 문제'를 우선한다: 등록/신고/허가/지정, 숫자·기간·권한 주체, 유사한 왕·사건·문화재.
6. 동기부여성 격려나 일반론적인 서론은 넣지 않는다. 바로 문제와 설명만.
7. 마지막에 오늘 세션에서 확인된 약점을 3줄로 요약한다.

첫 진단 문제부터 시작해 줘.`;
}

/** NotebookLM-friendly Markdown snapshot. Topic-level only, no textbook text. */
export function notebookLmMarkdown(snapshot: StudySnapshot, includeNotes: boolean): string {
  const lines: string[] = [];
  lines.push('# GWAN-GANG Study Snapshot');
  lines.push('');
  lines.push('## 시험');
  lines.push('- 2026 관광통역안내사 1차 필기시험 (2026-09-05, Asia/Seoul)');
  lines.push(`- 남은 기간: ${snapshot.dday.label} (기준일 ${snapshot.today})`);
  lines.push('- 합격 조건: 가중 총점 60점 이상 + 전 과목 10/25 이상');
  lines.push('');
  lines.push('## 현재 점수');
  lines.push(`- ${scoreLine(snapshot).replace('현재 훈련 기준 점수: ', '')}`);
  lines.push('');
  lines.push('## 과목별 상태');
  lines.push(subjectLines(snapshot));
  lines.push('');
  lines.push('## 취약 주제');
  lines.push(weakTopicLines(snapshot));
  lines.push('');
  lines.push('## 혼동 개념');
  lines.push(confusionLines(snapshot));
  lines.push('');
  lines.push('## 오답 유형');
  lines.push(`- ${errorLine(snapshot)}`);
  lines.push('');
  lines.push('## 최근 오답 (식별자 · 주제)');
  if (snapshot.recentWrong.length) {
    snapshot.recentWrong.forEach((r) => {
      lines.push(`- \`${r.id}\` — ${r.subject} / ${r.topic}${r.errorType ? ` (${r.errorType})` : ''}`);
    });
  } else {
    lines.push('- (없음)');
  }
  lines.push('');
  lines.push('## 지금 복습해야 할 것');
  lines.push(`- 복습 대기 ${snapshot.dueCount}개 / 미완료 오답 ${snapshot.openReviewCount}개`);
  const risky = snapshot.subjects.filter((s) => s.cutoff === '과락 위험');
  if (risky.length) {
    lines.push(`- 과락 위험 과목: ${risky.map((s) => s.name).join(', ')} — 최우선`);
  }
  snapshot.weakTopics.slice(0, 5).forEach((t) => {
    lines.push(`- ${t.subject} / ${t.topic}`);
  });

  if (includeNotes && snapshot.notes.length) {
    lines.push('');
    lines.push('## 내 개념 메모');
    snapshot.notes.forEach((note) => {
      const head = [note.subject ? SUBJECT_META[note.subject].name : null, note.topic]
        .filter(Boolean)
        .join(' / ');
      lines.push('');
      lines.push(`### ${head || '메모'}`);
      lines.push(note.body);
    });
  }

  lines.push('');
  lines.push('---');
  lines.push('_문제 본문과 교재 원문은 포함하지 않습니다 (주제·식별자 수준만 내보냄)._');
  return lines.join('\n');
}

/** Prompt that makes an external LLM emit importable GWAN-GANG JSON. */
export function questionGenPrompt(snapshot: StudySnapshot, count = 10): string {
  const topics = snapshot.weakTopics.length
    ? snapshot.weakTopics.slice(0, 6).map((t) => `${t.subject} / ${t.topic}`).join('\n- ')
    : '(취약 주제 데이터가 없으므로, 내가 아래에 직접 적어 주는 개념만 사용할 것)';

  return `너는 2026 관광통역안내사 1차 필기시험 대비 문제 출제기다.
아래 조건을 지켜 ${count}문항을 만들고, **오직 JSON 배열만** 출력한다. 설명, 인사말, 코드펜스 밖 텍스트 금지.

[출제 대상 주제]
- ${topics}

[출제 규칙]
1. 선택지는 정확히 4개. 정답은 정확히 1개.
2. correctAnswer는 0부터 시작하는 인덱스(0~3)다.
3. explanation은 2~5줄로 간결하게. 왜 다른 선택지가 틀렸는지 핵심만.
4. subject는 "history"(관광국사) / "resources"(관광자원해설) / "law"(관광법규) / "tourism"(관광학개론) 중 하나.
5. sourceType은 반드시 "ai-generated", verificationStatus는 반드시 "unverified".
6. 절대로 실제 기출문제라고 주장하지 말 것. 연도·회차를 지어내지 말 것.
7. 교재 원문을 그대로 옮기지 말 것. 개념 기반으로 새로 작성할 것.
8. 사실이 불확실하면 그 문항을 만들지 말고 건너뛸 것. 특히 법령의 숫자·기간·권한 주체는 확실한 것만.
9. 시험에서 실제로 갈리는 '구분형' 문제를 우선한다(등록/신고/허가/지정, 유사 개념 비교, 숫자·기간).
10. id는 "ai-<주제약어>-<3자리번호>" 형식으로 서로 겹치지 않게.

[출력 스키마 — 배열의 각 원소]
{
  "id": "ai-law-001",
  "subject": "law",
  "topic": "관광진흥법",
  "question": "문제 본문",
  "choices": ["①내용", "②내용", "③내용", "④내용"],
  "correctAnswer": 0,
  "explanation": "간결한 해설",
  "sourceType": "ai-generated",
  "verificationStatus": "unverified",
  "tags": ["등록", "주체"]
}

이제 JSON 배열만 출력해라.`;
}
