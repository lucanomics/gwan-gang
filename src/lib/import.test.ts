import { describe, expect, it } from 'vitest';
import { CSV_TEMPLATE, importFromCsv, importFromJson, importQuestions, parseCsv, validateRows } from './import';

const valid = {
  id: 'law-001',
  subject: 'law',
  question: '여행업 등록 관청은?',
  choices: ['가', '나', '다', '라'],
  correctAnswer: 1,
  explanation: '해설입니다.',
  sourceType: 'official-past-exam',
  verificationStatus: 'verified',
};

describe('importFromJson', () => {
  it('accepts a bare array and an object with a questions key', () => {
    expect(importFromJson(JSON.stringify([valid])).questions).toHaveLength(1);
    expect(importFromJson(JSON.stringify({ questions: [valid] })).questions).toHaveLength(1);
  });

  it('reports malformed JSON instead of throwing', () => {
    const report = importFromJson('{ not json');
    expect(report.questions).toHaveLength(0);
    expect(report.errors[0].messages[0]).toContain('JSON 파싱 실패');
  });

  it('rejects a top level shape that is neither array nor { questions }', () => {
    const report = importFromJson('42');
    expect(report.questions).toHaveLength(0);
    expect(report.errors).toHaveLength(1);
  });

  it('rejects an out-of-range answer index', () => {
    const report = importFromJson(JSON.stringify([{ ...valid, correctAnswer: 4 }]));
    expect(report.questions).toHaveLength(0);
    expect(report.errors[0].messages.join()).toContain('correctAnswer');
  });

  it('rejects a non-integer answer index', () => {
    const report = importFromJson(JSON.stringify([{ ...valid, correctAnswer: '2' }]));
    expect(report.questions).toHaveLength(0);
  });

  it('rejects the wrong number of choices', () => {
    expect(importFromJson(JSON.stringify([{ ...valid, choices: ['가', '나', '다'] }])).errors).toHaveLength(1);
    expect(importFromJson(JSON.stringify([{ ...valid, choices: ['가', '나', '다', '라', '마'] }])).errors).toHaveLength(1);
  });

  it('rejects duplicate choices', () => {
    const report = importFromJson(JSON.stringify([{ ...valid, choices: ['가', '가', '다', '라'] }]));
    expect(report.errors[0].messages.join()).toContain('중복된 선택지');
  });

  it('requires provenance', () => {
    const { sourceType: _omitted, ...withoutSource } = valid;
    const report = importFromJson(JSON.stringify([withoutSource]));
    expect(report.questions).toHaveLength(0);
    expect(report.errors[0].messages.join()).toContain('sourceType');
  });

  it('defaults unknown verification status to unverified', () => {
    const { verificationStatus: _omitted, ...withoutStatus } = valid;
    const report = importFromJson(JSON.stringify([withoutStatus]));
    expect(report.questions[0].verificationStatus).toBe('unverified');
  });

  it('never lets AI-generated content claim to be verified', () => {
    const report = importFromJson(
      JSON.stringify([{ ...valid, sourceType: 'ai-generated', verificationStatus: 'verified' }]),
    );
    expect(report.questions[0].verificationStatus).toBe('unverified');
  });

  it('never lets sample content claim to be verified', () => {
    const report = importFromJson(
      JSON.stringify([{ ...valid, sourceType: 'sample', verificationStatus: 'verified' }]),
    );
    expect(report.questions[0].verificationStatus).toBe('unverified');
  });

  it('flags duplicate ids inside one file and keeps the first', () => {
    const report = importFromJson(JSON.stringify([valid, { ...valid, question: '다른 문제입니다' }]));
    expect(report.questions).toHaveLength(1);
    expect(report.duplicatesInFile).toEqual(['law-001']);
    expect(report.errors[0].row).toBe(2);
  });

  it('reports ids that already exist in the bank without discarding them', () => {
    const report = importFromJson(JSON.stringify([valid]), new Set(['law-001']));
    expect(report.questions).toHaveLength(1);
    expect(report.duplicatesInBank).toEqual(['law-001']);
  });

  it('keeps valid rows when a neighbouring row is broken', () => {
    const report = importFromJson(
      JSON.stringify([valid, { ...valid, id: 'law-002', subject: 'nope' }, { ...valid, id: 'law-003' }]),
    );
    expect(report.questions.map((q) => q.id)).toEqual(['law-001', 'law-003']);
    expect(report.errors).toHaveLength(1);
    expect(report.errors[0].row).toBe(2);
  });

  it('rejects an invalid sourceUrl', () => {
    const report = importFromJson(JSON.stringify([{ ...valid, sourceUrl: 'not-a-url' }]));
    expect(report.errors[0].messages.join()).toContain('sourceUrl');
  });

  it('stamps createdAt when missing', () => {
    const report = importFromJson(JSON.stringify([valid]));
    expect(report.questions[0].createdAt).toBeTruthy();
  });
});

