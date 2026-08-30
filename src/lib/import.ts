import { z } from 'zod';
import { CHOICE_COUNT, questionFileSchema, questionSchema } from './schema';
import type { Question } from './types';

export interface ImportRowError {
  /** 1-based row/element position in the source file. */
  row: number;
  id?: string;
  messages: string[];
}

export interface ImportReport {
  questions: Question[];
  errors: ImportRowError[];
  /** Ids that appeared more than once inside the imported file. */
  duplicatesInFile: string[];
  /** Ids that already exist in the local bank (caller decides overwrite policy). */
  duplicatesInBank: string[];
  total: number;
}

const EMPTY_REPORT: ImportReport = {
  questions: [],
  errors: [],
  duplicatesInFile: [],
  duplicatesInBank: [],
  total: 0,
};

function issueMessages(error: z.ZodError): string[] {
  return error.issues.map((issue) => {
    const path = issue.path.join('.');
    return path ? `${path}: ${issue.message}` : issue.message;
  });
}

/**
 * Validate an already-parsed list of raw rows.
 * Never throws — every problem comes back as a row error.
 */
export function validateRows(
  rows: unknown[],
  existingIds: ReadonlySet<string> = new Set(),
): ImportReport {
  const questions: Question[] = [];
  const errors: ImportRowError[] = [];
  const seen = new Set<string>();
  const duplicatesInFile = new Set<string>();
  const duplicatesInBank = new Set<string>();

  rows.forEach((raw, index) => {
    const row = index + 1;
    const rawId =
      raw && typeof raw === 'object' && 'id' in raw
        ? String((raw as { id: unknown }).id ?? '')
        : undefined;

    const parsed = questionSchema.safeParse(raw);
    if (!parsed.success) {
      errors.push({ row, id: rawId, messages: issueMessages(parsed.error) });
      return;
    }

    const question = parsed.data;
    if (seen.has(question.id)) {
      duplicatesInFile.add(question.id);
      errors.push({
        row,
        id: question.id,
        messages: ['파일 안에서 중복된 id입니다'],
      });
      return;
    }
    seen.add(question.id);
    if (existingIds.has(question.id)) duplicatesInBank.add(question.id);
    questions.push(question);
  });

  return {
    questions,
    errors,
    duplicatesInFile: [...duplicatesInFile],
    duplicatesInBank: [...duplicatesInBank],
    total: rows.length,
  };
}

export function importFromJson(
  text: string,
  existingIds: ReadonlySet<string> = new Set(),
): ImportReport {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch (error) {
    return {
      ...EMPTY_REPORT,
      errors: [
        {
          row: 0,
          messages: [
            `JSON 파싱 실패: ${error instanceof Error ? error.message : '알 수 없는 오류'}`,
          ],
        },
      ],
    };
  }

  const file = questionFileSchema.safeParse(data);
  if (!file.success) {
    return {
      ...EMPTY_REPORT,
      errors: [
        {
          row: 0,
          messages: ['최상위 형식은 배열이거나 { "questions": [...] } 이어야 합니다'],
        },
      ],
    };
  }

  return validateRows(file.data, existingIds);
}

/** Minimal RFC4180-ish CSV reader: handles quotes, escaped quotes and embedded newlines. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  const src = text.replace(/^\uFEFF/, '');

  for (let i = 0; i < src.length; i += 1) {
    const char = src[i];
    if (quoted) {
      if (char === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          quoted = false;
        }
      } else {
        field += char;
      }
      continue;
    }
    if (char === '"') {
      quoted = true;
    } else if (char === ',') {
      row.push(field);
      field = '';
    } else if (char === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else if (char !== '\r') {
      field += char;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((cell) => cell.trim() !== ''));
}

const CSV_LIST_SEPARATOR = /[;|]/;

function splitList(value: string): string[] | undefined {
  const parts = value
    .split(CSV_LIST_SEPARATOR)
    .map((v) => v.trim())
    .filter(Boolean);
  return parts.length ? parts : undefined;
}

/**
 * CSV import.
 *
 * The `answer` column is 1-based (1-4) because humans author spreadsheets by
 * hand; it is converted to the 0-based `correctAnswer` used everywhere else.
 */
