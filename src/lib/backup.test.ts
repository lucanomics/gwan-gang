import { describe, expect, it } from 'vitest';
import { BACKUP_FORMAT, buildBackup, parseBackup } from './backup';
import { DEFAULT_PREFERENCES } from './types';
import { makeAttempt, makeBank } from './testing';

const payload = {
  questions: makeBank(1),
  attempts: [makeAttempt({ questionId: 'law-0' })],
  reviews: [],
  sessions: [],
  mocks: [],
  notes: [],
  preferences: { ...DEFAULT_PREFERENCES },
};

describe('parseBackup', () => {
  it('round-trips a file written by buildBackup', () => {
    const parsed = parseBackup(JSON.stringify(buildBackup(payload)));
    expect(parsed.errors).toEqual([]);
    expect(parsed.data!.questions).toHaveLength(4);
    expect(parsed.data!.attempts).toHaveLength(1);
  });

  it('stamps the format and an export timestamp', () => {
    const file = buildBackup(payload);
    expect(file.format).toBe(BACKUP_FORMAT);
    expect(Number.isNaN(Date.parse(file.exportedAt))).toBe(false);
  });

  it('rejects malformed JSON', () => {
    const parsed = parseBackup('nope');
    expect(parsed.data).toBeNull();
    expect(parsed.errors[0]).toContain('JSON 파싱 실패');
  });

  it('rejects a file that is not a GWAN-GANG backup', () => {
    const parsed = parseBackup(JSON.stringify({ hello: 'world' }));
    expect(parsed.data).toBeNull();
    expect(parsed.errors[0]).toContain('백업 파일이 아닙니다');
  });

  it('rejects a top-level array', () => {
    expect(parseBackup('[]').data).toBeNull();
  });

  it('drops individually broken rows and reports how many', () => {
    const file = buildBackup(payload) as unknown as Record<string, unknown>;
    file.attempts = [payload.attempts[0], { id: 'bad' }, { nonsense: true }];
    const parsed = parseBackup(JSON.stringify(file));
    expect(parsed.data!.attempts).toHaveLength(1);
    expect(parsed.skipped.attempts).toBe(2);
  });

  it('falls back to default preferences when the block is unusable', () => {
    const file = buildBackup(payload) as unknown as Record<string, unknown>;
    file.preferences = 'not an object';
    const parsed = parseBackup(JSON.stringify(file));
    expect(parsed.data!.preferences).toEqual(DEFAULT_PREFERENCES);
  });

  it('tolerates missing collections', () => {
    const parsed = parseBackup(JSON.stringify({ format: BACKUP_FORMAT, version: 1 }));
    expect(parsed.data).not.toBeNull();
    expect(parsed.data!.questions).toEqual([]);
    expect(parsed.data!.notes).toEqual([]);
  });

  it('re-applies the provenance guarantee to restored questions', () => {
    const file = buildBackup(payload) as unknown as Record<string, unknown>;
    file.questions = [
      { ...payload.questions[0], sourceType: 'ai-generated', verificationStatus: 'verified' },
    ];
    const parsed = parseBackup(JSON.stringify(file));
    expect(parsed.data!.questions[0].verificationStatus).toBe('unverified');
  });
});
