import { NextRequest } from 'next/server';
import { getGeminiClient } from '@/lib/gemini';
import { EvaluatedQuestion } from '@/types';

const STATUS_COLOR: Record<string, string> = {
  correct: '#16A34A',
  incorrect: '#DC2626',
  partially_correct: '#F59E0B',
  unanswered: '#9CA3AF',
};

const ANNOTATE_PROMPT = (questions: EvaluatedQuestion[]) => `You are a teacher marking a student's worksheet image.

Here are the evaluation results for each question:
${questions.map(q => `Q${q.number}: "${q.questionText}" — Student wrote: "${q.studentAnswer ?? 'nothing'}" — Status: ${q.status} — Color: ${STATUS_COLOR[q.status]}`).join('\n')}

For EACH question produce TWO marks:

1. A "bbox" mark — a colored rectangle around the question card/block:
   MEASURING RULES (follow exactly):
   - Look for the visible BORDER LINE of the question card (a printed rectangle with a stroke/outline)
   - x  = fraction where the card's LEFT border line is (NOT the image left edge)
   - y  = fraction where the card's TOP border line is (NOT the image top edge)
   - x2 = fraction where the card's RIGHT border line is (NOT the image right edge)
   - y2 = fraction where the card's BOTTOM border line is — this is the bottom of the ANSWER AREA, NOT the bottom of the page
   - The bbox must STOP at the card border — do NOT extend into grid paper, margins, or page number areas below/outside the card
   - color = the status color listed above

2. A correction mark placed just to the right of the student's written answer:
   - "correct"           → {"type":"tick",  "x":…, "y":…}
   - "incorrect"         → {"type":"cross", "x":…, "y":…}
   - "partially_correct" → {"type":"circle","x":…,"y":…,"x2":…,"y2":…}
   - "unanswered"        → {"type":"cross", "x":…, "y":…}

STRICT RULES:
- All coordinates = fractions of full image width/height (0.0–1.0)
- NEVER output x=0.0 or x2=1.0 or y=0.0 or y2=1.0 unless the card border literally touches that image edge
- y2 must be INSIDE the card — it must be ABOVE any grid/graph paper, page numbers, or footer text that appears below the card
- The correction mark (tick/cross/circle) must be INSIDE the card boundaries
- Every question needs exactly one bbox + one correction mark

Return ONLY a valid JSON array, no markdown, no explanation:
[
  {"type":"bbox",  "x":0.04,"y":0.08,"x2":0.96,"y2":0.32,"color":"#16A34A"},
  {"type":"tick",  "x":0.86,"y":0.25},
  {"type":"bbox",  "x":0.04,"y":0.34,"x2":0.96,"y2":0.58,"color":"#DC2626"},
  {"type":"cross", "x":0.86,"y":0.52},
  {"type":"bbox",  "x":0.04,"y":0.60,"x2":0.96,"y2":0.82,"color":"#F59E0B"},
  {"type":"circle","x":0.55,"y":0.72,"x2":0.88,"y2":0.80}
]`;

export async function POST(request: NextRequest) {
  try {
    const { imageBase64, mimeType = 'image/jpeg', questions } = await request.json();

    const genAI = getGeminiClient();
    if (!genAI || !imageBase64 || !questions?.length) {
      return Response.json({ marks: [] });
    }

    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash', generationConfig: { thinkingConfig: { thinkingBudget: 0 } } as object });
    const result = await model.generateContent([
      ANNOTATE_PROMPT(questions),
      { inlineData: { data: imageBase64, mimeType } },
    ]);

    const text = result.response.text();
    const clean = text.replace(/^```(?:json)?\n?/m, '').replace(/\n?```$/m, '').trim();
    const marks = JSON.parse(clean);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const usage = result.response.usageMetadata as any;
    console.log('[TOKENS] annotate:', {
      prompt: usage?.promptTokenCount,
      output: usage?.candidatesTokenCount,
      thinking: usage?.thoughtsTokenCount ?? 0,
      total: usage?.totalTokenCount,
      thinkingOn: (usage?.thoughtsTokenCount ?? 0) > 0,
    });

    return Response.json({ marks });
  } catch (err) {
    console.error('Annotate error:', err);
    return Response.json({ marks: [] });
  }
}
