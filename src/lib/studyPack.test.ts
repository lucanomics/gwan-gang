import { describe, expect, it } from 'vitest';
import {
  buildSnapshot,
  chatgptPrompt,
  geminiPrompt,
  notebookLmMarkdown,
  questionGenPrompt,
} from './studyPack';
import { estimatePractice } from './estimate';
import { analyseWeakness } from './weakness';
import { makeAttempt, makeBank, makeQuestion } from './testing';
import type { Attempt, ConceptNote } from './types';

const NOW = Date.parse('2026-08-30T09:00:00Z');
const TODAY = '2026-08-30';

function scenario() {
  const bank = [
    ...makeBank(10),
    makeQuestion({
      id: 'law-weak',
      subject: 'law',
      topic: '관광진흥법 등록',
      confusionPair: ['등록 vs 신고'],
      verificationStatus: 'verified',
      sourceType: 'official-past-exam',
    }),
  ];
  const byId = new Map(bank.map((q) => [q.id, q]));

  const attempts: Attempt[] = bank.flatMap((q, i) => [
    makeAttempt({
      questionId: q.id,
      correct: q.id !== 'law-weak' && i % 4 !== 0,
      errorType: q.id === 'law-weak' ? 'confusion' : 'knowledge',
      attemptedAt: new Date(NOW - i * 60_000).toISOString(),
    }),
    makeAttempt({
      questionId: 'law-weak',
      correct: false,
      errorType: 'confusion',
      attemptedAt: new Date(NOW - i * 30_000).toISOString(),
    }),
  ]);

  const estimate = estimatePractice(attempts, byId, NOW);
  const weakness = analyseWeakness(attempts, byId, [], { now: NOW, todayISO: TODAY });
  return { estimate, weakness };
}

describe('buildSnapshot', () => {
  it('carries the learner’s real weakness state, not placeholders', () => {
    const { estimate, weakness } = scenario();
    const snapshot = buildSnapshot({ estimate, weakness, todayISO: TODAY });

    expect(snapshot.dday.label).toBe('D-6');
    expect(snapshot.subjects).toHaveLength(4);
    expect(snapshot.weakTopics.some((t) => t.topic === '관광진흥법 등록')).toBe(true);
    expect(snapshot.confusionPairs).toContain('등록 vs 신고');
    expect(snapshot.errorDistribution.confusion).toBeGreaterThan(0);
    expect(snapshot.recentWrong.some((r) => r.id === 'law-weak')).toBe(true);
  });

  it('says 데이터 부족 rather than a fabricated score when evidence is thin', () => {
    const snapshot = buildSnapshot({
      estimate: estimatePractice([], new Map(), NOW),
      weakness: analyseWeakness([], new Map(), [], { now: NOW, todayISO: TODAY }),
      todayISO: TODAY,
    });
    expect(snapshot.weightedTotal).toBeNull();
    expect(chatgptPrompt(snapshot)).toContain('데이터 부족');
  });
});

describe('the handoff prompts', () => {
  it('give ChatGPT the weak topics and the one-question-at-a-time rule', () => {
    const { estimate, weakness } = scenario();
    const prompt = chatgptPrompt(buildSnapshot({ estimate, weakness, todayISO: TODAY }));
    expect(prompt).toContain('관광진흥법 등록');
    expect(prompt).toContain('한 번에 한 문제씩');
    expect(prompt).toContain('2026-09-05');
    expect(prompt).toContain('D-6');
  });

  it('give Gemini a diagnostic-first structure grounded in uploaded material', () => {
    const { estimate, weakness } = scenario();
    const prompt = geminiPrompt(buildSnapshot({ estimate, weakness, todayISO: TODAY }));
    expect(prompt).toContain('진단');
    expect(prompt).toContain('업로드');
    expect(prompt).toContain('관광진흥법 등록');
  });

  it('export NotebookLM markdown with topics and ids but never question text', () => {
    const { estimate, weakness } = scenario();
    const snapshot = buildSnapshot({ estimate, weakness, todayISO: TODAY });
    const md = notebookLmMarkdown(snapshot, false);
    expect(md).toContain('# GWAN-GANG Study Snapshot');
    expect(md).toContain('`law-weak`');
    expect(md).not.toContain('문제 law-weak');
  });

  it('include personal notes only when the learner opts in', () => {
    const { estimate, weakness } = scenario();
    const notes: ConceptNote[] = [
      {
        id: 'n1',
        body: '등록은 요건 충족 시 수리, 신고는 접수로 효력',
        subject: 'law',
        createdAt: new Date(NOW).toISOString(),
        updatedAt: new Date(NOW).toISOString(),
      },
    ];
    const snapshot = buildSnapshot({ estimate, weakness, todayISO: TODAY, notes });
    expect(notebookLmMarkdown(snapshot, false)).not.toContain('등록은 요건');
    expect(notebookLmMarkdown(snapshot, true)).toContain('등록은 요건');
  });

  it('force AI-generated questions to declare themselves unverified', () => {
    const { estimate, weakness } = scenario();
    const prompt = questionGenPrompt(buildSnapshot({ estimate, weakness, todayISO: TODAY }), 15);
    expect(prompt).toContain('"ai-generated"');
    expect(prompt).toContain('"unverified"');
    expect(prompt).toContain('절대로 실제 기출문제라고 주장하지 말 것');
    expect(prompt).toContain('15문항');
    expect(prompt).toContain('correctAnswer는 0부터 시작');
  });
});