describe('parseCsv', () => {
  it('handles quotes, escaped quotes and embedded newlines', () => {
    const rows = parseCsv('a,b\n"1,1","he said ""hi""\nsecond line"');
    expect(rows).toEqual([
      ['a', 'b'],
      ['1,1', 'he said "hi"\nsecond line'],
    ]);
  });

  it('strips a UTF-8 BOM and drops blank rows', () => {
    const rows = parseCsv('﻿a,b\n\n1,2\n');
    expect(rows).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ]);
  });
});

describe('importFromCsv', () => {
  it('imports the shipped template and converts the 1-based answer column', () => {
    const report = importFromCsv(CSV_TEMPLATE);
    expect(report.errors).toEqual([]);
    expect(report.questions).toHaveLength(1);
    // answer=2 in the file means the second choice, index 1.
    expect(report.questions[0].correctAnswer).toBe(1);
    expect(report.questions[0].tags).toEqual(['등록', '주체']);
  });

  it('reports missing required columns', () => {
    const report = importFromCsv('id,subject\nx,law');
    expect(report.errors[0].messages[0]).toContain('필수 열이 없습니다');
  });

  it('needs at least one data row', () => {
    const report = importFromCsv('id,subject,question,choice1,choice2,choice3,choice4,answer,sourceType');
    expect(report.questions).toHaveLength(0);
    expect(report.errors).toHaveLength(1);
  });

  it('reports a non-numeric answer instead of silently choosing choice 1', () => {
    const csv = [
      'id,subject,question,choice1,choice2,choice3,choice4,answer,sourceType',
      'x1,law,문제,가,나,다,라,없음,user-authored',
    ].join('\n');
    const report = importFromCsv(csv);
    expect(report.questions).toHaveLength(0);
    expect(report.errors[0].messages.join()).toContain('correctAnswer');
  });

  it('numbers error rows the way the file does, counting the header', () => {
    const csv = [
      'id,subject,question,choice1,choice2,choice3,choice4,answer,sourceType',
      'x1,law,문제,가,나,다,라,1,user-authored',
      'x2,nope,문제,가,나,다,라,1,user-authored',
    ].join('\n');
    const report = importFromCsv(csv);
    expect(report.questions).toHaveLength(1);
    expect(report.errors[0].row).toBe(3);
  });
});

describe('importQuestions', () => {
  it('routes by extension and by content sniffing', () => {
    expect(importQuestions(JSON.stringify([valid]), 'bank.json').questions).toHaveLength(1);
    expect(importQuestions(CSV_TEMPLATE, 'bank.csv').questions).toHaveLength(1);
    expect(importQuestions(CSV_TEMPLATE, 'unknown.txt').questions).toHaveLength(1);
  });
});

describe('validateRows', () => {
  it('tolerates non-object rows', () => {
    const report = validateRows([null, 'text', 7, valid]);
    expect(report.questions).toHaveLength(1);
    expect(report.errors).toHaveLength(3);
  });
});