export function importFromCsv(
  text: string,
  existingIds: ReadonlySet<string> = new Set(),
): ImportReport {
  const table = parseCsv(text);
  if (table.length < 2) {
    return {
      ...EMPTY_REPORT,
      errors: [{ row: 0, messages: ['헤더 행과 최소 1개의 데이터 행이 필요합니다'] }],
    };
  }

  const header = table[0].map((h) => h.trim().toLowerCase());
  const required = ['id', 'subject', 'question', 'choice1', 'choice2', 'choice3', 'choice4', 'answer', 'sourcetype'];
  const missing = required.filter((col) => !header.includes(col));
  if (missing.length) {
    return {
      ...EMPTY_REPORT,
      errors: [{ row: 0, messages: [`필수 열이 없습니다: ${missing.join(', ')}`] }],
    };
  }

  const at = (cells: string[], key: string): string => {
    const index = header.indexOf(key);
    return index === -1 ? '' : (cells[index] ?? '').trim();
  };

  const rows = table.slice(1).map((cells) => {
    const answerRaw = at(cells, 'answer');
    const answer = Number.parseInt(answerRaw, 10);
    const year = Number.parseInt(at(cells, 'sourceyear'), 10);
    const difficulty = Number.parseInt(at(cells, 'difficulty'), 10);

    return {
      id: at(cells, 'id'),
      subject: at(cells, 'subject'),
      question: at(cells, 'question'),
      choices: [
        at(cells, 'choice1'),
        at(cells, 'choice2'),
        at(cells, 'choice3'),
        at(cells, 'choice4'),
      ],
      // NaN survives as NaN so zod reports "정수여야 합니다" instead of silently picking 0.
      correctAnswer: Number.isNaN(answer) ? answerRaw : answer - 1,
      explanation: at(cells, 'explanation'),
      topic: at(cells, 'topic') || undefined,
      chapter: at(cells, 'chapter') || undefined,
      subtopic: at(cells, 'subtopic') || undefined,
      sourceType: at(cells, 'sourcetype'),
      sourceLabel: at(cells, 'sourcelabel') || undefined,
      sourceUrl: at(cells, 'sourceurl') || undefined,
      sourceYear: Number.isNaN(year) ? undefined : year,
      difficulty: Number.isNaN(difficulty) ? undefined : difficulty,
      verificationStatus: at(cells, 'verificationstatus') || undefined,
      tags: splitList(at(cells, 'tags')),
      relatedTopics: splitList(at(cells, 'relatedtopics')),
      confusionPair: splitList(at(cells, 'confusionpair')),
    };
  });

  const report = validateRows(rows, existingIds);
  // Header occupies line 1, so shift row numbers to match the file the user sees.
  return { ...report, errors: report.errors.map((e) => ({ ...e, row: e.row + 1 })) };
}

export function importQuestions(
  text: string,
  filename: string,
  existingIds: ReadonlySet<string> = new Set(),
): ImportReport {
  const looksCsv =
    filename.toLowerCase().endsWith('.csv') ||
    (!text.trimStart().startsWith('[') && !text.trimStart().startsWith('{'));
  return looksCsv
    ? importFromCsv(text, existingIds)
    : importFromJson(text, existingIds);
}

export const CSV_TEMPLATE = [
  'id,subject,topic,question,choice1,choice2,choice3,choice4,answer,explanation,sourceType,sourceLabel,sourceYear,tags',
  'my-law-001,law,관광진흥법,"여행업 등록은 누구에게 하는가?",문화체육관광부장관,특별자치시장·특별자치도지사·시장·군수·구청장,한국관광공사,관할 경찰서장,2,"여행업 등록 관청은 시장·군수·구청장 등 기초지자체장이다.",user-authored,직접 정리,,등록;주체',
].join('\n');

export { CHOICE_COUNT };
