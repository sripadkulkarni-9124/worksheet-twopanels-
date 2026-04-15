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

1. A "bbox" mark — trace the DASHED/DOTTED printed border rectangle of the question card exactly:

   HOW TO MEASURE (follow precisely):
   - Each question is enclosed in a printed dashed or dotted rectangular border
   - Visually trace that dashed border line with your eyes
   - x  = the x-fraction of the LEFT side of that dashed border line
   - y  = the y-fraction of the TOP side of that dashed border line
   - x2 = the x-fraction of the RIGHT side of that dashed border line
   - y2 = the y-fraction of the BOTTOM side of that dashed border line
   - The bbox must EXACTLY follow the printed dashed border — not the image edge, not the page margin, not any outer container
   - Each question card has its own independent dashed border — measure each one separately
   - color = the status color listed above

2. A correction mark placed just to the right of the student's written answer:
   - "correct"           → {"type":"tick",  "x":…, "y":…}
   - "incorrect"         → {"type":"cross", "x":…, "y":…}
   - "partially_correct" → {"type":"circle","x":…,"y":…,"x2":…,"y2":…}
   - "unanswered"        → {"type":"cross", "x":…, "y":…}

CRITICAL RULES:
- Coordinates are fractions of the FULL image width/height (0.0 = left/top edge, 1.0 = right/bottom edge)
- x and x2 MUST be the dashed border's own left/right edges — questions may not span the full image width
- y2 MUST be the dashed border's bottom line — NOT the page bottom, NOT below the card
- Do NOT use 0.0 or 1.0 unless the dashed border literally touches that image edge
- If questions have different widths or positions, reflect that exactly — do not normalize them to the same x/x2
- Every question needs exactly one bbox + one correction mark

Return ONLY a valid JSON array, no markdown, no explanation:
[
  {"type":"bbox",  "x":0.04,"y":0.08,"x2":0.94,"y2":0.28,"color":"#16A34A"},
  {"type":"tick",  "x":0.85,"y":0.22},
  {"type":"bbox",  "x":0.04,"y":0.30,"x2":0.94,"y2":0.52,"color":"#DC2626"},
  {"type":"cross", "x":0.85,"y":0.48},
  {"type":"bbox",  "x":0.04,"y":0.54,"x2":0.94,"y2":0.74,"color":"#F59E0B"},
  {"type":"circle","x":0.55,"y":0.66,"x2":0.85,"y2":0.72}
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
