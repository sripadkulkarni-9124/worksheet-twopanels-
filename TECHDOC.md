# VED Worksheet Evaluator — Technical Documentation

## Overview

VED is a Next.js 16.2.3 web app that lets a student photograph a worksheet, have it automatically evaluated by AI, and then explore per-question feedback, reattempt wrong answers, and chat with an AI tutor. A teacher-style annotation layer is drawn directly on the worksheet image using HTML5 Canvas.

---

## Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16.2.3 (App Router, `'use client'` pages) |
| AI Model | Google Gemini 2.5 Flash (`@google/generative-ai`) |
| Rendering | React 18, Tailwind CSS |
| Canvas | HTML5 Canvas API (annotation overlay) |
| Persistence | `localStorage` (sessions, annotations, chat history) |
| Build | `next build --webpack` (Turbopack disabled — panics on this project) |
| Runtime | `next start` (production server, port 3000) |

---

## Project Structure

```
src/
  app/
    page.tsx                    # Home — subject cards, recent worksheets, scan button
    evaluate/[id]/page.tsx      # Main evaluation screen (two-panel layout)
    api/
      evaluate/route.ts         # POST — scan image → evaluate all questions
      annotate/route.ts         # POST — image + questions → canvas marks (bbox, tick, cross, circle)
      chat/route.ts             # POST — Socratic AI tutor chat per question
      reattempt/route.ts        # POST — evaluate a student's second attempt
  lib/
    gemini.ts                   # Gemini client factory + EVALUATE_PROMPT + CHAT_PROMPT_SYSTEM
    store.ts                    # localStorage helpers (sessions, annotations, chat messages)
  types/
    index.ts                    # Shared TypeScript interfaces
  components/
    CaptureModal.tsx            # Camera/file picker for worksheet image
```

---

## Data Model

### `EvaluationSession` (persisted in `localStorage` under `ved-sessions`)
```ts
{
  id: string;                  // UUID
  imageDataUrl: string;        // base64 data URL of the worksheet photo
  result: EvaluationResult;    // AI-parsed questions and metadata
  timestamp: string;           // ISO 8601
  autoMarks?: AutoMark[];      // LLM-generated annotation marks
}
```

### `EvaluatedQuestion`
```ts
{
  number: number;
  questionText: string;
  studentAnswer: string | null;
  correctAnswer: string;
  status: 'correct' | 'incorrect' | 'partially_correct' | 'unanswered';
  feedback: string;            // 1-2 sentence encouraging feedback
  vedInsight: string;          // one memorable learning tip
  steps: SolutionStep[];       // step-by-step solution
}
```

### `AutoMark` (canvas annotation mark)
```ts
{
  type: 'tick' | 'cross' | 'circle' | 'underline' | 'arrow' | 'bbox';
  x: number;    // image-fraction 0.0–1.0
  y: number;
  x2?: number;  // drag end (bbox, circle, underline, arrow)
  y2?: number;
  color?: string; // hex color (used by bbox)
}
```

All coordinates are **image fractions** (0.0 = left/top edge, 1.0 = right/bottom edge of the natural image), not pixels. This makes them resolution-independent.

---

## App Flow

### 1. Capture
User taps "Scan Worksheet" on the home page → `CaptureModal` opens → user takes a photo or uploads an image → image is converted to a base64 data URL.

### 2. Evaluate (`POST /api/evaluate`)
The base64 image is sent to Gemini 2.5 Flash along with `EVALUATE_PROMPT`.

**What the prompt does (3 steps):**
1. **Read the image** — locate every printed question number, question text, and student handwriting
2. **Evaluate each answer** — compare handwritten answer against the correct answer; assign `correct / incorrect / partially_correct / unanswered`
3. **Generate educational content** — produce `feedback`, `vedInsight`, and `steps[]` per question

**Response JSON shape:**
```json
{
  "worksheetTitle": "...",
  "subject": "Mathematics",
  "chapter": "...",
  "topic": "...",
  "questions": [ { "number": 1, "questionText": "...", ... } ]
}
```

The result is saved as an `EvaluationSession` in `localStorage` and the user is routed to `/evaluate/<uuid>`.

### 3. Annotate (`POST /api/annotate`)
After the session is saved, the evaluate page immediately fires a second Gemini call with the same image plus the evaluated questions.

**What the prompt does:**  
For each question it returns **two marks**:

| Mark | Description |
|---|---|
| `bbox` | Colored rectangle exactly around the full question block (question + answer area). Color = status color. Coordinates match the card's visible edges. |
| `tick` / `cross` / `circle` | Correction mark placed to the right of the student's written answer |

**Status → color mapping:**
```
correct          → #16A34A  (green)
incorrect        → #DC2626  (red)
partially_correct → #F59E0B  (amber)
unanswered       → #9CA3AF  (grey)
```

All coordinates returned as image fractions (0.0–1.0). The marks are stored in `session.autoMarks` and persisted in `localStorage`.

