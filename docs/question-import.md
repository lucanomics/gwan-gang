# 문제 가져오기 (Question Import)

GWAN-GANG은 문제은행을 함께 배포하지 않습니다. 학습자가 직접 가져옵니다.
이유는 두 가지입니다.

1. **정확성** — 검증하지 못한 시험 내용을 지어내지 않습니다.
2. **저작권** — 시판 교재(시대에듀 등)의 내용은 공개 저장소에 포함될 수 없습니다.
   학습자가 자신의 브라우저에 개인적으로 입력하는 것은 별개입니다.

가져온 데이터는 **브라우저의 IndexedDB에만** 저장되며 서버로 전송되지 않습니다.

---

## 가장 빠른 경로 (약 2분)

1. 앱에서 **AI 학습팩 → 문제 생성** 탭 → `AI 문제 생성용 프롬프트 복사`
2. ChatGPT 또는 Gemini에 붙여넣기 → JSON 배열 출력을 받음
3. 앱의 **데이터 → JSON을 직접 붙여넣기**에 붙여넣고 `가져오기`

이렇게 만든 문제는 자동으로 `sourceType: "ai-generated"`,
`verificationStatus: "unverified"`로 저장되며, 기본 설정에서 **실전 모의고사에는
들어가지 않습니다**.

---

## JSON 형식

최상위는 배열이거나 `{ "questions": [...] }` 객체여야 합니다.

```json
[
  {
    "id": "law-2024-001",
    "subject": "law",
    "chapter": "관광진흥법",
    "topic": "여행업 등록",
    "subtopic": "등록관청",
    "question": "관광진흥법령상 여행업 등록은 누구에게 하는가?",
    "choices": ["선택지 1", "선택지 2", "선택지 3", "선택지 4"],
    "correctAnswer": 1,
    "explanation": "2~5줄의 간결한 해설. 왜 다른 선택지가 틀렸는지 핵심만.",
    "difficulty": 3,
    "sourceType": "official-past-exam",
    "sourceLabel": "2024년 정기 1차",
    "sourceYear": 2024,
    "sourceUrl": "https://example.org/source",
    "verificationStatus": "verified",
    "tags": ["등록", "주체"],
    "relatedTopics": ["여행업 변경등록"],
    "confusionPair": ["등록 vs 신고"]
  }
]
```

### 필드

| 필드 | 필수 | 설명 |
| --- | --- | --- |
| `id` | ✅ | 고유 식별자. 같은 id를 다시 가져오면 **덮어씁니다**. |
| `subject` | ✅ | `history` · `resources` · `law` · `tourism` 중 하나 |
| `question` | ✅ | 문제 본문 (2자 이상) |
| `choices` | ✅ | **정확히 4개**. 중복 불가 |
| `correctAnswer` | ✅ | **0부터 시작하는** 인덱스 (0~3) |
| `explanation` | | 없으면 빈 문자열. 2~5줄 권장 |
| `sourceType` | ✅ | 아래 출처 표 참고 |
| `verificationStatus` | | 생략 시 `unverified` |
| `chapter` `topic` `subtopic` | | 취약 주제 분석에 사용 |
| `difficulty` | | 1~5 정수 |
| `sourceLabel` `sourceYear` `sourceUrl` | | 출처 표기용. `sourceUrl`은 올바른 URL이어야 함 |
| `tags` | | 최대 24개. 과목별 권장 태그는 아래 참고 |
| `relatedTopics` | | 연관 주제 |
| `confusionPair` | | **VS 모드**에 사용됩니다. 예: `["등록 vs 신고"]` |

### 과목 코드

| 코드 | 과목 | 문항 | 배점 | 문항당 환산점수 |
| --- | --- | --- | --- | --- |
| `history` | 관광국사 | 25 | 40% | 1.6점 |
| `resources` | 관광자원해설 | 25 | 20% | 0.8점 |
| `law` | 관광법규 | 25 | 20% | 0.8점 |
| `tourism` | 관광학개론 | 25 | 20% | 0.8점 |

### 출처(`sourceType`)와 배지

| 값 | 배지 | 의미 |
| --- | --- | --- |
| `official-past-exam` | 기출 | 실제 기출문제 |
| `public-official` | 공식자료 | Q-Net·법령 등 공개 공식 자료 기반 |
| `user-authored` | 사용자 입력 | 학습자가 직접 작성 |
| `ai-generated` | AI 변형 | LLM이 생성 — **항상 미검증** |
| `licensed` | 교재 기반 | 학습자가 보유한 교재에서 정리 (개인 사용) |
| `sample` | 샘플 | 개발용 가상 데이터 — **항상 미검증, 점수 미반영** |

