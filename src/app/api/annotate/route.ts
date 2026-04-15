import { NextRequest } from 'next/server';
import { getGeminiClient } from '@/lib/gemini';
import { EvaluatedQuestion } from '@/types';

const STATUS_COLOR: Record<string, string> = {
  correct: '#16A34A',
  incorrect: '#DC2626',
  partially_correct: '#F59E0B',
  unanswered: '#9CA3AF',
};

const ANNOTATE_PROMPT = (questions: EvaluatedQuestion[]) => `You are analyzing a student's worksheet image to extract precise bounding box coordinates.

TASK: For each question card below, find its printed border rectangle and output coordinates.

Questions to locate:
${questions.map(q => `Q${q.number}: "${q.questionText.slice(0, 60)}" | status=${q.status} | color=${STATUS_COLOR[q.status]}`).join('\n')}

STEP 1 — LOCATE EACH QUESTION CARD:
Look at the image carefully. Each question is inside a printed rectangle (may be dashed, dotted, or solid border).
For EACH question card, mentally note:
- Where does the LEFT edge of the card border sit? (as fraction of image width)
- Where does the RIGHT edge of the card border sit? (as fraction of image width)
- Where does the TOP edge of the card border sit? (as fraction of image height)
- Where does the BOTTOM edge of the card border sit? (as fraction of image height)

The card border is the INNER rectangle around just that question — NOT the outer page border, NOT the full image width.
Most worksheets have left/right margins so cards do NOT start at 0.0 or end at 1.0.

STEP 2 — OUTPUT MARKS:
For each question output exactly 2 marks:
A) bbox mark with the card's border coordinates
B) correction mark placed inside the card near the student's answer:
   - correct → tick
   - incorrect → cross
   - partially_correct → circle (with x2,y2 around the answer area)
   - unanswered → cross

OUTPUT FORMAT — return ONLY a JSON array, zero markdown, zero explanation:
[
  {"type":"bbox","x":<left_edge>,"y":<top_edge>,"x2":<right_edge>,"y2":<bottom_edge>,"color":"<status_color>"},
  {"type":"tick","x":<x>,"y":<y>},
  ... repeat for each question
]

VALIDATION before outputting:
- x must be > 0.01 (card does not start at image left)
- x2 must be < 0.99 (card does not end at image right)
- x2 - x should be between 0.5 and 0.95 (typical card width)
- y2 - y should be > 0.05 (card has real height)
- Each question's y range must NOT overlap with another question's y range`;

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
    const rawMarks = JSON.parse(clean);
    // Log exact coordinates Gemini returned for debugging
    console.log('[ANNOTATE] raw marks:', JSON.stringify(rawMarks, null, 2));

    // Safety net: if Gemini returns bbox touching image edges, shrink inward
    const marks = rawMarks.map((m: { type: string; x: number; y: number; x2?: number; y2?: number; color?: string }) => {
      if (m.type !== 'bbox') return m;
      const fixed = { ...m };
      // If x is suspiciously close to 0, likely an error — nudge in
      if (fixed.x !== undefined && fixed.x < 0.02) fixed.x = 0.03;
      if (fixed.x2 !== undefined && fixed.x2 > 0.98) fixed.x2 = 0.97;
      if (fixed.y !== undefined && fixed.y < 0.01) fixed.y = 0.01;
      if (fixed.y2 !== undefined && fixed.y2 > 0.99) fixed.y2 = 0.99;
      console.log(`[ANNOTATE] bbox Q: x=${fixed.x} x2=${fixed.x2} width=${((fixed.x2 ?? 0) - fixed.x).toFixed(3)}`);
      return fixed;
    });

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
