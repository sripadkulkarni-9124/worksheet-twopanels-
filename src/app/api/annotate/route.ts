import { NextRequest } from 'next/server';
import { EvaluatedQuestion, AutoMark } from '@/types';

/**
 * Pure coordinate math — NO Gemini call.
 * Takes questions with bboxNorm/answerBoxNorm from evaluate,
 * emits: quad (card border) + badge + tick/cross + error_highlight per question.
 * Scale contract: all coords 0-1 floats; frontend multiplies by rendered imageWidth/Height.
 */

const STATUS_COLOR: Record<string, string> = {
  correct: '#16A34A',
  incorrect: '#DC2626',
  partially_correct: '#F59E0B',
  unanswered: '#9CA3AF',
};

const MARKS_POSSIBLE: Record<string, number> = {}; // could be extended later

export async function POST(request: NextRequest) {
  try {
    const { questions } = await request.json() as { questions: EvaluatedQuestion[] };

    if (!questions?.length) return Response.json({ marks: [] });

    const marks: AutoMark[] = [];

    for (const q of questions) {
      const bbox = q.bboxNorm;
      const ansBox = q.answerBoxNorm;
      const status = q.status;
      const color = STATUS_COLOR[status];

      if (!bbox) {
        console.warn(`[ANNOTATE] Q${q.number}: no bboxNorm — skipping`);
        continue;
      }

      // bbox = [ymin, xmin, ymax, xmax] normalized 0-1
      const [yn, xn, ym, xm] = bbox;
      // Map to our x/y/x2/y2 convention
      const x = xn, y = yn, x2 = xm, y2 = ym;

      // 1. Quad — card border, axis-aligned (straight-on photos)
      //    pts let canvas draw it as a polygon; using rect corners here
      const pts: [number,number][] = [[x,y],[x2,y],[x2,y2],[x,y2]];
      marks.push({ type: 'quad', x, y, x2, y2, pts, color } as AutoMark);

      // 2. Error highlight — tight box on student's answer (wrong/partial only)
      if (ansBox && (status === 'incorrect' || status === 'partially_correct')) {
        const [ay, ax, aym, axm] = ansBox;
        marks.push({
          type: 'bbox',
          x: ax, y: ay, x2: axm, y2: aym,
          color: status === 'incorrect' ? '#DC262640' : '#F59E0B40',
        } as AutoMark);
      }

      // 3. Badge — right of card, vertically centered; clamped to 0.96
      const badgeX = Math.min(x2 + 0.03, 0.96);
      const badgeY = (y + y2) / 2;
      const marksPossible = MARKS_POSSIBLE[q.number] ?? 1;
      const marksAwarded = status === 'correct' ? marksPossible
        : status === 'partially_correct' ? Math.round(marksPossible * 0.5)
        : 0;

      marks.push({
        type: 'badge',
        x: badgeX,
        y: badgeY,
        status,
        marksAwarded,
        marksPossible,
        color,
      } as AutoMark);

      // 4. Tick or Cross at badge position
      if (status === 'correct' || status === 'partially_correct') {
        marks.push({ type: 'tick', x: badgeX, y: badgeY, color: '#16A34A' } as AutoMark);
      } else {
        marks.push({ type: 'cross', x: badgeX, y: badgeY, color: '#DC2626' } as AutoMark);
      }

      console.log(`[ANNOTATE] Q${q.number} ${status}: bbox=[${x.toFixed(3)},${y.toFixed(3)},${x2.toFixed(3)},${y2.toFixed(3)}] badge=(${badgeX.toFixed(3)},${badgeY.toFixed(3)})`);
    }

    console.log(`[ANNOTATE] emitted ${marks.length} marks for ${questions.length} questions`);
    return Response.json({ marks });

  } catch (err) {
    console.error('Annotate error:', err);
    return Response.json({ marks: [] });
  }
}
