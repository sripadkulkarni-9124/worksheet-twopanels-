# VED Worksheet Evaluator — Technical Documentation

---

## 1. Product Overview

VED is a web application that lets a student photograph or upload a completed handwritten worksheet. The image is sent to Google Gemini AI, which reads every question and handwritten answer, evaluates correctness, generates educational feedback, and annotates the worksheet image with colored bounding boxes and correction marks. The student can then explore per-question feedback, chat with an AI tutor (VED), reattempt wrong questions, and toggle feedback callouts directly drawn on the worksheet.

---

## 2. Tech Stack

| Layer | Technology | Version | Notes |
|---|---|---|---|
| **Framework** | Next.js | 16.2.3 | App Router, `'use client'` pattern |
| **UI Library** | React | 19.2.4 | — |
| **Styling** | Tailwind CSS | 4.x | Utility-first, no component library |
| **AI Model** | Google Gemini 2.5 Flash | — | Via `@google/generative-ai` SDK v0.24.1 |
| **Canvas** | HTML5 Canvas API | — | Annotation overlay drawn in JS |
| **Persistence** | Browser `localStorage` | — | No backend database |
| **Language** | TypeScript | 5.x | Strict mode |
| **Build tool** | Webpack | — | Turbopack disabled (`next build --webpack`) |
| **Runtime** | Node.js | v22.22.2 | `next start` production server |
| **Hosting** | localhost:3000 | — | — |

> **Why `--webpack`?** Turbopack (Next.js default bundler) panics with "Failed to write app endpoint" on this project. The `--webpack` flag forces the stable Webpack bundler.

---

## 3. Repository Structure

```
worksheet-app/
├── src/
│   ├── app/
│   │   ├── page.tsx                    # Home screen
│   │   ├── evaluate/
│   │   │   └── [id]/
│   │   │       └── page.tsx            # Evaluation screen (main UI, ~1000 lines)
│   │   ├── subject/
│   │   │   └── [name]/
│   │   │       └── page.tsx            # Subject detail page
│   │   └── api/
│   │       ├── evaluate/route.ts       # POST — scan worksheet image
│   │       ├── annotate/route.ts       # POST — generate canvas marks
│   │       ├── chat/route.ts           # POST — AI tutor chat
│   │       └── reattempt/route.ts      # POST — evaluate second attempt
│   ├── lib/
│   │   ├── gemini.ts                   # Gemini client + shared prompts
│   │   └── store.ts                    # All localStorage read/write helpers
│   ├── types/
│   │   └── index.ts                    # All shared TypeScript interfaces
│   └── components/
│       └── CaptureModal.tsx            # Camera + file-upload modal
├── .env.local                          # GEMINI_API_KEY (not committed)
├── .claude/launch.json                 # Preview server config
├── TECHDOC.md                          # This file
├── package.json
├── tsconfig.json
└── tailwind.config.*
```

---

## 4. Data Model

### 4.1 `EvaluationSession`
Root object stored per scan. Lives in `localStorage['ved-sessions'][id]`.

```ts
interface EvaluationSession {
  id: string;            // crypto.randomUUID()
  imageDataUrl: string;  // "data:image/jpeg;base64,..." — full worksheet photo
  result: EvaluationResult;
  timestamp: string;     // ISO 8601 e.g. "2026-04-14T09:31:00.000Z"
  autoMarks?: AutoMark[];// LLM-generated canvas annotations
}
```

### 4.2 `EvaluationResult`
The AI's structured output for the whole worksheet.

```ts
interface EvaluationResult {
  worksheetTitle: string;  // e.g. "Understanding Ratios"
  subject: string;         // "Mathematics" | "Physics" | "Chemistry" | ...
  chapter: string;         // e.g. "Proportional Reasoning"
  topic: string;           // e.g. "Ratios and Proportions"
  questions: EvaluatedQuestion[];
}
```

### 4.3 `EvaluatedQuestion`
Per-question AI evaluation result.

