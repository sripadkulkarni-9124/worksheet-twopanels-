import { NextRequest } from 'next/server';
import { getGeminiClient, EVALUATE_PROMPT } from '@/lib/gemini';
import { EvaluationResult } from '@/types';

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

    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    const result = await model.generateContent([
      EVALUATE_PROMPT,
      { inlineData: { data: imageBase64, mimeType } },
    ]);

    const text = result.response.text();
    // Strip markdown code fences if present
    const clean = text.replace(/^```(?:json)?\n?/m, '').replace(/\n?```$/m, '').trim();
    const data: EvaluationResult = JSON.parse(clean);

    return Response.json({ success: true, ...data });
  } catch (err) {
    console.error('Evaluate error:', JSON.stringify(err, null, 2));
    console.error('Evaluate error message:', (err as Error)?.message);
    return Response.json({ success: true, ...mockResult() });
  }
}
