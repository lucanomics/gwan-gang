import { z } from 'zod';
import { SUBJECTS } from './exam';
import type { Question, SourceType } from './types';

export const CHOICE_COUNT = 4;

export const subjectSchema = z.enum(SUBJECTS);

export const sourceTypeSchema = z.enum([
  'official-past-exam',
  'public-official',
  'user-authored',
  'ai-generated',
  'licensed',
  'sample',
]);

export const verificationSchema = z.enum(['verified', 'unverified']);

/**
 * Provenance that may never be trusted as exam-grade content, no matter what
 * the imported file claims. This is the guarantee behind "AI-generated
 * questions never masquerade as official past questions".
 */
const ALWAYS_UNVERIFIED: SourceType[] = ['ai-generated', 'sample'];

const trimmed = z.string().trim();

export const questionSchema = z
  .object({
    id: trimmed.min(1, 'id는 비어 있을 수 없습니다').max(120),
    subject: subjectSchema,

    chapter: trimmed.max(120).optional(),
    topic: trimmed.max(120).optional(),
    subtopic: trimmed.max(120).optional(),

    question: trimmed.min(2, '문제 본문이 너무 짧습니다').max(2000),
    choices: z
      .array(trimmed.min(1, '선택지는 비어 있을 수 없습니다').max(600))
      .length(CHOICE_COUNT, `선택지는 정확히 ${CHOICE_COUNT}개여야 합니다`),
    correctAnswer: z
      .number()
      .int('correctAnswer는 정수여야 합니다')
      .min(0, 'correctAnswer는 0 이상이어야 합니다')
      .max(CHOICE_COUNT - 1, `correctAnswer는 0~${CHOICE_COUNT - 1} 범위여야 합니다`),
    explanation: trimmed.max(4000).default(''),

    difficulty: z.union([
      z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5),
    ]).optional(),

    sourceType: sourceTypeSchema,
    sourceLabel: trimmed.max(160).optional(),
    sourceYear: z.number().int().min(1900).max(2100).optional(),
    sourceUrl: trimmed.url('sourceUrl 형식이 올바르지 않습니다').max(500).optional(),

    verificationStatus: verificationSchema.default('unverified'),

    tags: z.array(trimmed.min(1).max(60)).max(24).optional(),
    relatedTopics: z.array(trimmed.min(1).max(120)).max(24).optional(),
    confusionPair: z.array(trimmed.min(1).max(160)).max(8).optional(),

    createdAt: trimmed.optional(),
  })
  .superRefine((value, ctx) => {
    const unique = new Set(value.choices.map((c) => c.replace(/\s+/g, ' ')));
    if (unique.size !== value.choices.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['choices'],
        message: '중복된 선택지가 있습니다',
      });
    }
  })
  .transform((value): Question => ({
    ...value,
    verificationStatus: ALWAYS_UNVERIFIED.includes(value.sourceType)
      ? 'unverified'
      : value.verificationStatus,
    createdAt: value.createdAt ?? new Date().toISOString(),
  }));

export type QuestionInput = z.input<typeof questionSchema>;

/** A file may be a bare array, or an object with a `questions` array. */
export const questionFileSchema = z.union([
  z.array(z.unknown()),
  z.object({ questions: z.array(z.unknown()) }).transform((v) => v.questions),
]);

export function isTrustedProvenance(sourceType: SourceType): boolean {
  return sourceType === 'official-past-exam' || sourceType === 'public-official';
}