```ts
interface EvaluatedQuestion {
  number: number;                       // 1, 2, 3 ...
  questionText: string;                 // Printed question as it appears
  studentAnswer: string | null;         // Handwritten answer, null if blank
  correctAnswer: string;                // Full simplified correct answer
  status: 'correct'
        | 'incorrect'
        | 'partially_correct'
        | 'unanswered';
  feedback: string;    // 1–2 sentence specific encouraging feedback
  vedInsight: string;  // One memorable learning tip
  steps: SolutionStep[];
}

interface SolutionStep {
  title: string;    // e.g. "Step 1: Count each group"
  points: string[]; // ["Chocolate cones = 6", "Strawberry cones = 4"]
}
```

### 4.4 `AutoMark`
A single annotation mark on the canvas. All coordinates are **image fractions** (0.0–1.0).

```ts
interface AutoMark {
  type: 'tick' | 'cross' | 'circle' | 'underline' | 'arrow' | 'bbox';
  x: number;      // Left / start X (fraction of image width)
  y: number;      // Top / start Y (fraction of image height)
  x2?: number;    // Right / end X (for bbox, circle, underline, arrow)
  y2?: number;    // Bottom / end Y
  color?: string; // Hex color string, used by bbox
}
```

Using fractions rather than pixels makes marks resolution-independent — they render correctly regardless of display size, zoom, or image dimensions.

### 4.5 `TeacherMark`
Same coordinate model as `AutoMark` but includes a persistent `id`. Used for manual annotations drawn by the user.

```ts
interface TeacherMark {
  id: string;      // Date.now().toString()
  type: MarkType;
  x: number; y: number; x2?: number; y2?: number;
  color?: string;
}
```

### 4.6 `ChatMessage`
One message in the VED chat history.

```ts
interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}
```

---

## 5. localStorage Layout

All state is client-side only — no server database.

| Key | Type | Description |
|---|---|---|
| `ved-sessions` | `Record<uuid, EvaluationSession>` | All worksheet scans + AI results + auto marks |
| `ved-chats` | `Record<sessionId, ChatMessage[]>` | Chat history per session (messages tagged with `questionNum`) |
| `ved-annotations` | `Record<sessionId, TeacherMark[]>` | Manual teacher-mode marks per session |

Helper functions in `src/lib/store.ts`:
- `saveSession / getSession / getRecentSessions`
- `addChatMessage / getChatMessages`
- `saveAnnotations / getAnnotations`
- `updateQuestion` — patches a single question in a stored session

---

## 6. Full User Flow

```
┌──────────┐     capture      ┌──────────────┐   POST /api/evaluate   ┌────────────────┐
│  Home    │ ──────────────▶  │ CaptureModal │ ─────────────────────▶ │ Gemini 2.5     │
│  page    │                  │  (base64)    │                         │ Flash          │
└──────────┘                  └──────────────┘                         └───────┬────────┘
                                                                                │ EvaluationResult JSON
                                                                                ▼
                                                             ┌──────────────────────────────┐
                                                             │  saveSession() → localStorage │
                                                             └──────────────┬───────────────┘
                                                                            │
                                                          POST /api/annotate (parallel)
                                                                            │
                                                                            ▼
                                                             ┌──────────────────────────────┐
                                                             │  Gemini → AutoMark[] JSON     │
                                                             │  saved to session.autoMarks   │
                                                             └──────────────┬───────────────┘
                                                                            │
                                                             router.push('/evaluate/<uuid>')
                                                                            │
                                                                            ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                             /evaluate/[id] — Two-Panel UI                              │
│                                                                                        │
│  ┌─────────────────────────┐   ┌──────────────────────────────────────────────────┐  │
│  │  Left panel (52% width) │   │  Right panel (flex-1)                            │  │
│  │  ┌───────────────────┐  │   │  Q1  Q2  Q3  ← Q tabs (colored status dot)       │  │
│  │  │  Worksheet image  │  │   │  ─────────────────────────────────────────────   │  │
│  │  │  (object-contain) │  │   │  Question text                                   │  │
│  │  │  ───────────────  │  │   │  Status banner (correct / wrong / partial)        │  │
│  │  │  Canvas overlay   │  │   │  Correct answer                                  │  │
│  │  │  (bboxes, marks,  │  │   │  VED Insight                                     │  │
│  │  │   callouts)       │  │   │  Feedback                                        │  │
│  │  └───────────────────┘  │   │  Step-by-step solution (collapsible)             │  │
│  │  [Show Feedback] btn    │   │  [Reattempt] [Ask VED]                           │  │
│  └─────────────────────────┘   └──────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────────────────────────┘
          │                                │
          │ click bbox                     │ click Q tab
          ▼                                ▼
    setActiveQ(i)                    setActiveQ(i)
    right panel switches             bbox highlighted on canvas
    (bidirectional sync)             (bidirectional sync)
```

