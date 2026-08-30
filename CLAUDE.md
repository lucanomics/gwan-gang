# CLAUDE.md — GWAN-GANG

Guidance for any future Claude Code session working in this repository.
Read this before changing anything.

---

## 1. Mission

GWAN-GANG exists for **one** reason:

> On **2026-09-05**, the learner should answer more 관광통역안내사 1차 필기시험
> questions correctly because this app existed.

It is a **six-day exam survival system**, not a SaaS product. The learner's
scarce resource is time before the exam, and their attention is limited.
Every abstraction, screen and test must serve that objective or be removed.

The product principle: **the learner should almost never have to decide what to
study next.** Open the app → one button → answer questions → weakness model
updates → the next questions are better targeted → stop → come back later
without losing state.

---

## 2. Hard facts (never change these without a source)

- **Exam date:** 2026-09-05. **Timezone: Asia/Seoul**, always.
- **Final review mode** activates from **2026-09-04** through exam day.
- Four subjects, 25 questions each, 100 questions, 100 minutes:

| Subject | code | weight | points per correct |
| --- | --- | --- | --- |
| 관광국사 | `history` | 40% | **1.6** |
| 관광자원해설 | `resources` | 20% | 0.8 |
| 관광법규 | `law` | 20% | 0.8 |
| 관광학개론 | `tourism` | 20% | 0.8 |

- **Pass = weighted total ≥ 60 AND every subject ≥ 40% (10 of 25).**
  A 60+ total with one subject at 9 is a **fail** (과락).
- Target band for this learner is **65–70**, not mastery.

These constants live in `src/lib/exam.ts`. The pass/fail decision lives in
`src/lib/scoring.ts` and nowhere else.

---

## 3. Non-negotiable rules

### Scoring
- **`src/lib/scoring.ts` is the only place that decides a score or a pass.**
  No component may implement its own formula. No screen may substitute simple
  overall accuracy for the official weighted score.
- Weighted totals are computed in integer tenths so the 60.0 boundary is exact.
- Boundary behaviour is locked by tests. If you change scoring, the tests
  should fail — that is the point. Do not "fix" the tests to match new code
  unless you can cite the official rule.

### Honesty about numbers
- **Never invent a pass probability.** No `합격확률 83.7%`. Ever.
- Use `현재 훈련 기준 점수` / `최근 훈련 추정치` / `과락 위험` wording.
- When evidence is thin (< 8 attempts in any subject), show **`데이터 부족`**,
  not a number.
- **Development sample questions never affect the score estimate.** This is
  enforced in `estimate.ts`, not in the UI.
- A high total must never visually hide a 과락 risk.

### Content provenance
- Every question carries a required `sourceType` and a `verificationStatus`,
  and the badge is visible everywhere the question appears.
- **`ai-generated` and `sample` are forced to `unverified` at import time**,
  even if the file claims otherwise (`src/lib/schema.ts`). AI content must never
  masquerade as an official past question.
- **Mock 100 uses verified questions only** unless the learner explicitly opts
  in, and an opted-in result is labelled `참고용`.
- If verified content is short, say exactly how short. **Never pad a mock exam
  with substitutes, and never fabricate past questions.**

### Copyright
- The learner owns commercial 시대에듀 books. That does not authorise
  republication.
- Do **not** commit textbook scans, OCR dumps, whole chapters, or reproduced
  practice banks. Do not ship a question bank in this repository at all.
- The learner may privately enter distilled concepts and notes locally; that
  data stays in their browser and is never uploaded.
- The NotebookLM export deliberately contains **topics and ids only**, never
  question text.

### Architecture
- **Local-first. No backend, no accounts, no auth, no sync service.**
- Everything persists in **IndexedDB** (`src/lib/db.ts`). Refreshing, closing
  the tab or switching apps must never destroy study state.
- **No LLM call is ever on the path to answering a question.** Runtime AI is
  not P0 and currently does not exist; the app is fully useful with no API key.
- Do not add: Supabase, Firebase, Prisma, Postgres, Redis, GraphQL, queues,
  Docker orchestration, billing, social features, rankings, or a CMS.
  One user, one exam, six days.

### UX
- Mobile-first. Two meaningful taps from launch to the first question.
- One obvious primary action per screen. Large tap targets (≥48px).
- No onboarding wizard, no tutorial carousel, no forced streaks, no shaming,
  no confetti, no mascots.
- Correct/incorrect must never be signalled by colour alone.
- Respect `prefers-reduced-motion`.

---

## 4. Layout

```
src/lib/     domain + logic (all unit-tested; no React)
src/routes/  screens
src/components/ shared UI
src/hooks/   derived state selectors
src/data/    fictional development samples only
docs/        question import format
```

`src/lib` must not import from `src/routes` or `src/components`.

Stack: **Vite + React + TypeScript + Tailwind + zustand + zod + idb**.
It is a static SPA, deliberately not Next.js: there is no server rendering
requirement, and D-day plus IndexedDB state make hydration mismatches a real
risk for zero benefit. Vercel deployment works the same either way.

---

## 5. Testing expectations

`npm test` must stay green. Critical areas that require tests when touched:

- **scoring** — weighted formula, exact 60 boundary, subject cutoff override,
  max, zero
- **date** — D-6 / D-1 / D-DAY / after exam, final review activation, and the
  Asia/Seoul boundary (a UTC ISO slice is **wrong**: between 00:00 and 09:00 KST
  it points at the previous day — use `seoulDateOf`)
- **adaptive** — wrong answers ranked higher, history weighted ×2, confusion
  above knowledge above mistake, no immediate repeats, balanced sessions
- **review** — ladder intervals, miss resets, hit advances, retirement
- **import** — valid, malformed JSON, duplicate ids, bad answer index, wrong
  choice count, missing provenance, AI content forced unverified
- **mock** — exactly 25 per subject, 100 total, grading, cutoff failure
- **persistence** — attempts survive a reload, backup export/import round-trip

Before claiming done: `npm run lint && npm test && npm run build` must all pass.

---

## 6. FEATURE FREEZE

The Definition of Done in the original brief is met. **Stop adding features.**

If you have spare capacity, spend it on:
1. educational correctness
2. adaptive selection quality
3. persistence reliability
4. mobile UX
5. tests
6. empty and error states
7. data portability
8. accessibility
9. build reliability

Do **not** build: accounts, social, rankings, achievements, payments,
community, an admin panel, multiplayer, a full chatbot, RAG infrastructure,
interactive maps, a marketplace, elaborate theming, or vanity animation.

Before shipping any change, ask: *does this help the learner answer more
questions correctly on September 5?* If not, don't.
