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

1. A "bbox" mark — a colored rectangle that fits EXACTLY around the visible question card/block:
   - Detect the actual left and right edges of the question card as it appears in the image (it may have margins from the image edge — do NOT extend to the image border)
   - x, y = top-left corner of the card border (fraction of image 0.0–1.0)
   - x2, y2 = bottom-right corner of the card border (fraction of image 0.0–1.0)
   - The box must hug the card edges precisely: same left/right as the card's visible border, top at the question heading, bottom at the end of the answer area
   - color = the color listed above for that question's status

2. A correction mark placed just to the right of the student's written answer:
   - "correct"           → {"type":"tick",  "x":…, "y":…}
   - "incorrect"         → {"type":"cross", "x":…, "y":…}
   - "partially_correct" → {"type":"circle","x":…,"y":…,"x2":…,"y2":…}  (bounding the answer cells only)
   - "unanswered"        → {"type":"cross", "x":…, "y":…}

Rules:
- All coordinates are fractions of image width/height (0.0 = left/top, 1.0 = right/bottom)
- CRITICAL: x and x2 must match the actual left/right borders of the question card — never use 0.0 or 1.0 unless the card truly touches the image edge
- The bbox left edge (x) and right edge (x2) should be the same for every question since they share the same card column width
- For tick/cross: x,y is a point just to the right of the student's written answer
- Every question MUST have exactly one bbox mark and one correction mark

Return ONLY a valid JSON array, no markdown, no explanation:
[
  {"type":"bbox",  "x":0.03,"y":0.10,"x2":0.97,"y2":0.35,"color":"#16A34A"},
  {"type":"tick",  "x":0.88,"y":0.28},
  {"type":"bbox",  "x":0.03,"y":0.37,"x2":0.97,"y2":0.62,"color":"#DC2626"},
  {"type":"cross", "x":0.88,"y":0.55},
  {"type":"bbox",  "x":0.03,"y":0.64,"x2":0.97,"y2":0.90,"color":"#F59E0B"},
  {"type":"circle","x":0.55,"y":0.78,"x2":0.90,"y2":0.86}
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