---

## 7. API Routes

### 7.1 `POST /api/evaluate`

**Purpose:** Parse the worksheet image and evaluate every question.

**Request body:**
```json
{ "imageBase64": "<base64 string>", "mimeType": "image/jpeg" }
```

**Processing:**
1. Instantiates Gemini 2.5 Flash client (thinking disabled: `thinkingBudget: 0`)
2. Sends `EVALUATE_PROMPT` + inline image to `model.generateContent()`
3. Strips markdown fences from response if present
4. Parses JSON → `EvaluationResult`
5. Logs token usage to server console

**Response:** `{ success: true, worksheetTitle, subject, chapter, topic, questions[] }`

**Fallback:** If `GEMINI_API_KEY` is not set or the image is missing, returns a hardcoded mock result (ratios worksheet) so the UI is always testable.

---

**`EVALUATE_PROMPT`** — 3-step instruction to Gemini:

```
STEP 1 — READ THE IMAGE:
  • Locate every printed question number and question text
  • Find every blank/box where the student wrote
  • Read handwriting carefully — do NOT confuse printed text with handwriting
  • Empty box = unanswered

STEP 2 — EVALUATE EACH ANSWER:
  • correct: right answer (allow minor spelling variation)
  • partially_correct: concept right but incomplete/unsimplified
  • incorrect: wrong answer
  • unanswered: blank

STEP 3 — GENERATE EDUCATIONAL CONTENT:
  • correctAnswer: full simplified answer
  • feedback: 1–2 sentences, encouraging, specific
  • vedInsight: one memorable tip (1–2 sentences)
  • steps: 2–4 step-by-step solution entries

Return ONLY valid JSON — no markdown, no backticks.
```

---

### 7.2 `POST /api/annotate`

**Purpose:** Given the evaluated questions, ask Gemini to place correction marks on the image.

**Request body:**
```json
{
  "imageBase64": "...",
  "mimeType": "image/jpeg",
  "questions": [ EvaluatedQuestion, ... ]
}
```

**Processing:**
1. Builds `ANNOTATE_PROMPT` dynamically, injecting each question's number, text, student answer, status, and status color
2. Sends prompt + image to Gemini
3. Parses the JSON array of marks
4. Logs token usage

**Response:** `{ marks: AutoMark[] }`

**Status → Color mapping:**
```
correct           →  #16A34A  (green)
incorrect         →  #DC2626  (red)
partially_correct →  #F59E0B  (amber)
unanswered        →  #9CA3AF  (grey)
```

**`ANNOTATE_PROMPT`** instructs Gemini to produce exactly **2 marks per question**:

| Mark | Type | Description |
|---|---|---|
| 1 | `bbox` | Rectangle fitting the entire question card (question + answer area). Coordinates must match the card's visible border — never 0.0/1.0 unless card truly touches image edge. |
| 2 | Correction | `tick` for correct, `cross` for incorrect/unanswered, `circle` (drag bbox) for partially_correct |

Re-annotation is only triggered if `autoMarks` is missing or the number of `bbox` marks ≠ question count (prevents unnecessary re-fetching on page revisit).

---

### 7.3 `POST /api/chat`

**Purpose:** Socratic AI tutor chat, scoped to a specific question.

**Request body:**
```json
{
  "message": "Why is 6:4 wrong?",
  "questionText": "...",
  "correctAnswer": "3:2",
  "studentAnswer": "6:4",
  "status": "partially_correct",
  "history": [ ChatMessage, ... ]
}
```

