import { NextRequest } from 'next/server';
import { getGeminiClient } from '@/lib/gemini';

export async function POST(request: NextRequest) {
  try {
    const { questionText, correctAnswer, studentAnswer } = await request.json();

    const genAI = getGeminiClient();

    if (!genAI) {
      const norm = (s: string) => s.toLowerCase().replace(/\s+/g, '').replace(/[^a-z0-9:.]/g, '');
      const match = norm(studentAnswer) === norm(correctAnswer);
      return Response.json({
        status: match ? 'correct' : 'incorrect',
        feedback: match ? 'Correct! Well done.' : `Not quite. The correct answer is ${correctAnswer}.`,
      });
    }

    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
    const result = await model.generateContent(`
You are evaluating a student's reattempt answer.

Question: "${questionText}"
Correct answer: "${correctAnswer}"
Student's answer: "${studentAnswer}"

Evaluate if the student's answer is correct, incorrect, or partially correct.
Return ONLY valid JSON:
{"status": "correct|incorrect|partially_correct", "feedback": "1-2 sentences of specific encouraging feedback"}
`);

    const text = result.response.text();
    const clean = text.replace(/^```(?:json)?\n?/m, '').replace(/\n?```$/m, '').trim();
    return Response.json(JSON.parse(clean));
  } catch (err) {
    console.error('Reattempt error:', err);
    return Response.json({ status: 'incorrect', feedback: 'Could not evaluate. Try again.' });
  }
}