Re-annotation is triggered only when `autoMarks` is missing or the number of `bbox` marks doesn't match the question count.

### 4. Render — Two-Panel Layout

```
┌─────────────────────┬──────────────────────┐
│  Left panel (52%)   │  Right panel (flex-1) │
│  Worksheet image    │  Q tabs               │
│  + Canvas overlay   │  Question detail      │
│                     │  Status / Answer      │
│                     │  VED Insight          │
│                     │  Feedback             │
│                     │  Step-by-step         │
│                     │  [Reattempt] [Ask VED]│
└─────────────────────┴──────────────────────┘
```

**Left panel** — `<img>` with `object-contain` + `<canvas>` overlay positioned `absolute inset-0`.  
**Right panel** — question tabs + detail view. Active question (`activeQ` state) drives what the panel shows.

### 5. Canvas Annotation System

#### Coordinate transform
Because the image uses `object-contain` (letterboxed), the canvas pixel position of any image point must account for the letterbox offset and scale:

```ts
function getImgTransform(natW, natH, cw, ch): ImgTransform {
  // Returns { offsetX, offsetY, scaleX, scaleY }
  // pixel = offset + fraction * scale
}
```

#### Drawing marks
`drawMark(ctx, mark, transform)` converts image-fraction coordinates to canvas pixels, then draws:

| Type | Rendering |
|---|---|
| `bbox` | Stroked + semi-transparent filled rounded rect; `lineWidth = 2` (active Q: `lineWidth = 4`, stronger fill) |
| `tick` | Green checkmark; `lineWidth = SIZE * 0.20` |
| `cross` | Red X; `lineWidth = SIZE * 0.20` |
| `circle` | Amber ellipse; `lineWidth = 3`, minimum radius enforced; color defaults to `#F59E0B` |
| `underline` | Red line with dot pattern |
| `arrow` | Red line with arrowhead |

#### Feedback callouts (Show Feedback button)
When toggled on, `drawCallout()` draws a dark rounded text box at **38% from the top** of each question's bbox:
- **Correct** → green `✓` + `vedInsight` text  
- **Wrong / partial** → red `✗` + `feedback` text  
- Text wraps to fit within **55% of the bbox width**

#### Bidirectional Q sync
- **Right → Left**: clicking a Q tab sets `activeQ`; `redraw` highlights that bbox (thicker border + stronger fill)
- **Left → Right**: `onPointerDown` on the canvas (even without toolbar active) checks which bbox contains the click and calls `onQuestionClick(i)` → sets `activeQ`

### 6. Chat (`POST /api/chat`)
Opens as a modal overlay (`AskVedChat`). Each Q tab click auto-triggers an initial message with question context.

Every message is sent with:
- Full chat `history` (prior turns)  
- A context prefix: `Question: "..." | Student answered: "..." | Status: ... | Correct: "..."`
- The system prompt (`CHAT_PROMPT_SYSTEM`) primes VED to be Socratic and concise

Chat history is persisted in `localStorage` under `ved-chats`.

### 7. Reattempt (`POST /api/reattempt`)
Student types a new answer in `ReattemptModal` → sent to Gemini with the question text and correct answer → returns `{ status, feedback }` → updates the question in `localStorage` and refreshes the UI.

---

## Token Usage & Thinking Mode

Every API route logs token counts to the **server console** after each Gemini call:

```
[TOKENS] evaluate: { prompt: 1842, output: 312, thinking: 2104, total: 4258, thinkingOn: true }
[TOKENS] annotate: { prompt: 1654, output: 89, thinking: 741, total: 2484, thinkingOn: true }
[TOKENS] chat:     { prompt: 421, output: 67, thinking: 318, total: 806, thinkingOn: true }
```

**Thinking mode**: `gemini-2.5-flash` has thinking **enabled by default**. The `thoughtsTokenCount` field (accessed via `as any` — not yet in SDK typedefs) shows how many tokens were used for internal reasoning. To disable thinking (faster, cheaper), add to any `getGenerativeModel` call:
```ts
generationConfig: { thinkingConfig: { thinkingBudget: 0 } }
```

---

## Persistence

All state lives in `localStorage` (no backend database):

| Key | Contents |
|---|---|
| `ved-sessions` | `Record<id, EvaluationSession>` — worksheet results + auto marks |
| `ved-chats` | `Record<sessionId, ChatMessage[]>` — chat history per session |
| `ved-annotations` | `Record<sessionId, TeacherMark[]>` — manual canvas marks |

---

## Build & Run

```bash
# Build (must use --webpack, Turbopack panics)
node node_modules/next/dist/bin/next build --webpack

# Start production server
node node_modules/next/dist/bin/next start
# → http://localhost:3000
```

Environment variable required for live AI (otherwise mock data is returned):
```
GEMINI_API_KEY=<your key>   # in .env.local
```