**Processing:**
1. Starts a Gemini chat session with `model.startChat()`
2. Seeds chat history with:
   - System prompt (`CHAT_PROMPT_SYSTEM`) as the first user turn
   - VED's greeting as the first model turn
   - Full prior `history` turns
3. Sends the new message prefixed with question context:
   ```
   Context: Question: "..." | Student answered: "..." | Status: ... | Correct: "..."
   Student says: <message>
   ```
4. Returns VED's response text

**`CHAT_PROMPT_SYSTEM`:**
```
You are VED, a friendly AI tutor helping a student understand their worksheet answers.
Be encouraging, Socratic, and educational. Guide them to understand, don't just give answers.
Keep responses concise (2–4 sentences). Use simple language for school students.
```

**Auto-trigger:** When a Q tab is clicked, `AskVedChat` with `autoTrigger=true` automatically sends the question text as the first message — so VED opens with context-aware commentary without the student having to type anything.

---

### 7.4 `POST /api/reattempt`

**Purpose:** Evaluate a student's second-attempt typed answer.

**Request body:**
```json
{
  "questionText": "Find the ratio of ...",
  "correctAnswer": "3:2",
  "studentAnswer": "3:2"
}
```

**Processing:**
1. Sends a minimal prompt to Gemini with the question, correct answer, and new student answer
2. Returns `{ status, feedback }`
3. `updateQuestion()` patches the session in localStorage

**Prompt:**
```
Evaluate if the student's answer is correct, incorrect, or partially correct.
Return ONLY valid JSON:
{"status": "correct|incorrect|partially_correct", "feedback": "1–2 sentence feedback"}
```

---

## 8. Canvas Annotation System

### 8.1 Architecture

The worksheet image is rendered as a plain `<img>` with `object-contain` inside a fixed container. A `<canvas>` with `position: absolute; inset: 0` overlays it exactly. Both share the same pixel dimensions.

```
┌─────────────────────────────────────┐  ← container div (ref: imageContainerRef)
│  ┌──────────┐                       │
│  │          │                       │  ← letterbox padding (black/white space)
│  │  image   │  ← object-contain     │
│  │          │                       │
│  └──────────┘                       │
│  ┌─────────────────────────────────┐│
│  │  <canvas> (absolute inset-0)    ││  ← z-index: 10, same size as container
│  └─────────────────────────────────┘│
└─────────────────────────────────────┘
```

### 8.2 Coordinate Transform

Because `object-contain` letterboxes the image (adds blank padding when aspect ratios differ), image-fraction coordinates cannot be mapped to canvas pixels with a simple multiply. The transform must account for the letterbox offset:

```ts
function getImgTransform(natW, natH, cw, ch): ImgTransform {
  const imgAspect = natW / natH;
  const canvasAspect = cw / ch;

  if (imgAspect > canvasAspect) {
    // Image is wider — letterbox on top/bottom
    const displayH = cw / imgAspect;
    return { offsetX: 0, offsetY: (ch - displayH) / 2, scaleX: cw, scaleY: displayH };
  } else {
    // Image is taller — letterbox on left/right
    const displayW = ch * imgAspect;
    return { offsetX: (cw - displayW) / 2, offsetY: 0, scaleX: displayW, scaleY: ch };
  }
}
```

**Converting fraction → canvas pixel:**
```ts
canvasX = offsetX + fraction_x * scaleX
canvasY = offsetY + fraction_y * scaleY
```

**Converting canvas pixel → fraction (for storing manual marks):**
```ts
fraction_x = (canvasX - offsetX) / scaleX
fraction_y = (canvasY - offsetY) / scaleY
```

### 8.3 `drawMark()` — Mark Rendering

All marks pass through a single `drawMark(ctx, mark, transform, preview?)` function:

