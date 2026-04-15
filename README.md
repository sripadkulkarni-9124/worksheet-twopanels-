# VED Worksheet Evaluator — V1

Next.js 16.2.3 fullstack app. Frontend + backend API routes in one project.

## Stack
- **Frontend**: React 19, Tailwind CSS, HTML5 Canvas (raw)
- **Backend**: Next.js API routes (Node.js)
- **AI**: Google Gemini 2.5 Flash
- **Storage**: localStorage (browser)

## Run

```bash
# 1. Add API key
echo "GEMINI_API_KEY=your_key_here" > .env.local

# 2. Build (must use --webpack)
node node_modules/next/dist/bin/next build --webpack

# 3. Start
node node_modules/next/dist/bin/next start
# → http://localhost:3000
```

## API Routes
| Route | Purpose |
|---|---|
| POST /api/evaluate | Scan worksheet image → AI evaluation |
| POST /api/annotate | Generate bbox/tick/cross canvas marks |
| POST /api/chat | VED AI tutor chat |
| POST /api/reattempt | Evaluate student's second attempt |

## Features
- Camera capture / file upload
- AI evaluates all questions (correct/incorrect/partial/unanswered)
- Colored bounding boxes traced on worksheet image
- Bidirectional Q tab ↔ bbox sync
- Show Feedback callout overlay on canvas
- Ask VED chat (Socratic AI tutor)
- Reattempt wrong questions
- Token usage logging (thinking OFF — 66% token savings)