**보장 사항:** `ai-generated`와 `sample`은 파일에 `"verificationStatus": "verified"`가
적혀 있어도 가져오는 시점에 `unverified`로 강제됩니다. AI가 만든 문제가 기출로
둔갑하는 일은 발생하지 않습니다.

---

## CSV 형식

스프레드시트로 정리하는 편이 빠르다면 CSV도 됩니다.

```csv
id,subject,topic,question,choice1,choice2,choice3,choice4,answer,explanation,sourceType,sourceLabel,sourceYear,tags
my-law-001,law,관광진흥법,"여행업 등록은 누구에게 하는가?",문화체육관광부장관,시장·군수·구청장,한국관광공사,관할 경찰서장,2,"등록 관청은 기초지자체장이다.",user-authored,직접 정리,,등록;주체
```

필수 열: `id`, `subject`, `question`, `choice1`~`choice4`, `answer`, `sourceType`
선택 열: `explanation`, `chapter`, `topic`, `subtopic`, `sourceLabel`, `sourceYear`,
`sourceUrl`, `difficulty`, `verificationStatus`, `tags`, `relatedTopics`, `confusionPair`

> ⚠️ **CSV의 `answer` 열은 1~4입니다** (사람이 쓰기 편하도록). JSON의
> `correctAnswer`는 0~3입니다. 가져올 때 자동 변환됩니다.

- 목록형 열(`tags`, `relatedTopics`, `confusionPair`)은 `;` 또는 `|`로 구분합니다.
- 쉼표·따옴표·줄바꿈이 들어간 값은 `"..."`로 감싸고, 내부 따옴표는 `""`로 씁니다.
- UTF-8 BOM은 자동으로 제거됩니다.

---

## 검증 규칙

가져오기는 **행 단위**로 검증합니다. 한 행이 잘못되어도 나머지는 정상적으로
들어오고, 문제가 있는 행만 오류 목록에 표시됩니다.

거부되는 경우:

- JSON 파싱 실패 / 최상위 형식 오류
- 알 수 없는 `subject` 또는 `sourceType`
- `choices`가 4개가 아니거나 중복된 선택지가 있음
- `correctAnswer`가 정수가 아니거나 0~3 범위를 벗어남
- `id`가 비어 있거나 **같은 파일 안에서** 중복됨
- `sourceUrl`이 URL 형식이 아님
- `sourceType` 누락 (출처는 필수입니다)

기존 문제은행에 이미 있는 `id`는 오류가 아니라 **덮어쓰기**로 처리되며, 몇 건이
덮어써졌는지 결과에 표시됩니다.

---

## 공식 기출문제는 어디서?

GWAN-GANG은 기출문제를 자동으로 수집하지 않습니다. 자동 수집은 안정적이지도
합법적이지도 않은 경우가 많고, 잘못된 데이터를 넣느니 안 넣는 편이 낫습니다.

권장 순서:

1. **Q-Net (한국산업인력공단)** 및 시행처의 공개 자료 — 공개된 기출을 직접 입력하거나
   변환해서 `sourceType: "official-past-exam"`으로 가져오기
2. **국가법령정보센터** — 관광법규의 조문·숫자·기간 확인
3. 보유 교재는 **개념을 자기 표현으로 정리**해 `licensed` 또는 `user-authored`로 입력
   (원문을 그대로 옮기지 마세요)
4. 나머지 훈련량은 **AI 문제 생성 → 가져오기**로 채우기 (미검증으로 명확히 표시됨)

블로그·요약 사이트의 내용을 기출로 표기하지 마세요. 출처가 불확실하면
`verificationStatus`를 `unverified`로 두면 됩니다.

---

## 실전 모의고사에 쓰려면

Mock 100은 기본적으로 **검증된(`verified`) 문제만** 사용하며, 과목당 25문제가
필요합니다. 부족하면 빈 자리를 임의로 채우지 않고 **몇 문제가 부족한지 그대로
표시**합니다.

검증 문제가 부족할 때는 모의고사 화면에서 `미검증 문제도 포함`을 켤 수 있고,
그 경우 결과에 `미검증 문제 포함 · 참고용` 배지가 붙습니다.
