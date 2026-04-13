import { NextRequest } from 'next/server';
import { getGeminiClient, CHAT_PROMPT_SYSTEM } from '@/lib/gemini';

const MOCK_RESPONSES = [
  "Great question! Think about what happens when you divide both parts of the ratio by the same number. What's the highest number that divides both evenly?",
  "You're on the right track! Let's check your working step by step. Can you tell me what you did first?",
  "That's a good observation! Remember: the order in a ratio matters. 'A to B' always means A comes first.",
  "Let's break it down. Start by counting each group separately. How many did you count for the first group?",
  "Almost there! The concept you're using is correct, but check your arithmetic in the last step.",
];

export async function POST(request: NextRequest) {
  try {
    const { message, questionText, correctAnswer, studentAnswer, status, history } = await request.json();

    const genAI = getGeminiClient();

    if (!genAI) {
      await new Promise(r => setTimeout(r, 700));
      return Response.json({
        success: true,
        response: MOCK_RESPONSES[Math.floor(Math.random() * MOCK_RESPONSES.length)],
      });
    }

    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash', generationConfig: { thinkingConfig: { thinkingBudget: 0 } } as object });
    const chat = model.startChat({
      history: [
        {
          role: 'user',
          parts: [{ text: CHAT_PROMPT_SYSTEM }],
        },
        {
          role: 'model',
          parts: [{ text: "I'm VED, your AI tutor! I'm here to help you understand your worksheet. What would you like to know?" }],
        },
        ...(history || []).map((m: { role: string; content: string }) => ({
          role: m.role === 'user' ? 'user' : 'model',
          parts: [{ text: m.content }],
        })),
      ],
    });

    const context = `Context: Question: "${questionText}" | Student answered: "${studentAnswer || 'blank'}" | Status: ${status} | Correct: "${correctAnswer}"`;
    const result = await chat.sendMessage(`${context}\n\nStudent says: ${message}`);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const usage = result.response.usageMetadata as any;
    console.log('[TOKENS] chat:', {
      prompt: usage?.promptTokenCount,
      output: usage?.candidatesTokenCount,
      thinking: usage?.thoughtsTokenCount ?? 0,
      total: usage?.totalTokenCount,
      thinkingOn: (usage?.thoughtsTokenCount ?? 0) > 0,
    });

    return Response.json({ success: true, response: result.response.text() });
  } catch (err) {
    console.error('Chat error:', err);
    return Response.json({
      success: true,
      response: MOCK_RESPONSES[Math.floor(Math.random() * MOCK_RESPONSES.length)],
    });
  }
}
