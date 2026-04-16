import { NextRequest } from 'next/server';
import { getGeminiClient } from '@/lib/gemini';
import { EvaluatedQuestion, AutoMark } from '@/types';

const STATUS_COLOR: Record<string, string> = {
  correct: '#16A34A',
  incorrect: '#DC2626',
  partially_correct: '#F59E0B',
  unanswered: '#9CA3AF',
};

/**
 * Strategy: ask Gemini for
 *   1. The 4 corners of the worksheet PAGE in image-fraction coords (handles camera tilt)
 *   2. Each card's position as fractions WITHIN the page (u=horizontal, v=vertical)
 *
 * Then bilinear-interpolate page corners to compute actual quad polygon points.
 * This is mathematically correct for any perspective angle.
 */
const ANNOTATE_PROMPT = (questions: EvaluatedQuestion[]) => `Analyze this worksheet photo. The photo may be taken at an angle.

Questions (top to bottom):
${questions.map(q => `Q${q.number}: status=${q.status} | color=${STATUS_COLOR[q.status]}`).join('\n')}

Return ONLY this JSON structure, no markdown:
{
  "page": [[tlX,tlY],[trX,trY],[brX,brY],[blX,blY]],
  "cards": [
    {
      "q": 1,
      "u1": 0.02, "v1": 0.04,
      "u2": 0.97, "v2": 0.27,
      "color": "#16A34A",
      "mark": {"type": "tick", "u": 0.85, "v": 0.18}
    }
  ]
}

DEFINITIONS:
- page: The 4 corners of the PHYSICAL PAPER SHEET in the photo, as fractions of image width/height (0.0–1.0).
  If camera is angled, the paper appears as a trapezoid/parallelogram — corners will NOT have equal Y values.
  Example angled page: [[0.02,0.01],[0.97,0.04],[0.95,0.99],[0.03,0.97]]
  If paper fills entire image: [[0,0],[1,0],[1,1],[0,1]]
- u1/v1/u2/v2: Card position as fraction of PAGE (not image). u=horizontal (0=left, 1=right), v=vertical (0=top, 1=bottom).
  Cards are cut from the page consistently — if page is 1.0 wide, a full-width card has u1≈0.01, u2≈0.99.
- mark.u/v: Correction symbol position as page fractions.
- mark.type: "tick"=correct, "cross"=incorrect/unanswered, "circle"=partially_correct.

CRITICAL: The "page" field is the most important part. Look carefully at the paper edges in the photo.
If the worksheet is photographed at an angle, the top edge of the paper will be at a different Y than the bottom — capture this.`;

/** Bilinear interpolation: maps (u,v) within page quad → image [x,y] fractions */
function bilinear(page: [number, number][], u: number, v: number): [number, number] {
  const [tl, tr, br, bl] = page as [[number,number],[number,number],[number,number],[number,number]];
  return [
    (1-u)*(1-v)*tl[0] + u*(1-v)*tr[0] + u*v*br[0] + (1-u)*v*bl[0],
    (1-u)*(1-v)*tl[1] + u*(1-v)*tr[1] + u*v*br[1] + (1-u)*v*bl[1],
  ];
}

export async function POST(request: NextRequest) {
  try {
    const { imageBase64, mimeType = 'image/jpeg', questions } = await request.json();

    const genAI = getGeminiClient();
    if (!genAI || !imageBase64 || !questions?.length) {
      return Response.json({ marks: [] });
    }

    // Thinking budget improves spatial/perspective reasoning accuracy
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash', generationConfig: { thinkingConfig: { thinkingBudget: 2048 } } as object });
    const result = await model.generateContent([
      ANNOTATE_PROMPT(questions),
      { inlineData: { data: imageBase64, mimeType } },
    ]);

    const text = result.response.text();
    const clean = text.replace(/^```(?:json)?\n?/m, '').replace(/\n?```$/m, '').trim();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const raw: { page?: [number,number][]; cards?: any[] } = JSON.parse(clean);
    console.log('[ANNOTATE] raw response:', JSON.stringify(raw, null, 2));

    // Fallback page = full image corners (axis-aligned rects if page not detected)
    const hasRealPage = Array.isArray(raw.page) && raw.page.length === 4;
    const page: [number,number][] = hasRealPage ? (raw.page as [number,number][]) : [[0,0],[1,0],[1,1],[0,1]];
    console.log(`[ANNOTATE] page corners (${hasRealPage ? 'DETECTED' : 'FALLBACK'}):`, JSON.stringify(page));

    const marks: AutoMark[] = [];

    for (const card of (raw.cards ?? [])) {
      const { q, u1, v1, u2, v2, color, mark } = card;

      // Compute the 4 actual image-fraction corners via bilinear interpolation
      const pts: [number, number][] = [
        bilinear(page, u1, v1), // top-left
        bilinear(page, u2, v1), // top-right
        bilinear(page, u2, v2), // bottom-right
        bilinear(page, u1, v2), // bottom-left
      ];

      const xs = pts.map(p => p[0]);
      const ys = pts.map(p => p[1]);
      const x  = Math.min(...xs), y  = Math.min(...ys);
      const x2 = Math.max(...xs), y2 = Math.max(...ys);

      console.log(`[ANNOTATE] Q${q}: tl=${pts[0].map(v=>v.toFixed(3))} tr=${pts[1].map(v=>v.toFixed(3))} w=${(x2-x).toFixed(3)} h=${(y2-y).toFixed(3)}`);

      // Find question status for badge
      const qData = questions.find((qq: EvaluatedQuestion) => qq.number === q);
      const status = qData?.status ?? 'unanswered';
      const marksPossible = 1; // default; could be extracted from question text later
      const marksAwarded = status === 'correct' ? 1 : status === 'partially_correct' ? Math.round(marksPossible * 0.5) : 0;
      const qColor = color ?? STATUS_COLOR[status];

      marks.push({ type: 'quad', pts, x, y, x2, y2, color: qColor });

      // Badge: placed at right edge of quad (x2) + 3%, vertically centered
      const badgeX = x2 + 0.03;
      const badgeY = (y + y2) / 2;
      marks.push({ type: 'badge', x: badgeX, y: badgeY, status, marksAwarded, marksPossible } as AutoMark);

      if (mark) {
        const [mx, my] = bilinear(page, mark.u, mark.v);
        const corrMark: AutoMark = { type: mark.type as AutoMark['type'], x: mx, y: my };
        if (mark.type === 'circle') { corrMark.x2 = mx + 0.04; corrMark.y2 = my + 0.02; }
        marks.push(corrMark);
      }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const usage = result.response.usageMetadata as any;
    console.log('[TOKENS] annotate:', {
      prompt: usage?.promptTokenCount,
      output: usage?.candidatesTokenCount,
      thinking: usage?.thoughtsTokenCount ?? 0,
      total: usage?.totalTokenCount,
    });

    return Response.json({ marks });
  } catch (err) {
    console.error('Annotate error:', err);
    return Response.json({ marks: [] });
  }
}