| Mark type | Rendering detail |
|---|---|
| `bbox` | `strokeRect` + semi-transparent `fillRect`. Normal: `lineWidth=2`, fill alpha `#18` (≈9%). **Active question**: `lineWidth=4`, fill alpha `#35` (≈21%). Color from `mark.color`. |
| `tick` | Green (`#16A34A`) checkmark. `lineWidth = SIZE * 0.20` where `SIZE = max(scaleX, scaleY) * 0.045` |
| `cross` | Red (`#DC2626`) X. Same thickness as tick. |
| `circle` | Amber (`#F59E0B`) ellipse. `lineWidth=3`. Uses `x2/y2` as bounding box when provided by LLM; minimum radius enforced via `Math.max(rawR, SIZE * 0.4)` to ensure visibility. |
| `underline` | Red line with repeating dots below. |
| `arrow` | Red line with filled arrowhead calculated from `Math.atan2(dy, dx)`. |

### 8.4 Redraw Pipeline

`redraw(markList, previewEnd?)` runs on every state change:

```
1. ctx.clearRect (full canvas)
2. Loop autoMarks:
   - If type=bbox and index=activeQ → draw highlighted bbox
   - Else → draw normally via drawMark()
3. Loop TeacherMarks (manual) → drawMark()
4. If showFeedback → loop bboxes → drawCallout()
5. If drag in progress → draw live preview mark
```

### 8.5 Feedback Callouts (`drawCallout()`)

When "Show Feedback" is toggled on, a dark text overlay is drawn inside each question's bbox:

- **Position:** 38% down from the bbox top, 3% inset from the left edge
- **Width:** 55% of the bbox width
- **Font size:** `clamp(10, bboxHeight * 0.08, 13)px`
- **Background:** `rgba(20,20,20,0.86)` rounded rect
- **Icon:** `✓` (green `#4ADE80`) for correct, `✗` (red `#FCA5A5`) for wrong/partial
- **Text:** `vedInsight` for correct, `feedback` for wrong/partial/unanswered
- **Word wrap:** custom loop using `ctx.measureText()` to break text into lines that fit within the available width

### 8.6 Bidirectional Question Sync

| Direction | Trigger | Action |
|---|---|---|
| Right → Left | Q tab clicked | `setActiveQ(i)` → `redraw()` highlights that question's bbox with stronger border + fill |
| Left → Right | Pointer down on canvas (non-toolbar mode) | `onBboxClick`: hit-tests all `bbox` autoMarks using image-fraction coordinates; calls `onQuestionClick(i)` → `setActiveQ(i)` |

Canvas `pointerEvents` is set to `'auto'` whenever either `showToolbar` or `onQuestionClick` is provided.

---

## 9. Component Architecture (`evaluate/[id]/page.tsx`)

All components live in the single page file, co-located for simplicity.

```
EvaluatePage (default export)
├── state: session, activeQ, showChat, annotating, showFeedback,
│          reattemptQ, reattemptResult, showScanAgain, isProcessing,
│          imgNatural (w/h), imageContainerRef
│
├── <Header> (inline JSX)
│   └── Back, title, score badge, Scan Again, Done
│
├── <Left panel>
│   ├── <img> worksheet image (object-contain)
│   ├── <AnnotationCanvas>
│   │   ├── props: sessionId, containerRef, autoMarks, showToolbar,
│   │   │         naturalW/H, activeQ, onQuestionClick,
│   │   │         showFeedback, questions
│   │   ├── state: marks (TeacherMark[]), tool, dragStart
│   │   ├── redraw() — full canvas repaint
│   │   ├── onPointerDown/Move/Up — toolbar drawing or bbox click
│   │   └── drawCallout() — feedback overlay text
│   └── Image toolbar: Page 1 nav + Show Feedback button
│
├── <Right panel>
│   ├── Q tabs — one per question, colored status dot
│   ├── Question text + status banner
│   ├── Correct answer card
│   ├── VED Insight card
│   ├── Feedback card
│   ├── <StepByStep> — collapsible accordion
│   └── [Reattempt] [Ask VED] buttons
│
└── Overlays (conditionally rendered)
    ├── <AskVedChat>      — chat modal with auto-trigger
    ├── <ReattemptModal>  — typed answer input
    ├── <ReattemptResult> — pass/fail result card
    ├── <CaptureModal>    — scan again
    └── Processing overlay — bounce animation during AI call
```

