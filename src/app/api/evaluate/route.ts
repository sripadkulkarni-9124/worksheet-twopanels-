import { NextRequest } from 'next/server';
import { getGeminiClient, EVALUATE_PROMPT } from '@/lib/gemini';
import { EvaluationResult, EvaluatedQuestion } from '@/types';

/** Sanitize Gemini box_2d coords per question — clamp, fix overlaps, normalize to 0-1 */
function sanitizeBboxes(questions: EvaluatedQuestion[]): EvaluatedQuestion[] {
  const N = questions.length;
  if (!N) return questions;

  // Parse & clamp each bbox
  questions = questions.map(q => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const raw = (q as any).box_2d;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rawAns = (q as any).answer_box;
    let b: [number,number,number,number] | undefined;
    let a: [number,number,number,number] | undefined;

    if (Array.isArray(raw) && raw.length === 4) {
      let [y0, x0, y1, x1] = raw.map(Number);
      // Auto-detect 0-100 scale
      if (Math.max(y0,x0,y1,x1) <= 100) { y0*=10; x0*=10; y1*=10; x1*=10; }
      // Clamp
      y0 = Math.max(0, Math.min(1000, y0));
      x0 = Math.max(0, Math.min(1000, x0));
      y1 = Math.max(0, Math.min(1000, y1));
      x1 = Math.max(0, Math.min(1000, x1));
      // Swap if inverted
      if (y0 > y1) [y0, y1] = [y1, y0];
      if (x0 > x1) [x0, x1] = [x1, x0];
      // Min box size
      if (y1 - y0 < 50) y1 = y0 + 50;
      if (x1 - x0 < 100) x1 = x0 + 100;
      b = [y0, x0, y1, x1];
    }

    if (Array.isArray(rawAns) && rawAns.length === 4) {
      let [y0, x0, y1, x1] = rawAns.map(Number);
      if (Math.max(y0,x0,y1,x1) <= 100) { y0*=10; x0*=10; y1*=10; x1*=10; }
      y0 = Math.max(0, Math.min(1000, y0));
      x0 = Math.max(0, Math.min(1000, x0));
      y1 = Math.max(0, Math.min(1000, y1));
      x1 = Math.max(0, Math.min(1000, x1));
      if (y0 > y1) [y0, y1] = [y1, y0];
      if (x0 > x1) [x0, x1] = [x1, x0];
      a = [y0, x0, y1, x1];
    }

    return { ...q, bboxNorm: b ? [b[0]/1000, b[1]/1000, b[2]/1000, b[3]/1000] as [number,number,number,number] : undefined,
                   answerBoxNorm: a ? [a[0]/1000, a[1]/1000, a[2]/1000, a[3]/1000] as [number,number,number,number] : undefined };
  });

  // Fix overlaps: sort by ymin, push down overlapping boxes
  const withBox = questions.filter(q => q.bboxNorm);
  withBox.sort((a, b) => (a.bboxNorm![0]) - (b.bboxNorm![0]));
  for (let i = 1; i < withBox.length; i++) {
    const prev = withBox[i-1].bboxNorm!;
    const cur  = withBox[i].bboxNorm!;
    if (cur[0] < prev[2]) {
      const mid = (prev[2] + cur[0]) / 2;
      prev[2] = mid;
      cur[0]  = mid;
    }
  }

  return questions;
}

function mockResult(): EvaluationResult {
  return {
    worksheetTitle: 'Understanding Ratios',
    subject: 'Mathematics',
    chapter: 'Proportional Reasoning',
    topic: 'Ratios and Proportions',
    questions: [
      {
        number: 1,
        questionText: 'Find the ratio of chocolate cones to strawberry cones.',
        studentAnswer: '6:4',
        correctAnswer: '3:2',
        status: 'partially_correct',
        feedback: 'You counted correctly! The ratio 6:4 is equivalent to 3:2, but we simplify ratios to their lowest terms.',
        vedInsight: 'Always simplify ratios by dividing both parts by their HCF. 6:4 → divide by 2 → 3:2.',
        steps: [
          { title: 'Step 1: Count each group', points: ['Chocolate cones = 6', 'Strawberry cones = 4'] },
          { title: 'Step 2: Write as ratio', points: ['Ratio = 6 : 4'] },
          { title: 'Step 3: Simplify', points: ['HCF of 6 and 4 = 2', 'Divide both by 2 → 3 : 2'] },
        ],
      },
      {
        number: 2,
        questionText: 'Find the ratio of circles to triangles.',
        studentAnswer: '8:5',
        correctAnswer: '8:5',
        status: 'correct',
        feedback: 'Perfect! You identified both groups correctly and wrote the ratio in the right order.',
        vedInsight: 'Order matters in ratios! "Circles to triangles" means circles come first.',
        steps: [
          { title: 'Step 1: Count shapes', points: ['Circles = 8', 'Triangles = 5'] },
          { title: 'Step 2: Write ratio (circles first)', points: ['Ratio = 8 : 5'] },
          { title: 'Step 3: Check if simplifiable', points: ['HCF of 8 and 5 = 1', 'Already in simplest form ✓'] },
        ],
      },
      {
        number: 3,
        questionText: 'Find the ratio of prime numbers to composite numbers from 1 to 25.',
        studentAnswer: null,
        correctAnswer: '4:8 = 1:2',
        status: 'unanswered',
        feedback: 'This question was left blank. Try listing all prime and composite numbers from 1–25 first.',
        vedInsight: 'Prime numbers have exactly 2 factors. Composite have more than 2. 1 is neither!',
        steps: [
          { title: 'Step 1: List primes (1–25)', points: ['Primes: 2, 3, 5, 7, 11, 13, 17, 19, 23 → 9 primes'] },
          { title: 'Step 2: List composites', points: ['4, 6, 8, 9, 10, 12, 14, 15, 16, 18, 20, 21, 22, 24, 25 → 15 composites'] },
          { title: 'Step 3: Write and simplify', points: ['Ratio = 9 : 15', 'HCF = 3', 'Simplified = 3 : 5'] },
        ],
      },
    ],
  };
}

export async function POST(request: NextRequest) {
  try {
    const { imageBase64, mimeType = 'image/jpeg' } = await request.json();

    const genAI = getGeminiClient();

    if (!genAI || !imageBase64) {
      await new Promise(r => setTimeout(r, 1200)); // Simulate latency
      return Response.json({ success: true, ...mockResult() });
    }

    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash', generationConfig: { thinkingConfig: { thinkingBudget: 4096 } } as object });

    const result = await model.generateContent([
      EVALUATE_PROMPT,
      { inlineData: { data: imageBase64, mimeType } },
    ]);

    const text = result.response.text();
    const clean = text.replace(/^```(?:json)?\n?/m, '').replace(/\n?```$/m, '').trim();
    const raw = JSON.parse(clean);
    const data: EvaluationResult = {
      ...raw,
      questions: sanitizeBboxes(raw.questions ?? []),
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const usage = result.response.usageMetadata as any;
    console.log('[TOKENS] evaluate:', {
      prompt: usage?.promptTokenCount,
      output: usage?.candidatesTokenCount,
      thinking: usage?.thoughtsTokenCount ?? 0,
      total: usage?.totalTokenCount,
      thinkingOn: (usage?.thoughtsTokenCount ?? 0) > 0,
    });

    return Response.json({ success: true, ...data });
  } catch (err) {
    console.error('Evaluate error:', JSON.stringify(err, null, 2));
    console.error('Evaluate error message:', (err as Error)?.message);
    return Response.json({ success: true, ...mockResult() });
  }
}