### Supporting Components

| Component | File | Purpose |
|---|---|---|
| `StatusIcon` | page.tsx | ✅ / ❌ / ⚠️ / ○ based on question status |
| `StepByStep` | page.tsx | Collapsible accordion showing solution steps |
| `ReattemptModal` | page.tsx | Textarea + submit for second attempt |
| `ReattemptResult` | page.tsx | Pass/fail result card with feedback |
| `AskVedChat` | page.tsx | Full chat modal with history and auto-trigger |
| `AnnotationCanvas` | page.tsx | Canvas overlay with all drawing logic |
| `CaptureModal` | components/ | Camera live view + file upload |

---

## 10. Token Usage & Thinking Mode

Every Gemini call logs to the **server console** immediately after the response:

```
[TOKENS] evaluate: { prompt: 753, output: 1074, thinking: 0, total: 1827, thinkingOn: false }
[TOKENS] annotate: { prompt: 1123, output: 220, thinking: 0, total: 1343, thinkingOn: false }
[TOKENS] chat:     { prompt: 421, output: 67, thinking: 0, total: 488, thinkingOn: false }
```

### Thinking Mode

`gemini-2.5-flash` has extended thinking enabled **by default**, where the model performs internal reasoning before producing output. This uses a separate `thoughtsTokenCount` budget on top of the visible output.

**Current setting: thinking OFF** (`thinkingBudget: 0`) on all 4 routes.

Impact measured on a real scan:

| | Thinking ON | Thinking OFF | Saved |
|---|---|---|---|
| evaluate | 4,205 tokens | 1,827 tokens | −57% |
| annotate | 5,119 tokens | 1,343 tokens | −74% |
| **Total per scan** | **9,324** | **3,170** | **−66%** |

To re-enable thinking on a specific route, change:
```ts
// In any getGenerativeModel() call:
generationConfig: { thinkingConfig: { thinkingBudget: 0 } }  // OFF
// to:
generationConfig: {}  // ON (Gemini decides budget automatically)
// or:
generationConfig: { thinkingConfig: { thinkingBudget: 8192 } }  // ON with cap
```

Note: `thoughtsTokenCount` is accessed via `as any` cast because it's not yet typed in `@google/generative-ai` SDK v0.24.1 typedefs, but is present in the runtime response object.

---

## 11. Build & Run

### Prerequisites
```bash
node >= 22.x
GEMINI_API_KEY in .env.local
```

### Build (must use `--webpack`)
```bash
cd worksheet-app
node node_modules/next/dist/bin/next build --webpack
```

### Start
```bash
node node_modules/next/dist/bin/next start
# → http://localhost:3000
```

### Without API key
If `GEMINI_API_KEY` is missing from `.env.local`:
- `/api/evaluate` returns a hardcoded mock worksheet result (ratios topic)
- `/api/annotate` returns `{ marks: [] }`
- `/api/chat` returns a random mock tutor response
- `/api/reattempt` does a naive string match

This allows full UI development and testing without consuming API quota.

---

## 12. Key Design Decisions

| Decision | Reason |
|---|---|
| **All coordinates as image fractions** | Resolution-independent — marks work at any display size, zoom level, or image dimensions without recalculation |
| **Two Gemini calls per scan (evaluate + annotate)** | Separating concerns keeps each prompt focused; annotate can be retried independently without re-evaluating |
| **Canvas overlay, not SVG or DOM elements** | Canvas gives precise pixel control for mixed mark types; no DOM overhead proportional to number of marks |
| **Single page file for evaluate screen** | All canvas + UI components are tightly coupled; co-location avoids prop-drilling across many files |
| **localStorage only, no backend** | Zero infrastructure — students can use it offline after first load; sessions persist across refreshes |
| **`next build --webpack`** | Turbopack panics on this version of Next.js with the current project structure |
| **Thinking disabled** | 66% token reduction per scan with no measurable quality difference for structured JSON output tasks |
| **Auto-trigger chat on Q tab click** | Removes friction — student doesn't have to type a question to start learning; VED immediately gives context |
