'use client';

import { useState, useEffect, use, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { EvaluationSession, EvaluatedQuestion, ChatMessage, EvaluationResult } from '@/types';
import {
  getSession, getChatMessages, addChatMessage, updateQuestion,
  getAnnotations, saveAnnotations, saveSession, TeacherMark, MarkType,
} from '@/lib/store';
import { AutoMark } from '@/types';
import CaptureModal from '@/components/CaptureModal';

// ─── Constants ─────────────────────────────────────────────────────────────

// ─── StatusIcon ─────────────────────────────────────────────────────────────
function StatusIcon({ status }: { status: EvaluatedQuestion['status'] }) {
  if (status === 'correct') return <span className="text-green-500 text-lg">✅</span>;
  if (status === 'incorrect') return <span className="text-red-500 text-lg">❌</span>;
  if (status === 'partially_correct') return <span className="text-amber-500 text-lg">⚠️</span>;
  return <span className="text-gray-400 text-lg">○</span>;
}

// ─── StepByStep ─────────────────────────────────────────────────────────────
function StepByStep({ steps }: { steps: EvaluatedQuestion['steps'] }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-4 border border-gray-100 rounded-2xl overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors"
      >
        <span className="font-semibold text-gray-800 text-sm flex items-center gap-2">
          <span>📋</span> Step-by-Step Solution
        </span>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
          className={`transition-transform ${open ? 'rotate-180' : ''}`}>
          <polyline points="6,9 12,15 18,9" />
        </svg>
      </button>
      {open && (
        <div className="p-4 space-y-3">
          {steps.map((step, i) => (
            <div key={i}>
              <div className="font-semibold text-gray-800 text-sm mb-1">{step.title}</div>
              <ul className="space-y-0.5">
                {step.points.map((p, j) => (
                  <li key={j} className="text-sm text-gray-600 flex gap-2">
                    <span className="text-gray-400 shrink-0">•</span>
                    <span dangerouslySetInnerHTML={{ __html: p.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') }} />
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── ReattemptModal ──────────────────────────────────────────────────────────
function ReattemptModal({
  question,
  onClose,
  onSuccess,
}: {
  question: EvaluatedQuestion;
  onClose: () => void;
  onSuccess: (status: EvaluatedQuestion['status'], feedback: string, answer: string) => void;
}) {
  const [answer, setAnswer] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!answer.trim() || loading) return;
    setLoading(true);
    try {
      const res = await fetch('/api/reattempt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          questionText: question.questionText,
          correctAnswer: question.correctAnswer,
          studentAnswer: answer.trim(),
        }),
      });
      const data = await res.json();
      onSuccess(data.status, data.feedback, answer.trim());
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden">
        <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between"
          style={{ background: 'linear-gradient(135deg, #7B2FF7, #E8633B)' }}>
          <div>
            <div className="font-bold text-white text-base">Reattempt Q{question.number}</div>
            <div className="text-white/80 text-xs mt-0.5 line-clamp-1">{question.questionText}</div>
          </div>
          <button onClick={onClose} className="p-2 rounded-full bg-white/20 hover:bg-white/30 text-white">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="p-6">
          <div className="text-sm text-gray-600 mb-3 font-medium">Your answer:</div>
          <textarea
            value={answer}
            onChange={e => setAnswer(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && submit()}
            placeholder="Type your answer here..."
            rows={3}
            className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#7B2FF7] resize-none"
            autoFocus
          />
          <div className="flex gap-3 mt-4">
            <button onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-600 text-sm font-semibold hover:bg-gray-50">
              Cancel
            </button>
            <button
              onClick={submit}
              disabled={!answer.trim() || loading}
              className="flex-1 py-2.5 rounded-xl text-white text-sm font-semibold disabled:opacity-50"
              style={{ background: 'linear-gradient(135deg, #7B2FF7, #E8633B)' }}
            >
              {loading ? 'Checking...' : 'Submit'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── ReattemptResult ─────────────────────────────────────────────────────────
function ReattemptResult({
  status,
  feedback,
  onClose,
}: {
  status: EvaluatedQuestion['status'];
  feedback: string;
  onClose: () => void;
}) {
  const config = {
    correct: { icon: '🎉', color: '#22C55E', bg: '#F0FDF4', border: '#BBF7D0', label: 'Correct!' },
    partially_correct: { icon: '💪', color: '#F59E0B', bg: '#FFFBEB', border: '#FDE68A', label: 'Almost there!' },
    incorrect: { icon: '📚', color: '#EF4444', bg: '#FEF2F2', border: '#FECACA', label: 'Not quite' },
    unanswered: { icon: '○', color: '#9CA3AF', bg: '#F9FAFB', border: '#E5E7EB', label: 'No answer' },
  }[status];

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl w-full max-w-sm shadow-2xl text-center p-8">
        <div className="text-5xl mb-3">{config.icon}</div>
        <div className="font-bold text-xl mb-2" style={{ color: config.color }}>{config.label}</div>
        <div className="text-gray-600 text-sm mb-6">{feedback}</div>
        <button
          onClick={onClose}
          className="w-full py-3 rounded-xl text-white font-semibold"
          style={{ background: 'linear-gradient(135deg, #7B2FF7, #E8633B)' }}
        >
          Continue
        </button>
      </div>
    </div>
  );
}

// ─── AskVedChat ──────────────────────────────────────────────────────────────
function AskVedChat({
  sessionId, question, onClose, autoTrigger,
}: { sessionId: string; question: EvaluatedQuestion; onClose: () => void; autoTrigger?: boolean }) {
  const [messages, setMessages] = useState<ChatMessage[]>(() =>
    getChatMessages(sessionId).filter(
      m => (m as ChatMessage & { questionNum?: number }).questionNum === question.number
    )
  );
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const autoTriggered = useRef(false);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  useEffect(() => {
    if (autoTrigger && !autoTriggered.current && messages.length === 0) {
      autoTriggered.current = true;
      send(`Q${question.number}: ${question.questionText}`);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const send = async (text: string) => {
    if (!text.trim() || loading) return;
    const userMsg: ChatMessage = { id: Date.now().toString(), role: 'user', content: text, timestamp: new Date().toISOString() };
    const updated = [...messages, userMsg];
    setMessages(updated);
    addChatMessage(sessionId, { ...userMsg, questionNum: question.number } as never);
    setInput('');
    setLoading(true);
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          questionText: question.questionText,
          studentAnswer: question.studentAnswer,
          correctAnswer: question.correctAnswer,
          status: question.status,
          history: messages,
        }),
      });
      const data = await res.json();
      const botMsg: ChatMessage = { id: (Date.now() + 1).toString(), role: 'assistant', content: data.response, timestamp: new Date().toISOString() };
      const final = [...updated, botMsg];
      setMessages(final);
      addChatMessage(sessionId, { ...botMsg, questionNum: question.number } as never);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-end justify-center p-4">
      <div className="bg-white rounded-3xl w-full max-w-lg max-h-[70vh] flex flex-col shadow-2xl">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <div className="font-bold text-gray-900">Ask VED</div>
            <div className="text-xs text-gray-400">Q{question.number}: {question.questionText.slice(0, 50)}...</div>
          </div>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-100">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {messages.length === 0 && (
            <div className="text-center text-gray-400 text-sm py-6">Ask VED anything about this question!</div>
          )}
          {messages.map(m => (
            <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[80%] px-4 py-2.5 rounded-2xl text-sm ${m.role === 'user' ? 'text-white rounded-br-md' : 'bg-gray-100 text-gray-800 rounded-bl-md'}`}
                style={m.role === 'user' ? { background: 'linear-gradient(135deg, #7B2FF7, #E8633B)' } : {}}
              >
                {m.content}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="bg-gray-100 px-4 py-3 rounded-2xl rounded-bl-md flex gap-1">
                {[0, 1, 2].map(i => (
                  <div key={i} className="w-2 h-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: `${i * 150}ms` }} />
                ))}
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>
        <div className="p-3 border-t border-gray-100 flex gap-2">
          <input
            type="text" value={input} onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && send(input)}
            placeholder="Ask a question..."
            className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#E8633B]"
          />
          <button onClick={() => send(input)} disabled={!input.trim() || loading}
            className="px-4 py-2.5 rounded-xl text-white text-sm font-semibold disabled:opacity-50"
            style={{ background: 'linear-gradient(135deg, #7B2FF7, #E8633B)' }}>
            Send
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Object-contain coordinate transform ────────────────────────────────────
interface ImgTransform { offsetX: number; offsetY: number; scaleX: number; scaleY: number }

function getImgTransform(natW: number, natH: number, cw: number, ch: number): ImgTransform {
  if (!natW || !natH) return { offsetX: 0, offsetY: 0, scaleX: cw, scaleY: ch };
  const imgAspect = natW / natH;
  const canvasAspect = cw / ch;
  if (imgAspect > canvasAspect) {
    const displayH = cw / imgAspect;
    return { offsetX: 0, offsetY: (ch - displayH) / 2, scaleX: cw, scaleY: displayH };
  } else {
    const displayW = ch * imgAspect;
    return { offsetX: (cw - displayW) / 2, offsetY: 0, scaleX: displayW, scaleY: ch };
  }
}

// Convert canvas pixel position → image-fraction (for storing manual marks)
function canvasToImg(px: number, py: number, t: ImgTransform) {
  return { x: (px - t.offsetX) / t.scaleX, y: (py - t.offsetY) / t.scaleY };
}

// ─── Teacher mark drawing helpers ───────────────────────────────────────────
function drawMark(ctx: CanvasRenderingContext2D, mark: TeacherMark, t: ImgTransform, preview?: { x2: number; y2: number }) {
  // Convert image-fraction coords → canvas pixels via the letterbox transform
  const x  = t.offsetX + mark.x  * t.scaleX;
  const y  = t.offsetY + mark.y  * t.scaleY;
  const x2 = t.offsetX + (preview?.x2 ?? mark.x2 ?? mark.x) * t.scaleX;
  const y2 = t.offsetY + (preview?.y2 ?? mark.y2 ?? mark.y) * t.scaleY;
  const SIZE = Math.max(t.scaleX, t.scaleY) * 0.045;

  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  switch (mark.type) {
    case 'bbox': {
      const bColor = mark.color ?? '#9CA3AF';
      ctx.strokeStyle = bColor;
      ctx.lineWidth = 2;
      ctx.strokeRect(x, y, x2 - x, y2 - y);
      // Semi-transparent fill
      ctx.fillStyle = bColor + '18';
      ctx.fillRect(x, y, x2 - x, y2 - y);
      break;
    }
    case 'tick': {
      ctx.strokeStyle = '#16A34A';
      ctx.lineWidth = SIZE * 0.20;
      ctx.beginPath();
      ctx.moveTo(x - SIZE * 0.5, y);
      ctx.lineTo(x - SIZE * 0.1, y + SIZE * 0.45);
      ctx.lineTo(x + SIZE * 0.6, y - SIZE * 0.5);
      ctx.stroke();
      break;
    }
    case 'cross': {
      ctx.strokeStyle = '#DC2626';
      ctx.lineWidth = SIZE * 0.20;
      ctx.beginPath();
      ctx.moveTo(x - SIZE * 0.5, y - SIZE * 0.5);
      ctx.lineTo(x + SIZE * 0.5, y + SIZE * 0.5);
      ctx.moveTo(x + SIZE * 0.5, y - SIZE * 0.5);
      ctx.lineTo(x - SIZE * 0.5, y + SIZE * 0.5);
      ctx.stroke();
      break;
    }
    case 'circle': {
      const cColor = mark.color ?? '#F59E0B';
      ctx.strokeStyle = cColor;
      ctx.lineWidth = 3;
      const cx = (x + x2) / 2;
      const cy = (y + y2) / 2;
      // Use exact bbox dimensions when x2,y2 are provided by the LLM
      const hasExact = mark.x2 !== undefined && mark.y2 !== undefined;
      const rawRx = hasExact ? Math.abs(x2 - x) / 2 : SIZE * 0.6;
      const rawRy = hasExact ? Math.abs(y2 - y) / 2 : SIZE * 0.35;
      const rx = Math.max(rawRx, SIZE * 0.4);
      const ry = Math.max(rawRy, SIZE * 0.25);
      ctx.beginPath();
      ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
      ctx.stroke();
      break;
    }
    case 'underline': {
      ctx.strokeStyle = '#DC2626';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x2, y);
      ctx.stroke();
      // Wavy underline dots
      ctx.fillStyle = '#DC2626';
      const len = Math.abs(x2 - x);
      const step = 6;
      for (let i = 0; i < len; i += step * 2) {
        ctx.beginPath();
        ctx.arc(Math.min(x, x2) + i + step * 0.5, y + 3, 1, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    }
    case 'arrow': {
      ctx.strokeStyle = '#DC2626';
      ctx.fillStyle = '#DC2626';
      ctx.lineWidth = 2.5;
      // Line
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x2, y2);
      ctx.stroke();
      // Arrowhead
      const angle = Math.atan2(y2 - y, x2 - x);
      const headLen = SIZE * 0.5;
      ctx.beginPath();
      ctx.moveTo(x2, y2);
      ctx.lineTo(x2 - headLen * Math.cos(angle - 0.4), y2 - headLen * Math.sin(angle - 0.4));
      ctx.lineTo(x2 - headLen * Math.cos(angle + 0.4), y2 - headLen * Math.sin(angle + 0.4));
      ctx.closePath();
      ctx.fill();
      break;
    }
    case 'badge': {
      const badgeR = Math.max(14, Math.max(t.scaleX, t.scaleY) * 0.026);
      drawBadge(
        ctx, x, y,
        mark.status ?? 'unanswered',
        mark.marksAwarded ?? 0,
        mark.marksPossible ?? 1,
        badgeR,
      );
      break;
    }
    case 'quad': {
      const pts = mark.pts;
      if (!pts || pts.length < 4) {
        // fallback to axis-aligned rect
        const qColor = mark.color ?? '#9CA3AF';
        ctx.strokeStyle = qColor;
        ctx.lineWidth = 2;
        ctx.strokeRect(x, y, x2 - x, y2 - y);
        ctx.fillStyle = qColor + '18';
        ctx.fillRect(x, y, x2 - x, y2 - y);
        break;
      }
      const qColor = mark.color ?? '#9CA3AF';
      const canvasPts = pts.map(([fx, fy]) => [t.offsetX + fx * t.scaleX, t.offsetY + fy * t.scaleY]);
      ctx.strokeStyle = qColor;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(canvasPts[0][0], canvasPts[0][1]);
      for (let i = 1; i < 4; i++) ctx.lineTo(canvasPts[i][0], canvasPts[i][1]);
      ctx.closePath();
      ctx.stroke();
      ctx.fillStyle = qColor + '18';
      ctx.fill();
      break;
    }
  }
  ctx.restore();
}

// ─── Badge drawing helper ────────────────────────────────────────────────────
function drawBadge(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number,
  status: string,
  marksAwarded: number,
  marksPossible: number,
  r: number,
) {
  const colors: Record<string, string> = {
    correct: '#16A34A',
    incorrect: '#DC2626',
    partially_correct: '#F59E0B',
    unanswered: '#6B7280',
  };
  const symbols: Record<string, string> = {
    correct: '✓',
    incorrect: '✗',
    partially_correct: '~',
    unanswered: '—',
  };
  const color = colors[status] ?? '#6B7280';
  const symbol = symbols[status] ?? '—';

  ctx.save();

  // Shadow
  ctx.shadowColor = 'rgba(0,0,0,0.25)';
  ctx.shadowBlur = 6;
  ctx.shadowOffsetY = 2;

  // Circle fill
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();

  ctx.shadowColor = 'transparent';

  // Symbol
  const symSize = Math.max(r * 0.85, 9);
  ctx.font = `bold ${symSize}px -apple-system, BlinkMacSystemFont, sans-serif`;
  ctx.fillStyle = 'white';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(symbol, cx, cy);

  // Score text below badge
  const scoreSize = Math.max(r * 0.6, 7);
  ctx.font = `600 ${scoreSize}px -apple-system, BlinkMacSystemFont, sans-serif`;
  ctx.fillStyle = color;
  ctx.fillText(`${marksAwarded}/${marksPossible}`, cx, cy + r + scoreSize * 0.9);

  ctx.restore();
}

// ─── Callout drawing helper ──────────────────────────────────────────────────
function drawCallout(
  ctx: CanvasRenderingContext2D,
  t: ImgTransform,
  bbox: AutoMark,
  text: string,
  icon: string,
  iconColor: string,
) {
  // Callout anchor: 38% down from bbox top, left-aligned inside bbox
  const bx1 = t.offsetX + bbox.x  * t.scaleX;
  const by1 = t.offsetY + bbox.y  * t.scaleY;
  const bx2 = t.offsetX + (bbox.x2 ?? bbox.x) * t.scaleX;
  const by2 = t.offsetY + (bbox.y2 ?? bbox.y) * t.scaleY;
  const bW = bx2 - bx1;
  const bH = by2 - by1;

  const maxW = bW * 0.55;
  const fontSize = Math.max(10, Math.min(13, bH * 0.08));
  const pad = fontSize * 0.7;
  const lineH = fontSize * 1.35;

  ctx.save();
  ctx.font = `600 ${fontSize}px -apple-system, BlinkMacSystemFont, sans-serif`;

  // Word-wrap text to maxW - icon space
  const iconW = fontSize * 1.2;
  const textMaxW = maxW - iconW - pad * 2.5;
  const words = text.split(' ');
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const test = current ? `${current} ${word}` : word;
    if (ctx.measureText(test).width > textMaxW && current) {
      lines.push(current);
      current = word;
    } else {
      current = test;
    }
  }
  if (current) lines.push(current);

  const boxW = maxW;
  const boxH = pad * 2 + lines.length * lineH;
  const bxPos = bx1 + bW * 0.03;
  const byPos = by1 + bH * 0.38;
  const r = fontSize * 0.6;

  // Rounded rect background
  ctx.beginPath();
  ctx.moveTo(bxPos + r, byPos);
  ctx.lineTo(bxPos + boxW - r, byPos);
  ctx.arcTo(bxPos + boxW, byPos, bxPos + boxW, byPos + r, r);
  ctx.lineTo(bxPos + boxW, byPos + boxH - r);
  ctx.arcTo(bxPos + boxW, byPos + boxH, bxPos + boxW - r, byPos + boxH, r);
  ctx.lineTo(bxPos + r, byPos + boxH);
  ctx.arcTo(bxPos, byPos + boxH, bxPos, byPos + boxH - r, r);
  ctx.lineTo(bxPos, byPos + r);
  ctx.arcTo(bxPos, byPos, bxPos + r, byPos, r);
  ctx.closePath();
  ctx.fillStyle = 'rgba(20,20,20,0.86)';
  ctx.fill();

  // Icon
  ctx.font = `bold ${fontSize}px -apple-system, BlinkMacSystemFont, sans-serif`;
  ctx.fillStyle = iconColor;
  ctx.fillText(icon, bxPos + pad, byPos + pad + fontSize * 0.85);

  // Text lines
  ctx.font = `500 ${fontSize}px -apple-system, BlinkMacSystemFont, sans-serif`;
  ctx.fillStyle = '#FFFFFF';
  for (let i = 0; i < lines.length; i++) {
    ctx.fillText(lines[i], bxPos + pad + iconW, byPos + pad + fontSize * 0.85 + i * lineH);
  }
  ctx.restore();
}

// ─── AnnotationCanvas ────────────────────────────────────────────────────────
function AnnotationCanvas({
  sessionId, containerRef, autoMarks, showToolbar, naturalW, naturalH, activeQ, onQuestionClick, showFeedback, questions,
}: {
  sessionId: string;
  containerRef: React.RefObject<HTMLDivElement | null>;
  autoMarks: AutoMark[];
  showToolbar: boolean;
  naturalW: number;
  naturalH: number;
  activeQ?: number;
  onQuestionClick?: (index: number) => void;
  showFeedback?: boolean;
  questions?: EvaluatedQuestion[];
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [marks, setMarks] = useState<TeacherMark[]>(() => getAnnotations(sessionId));
  const [tool, setTool] = useState<MarkType>('tick');
  const dragStart = useRef<{ imgX: number; imgY: number } | null>(null);
  const [, setDragPreview] = useState<null | { x2: number; y2: number }>(null);

  const isDrag = tool === 'circle' || tool === 'underline' || tool === 'arrow';

  const getTransform = useCallback((): ImgTransform => {
    const canvas = canvasRef.current;
    if (!canvas) return { offsetX: 0, offsetY: 0, scaleX: 1, scaleY: 1 };
    return getImgTransform(naturalW, naturalH, canvas.width, canvas.height);
  }, [naturalW, naturalH]);

  const redraw = useCallback((markList: TeacherMark[], previewEnd?: { imgX2: number; imgY2: number } | null) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const t = getImgTransform(naturalW, naturalH, canvas.width, canvas.height);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    // LLM auto-marks (base layer) — highlight the active question's bbox
    let bboxIdx = 0;
    for (const m of autoMarks) {
      if (m.type === 'bbox' || m.type === 'quad') {
        const isActive = activeQ !== undefined && bboxIdx === activeQ;
        if (isActive) {
          // Draw highlighted version
          const bColor = m.color ?? '#9CA3AF';
          ctx.save();
          ctx.strokeStyle = bColor;
          ctx.lineWidth = 4;
          if (m.type === 'quad' && m.pts && m.pts.length >= 4) {
            const canvasPts = m.pts.map(([fx, fy]) => [t.offsetX + fx * t.scaleX, t.offsetY + fy * t.scaleY]);
            ctx.beginPath();
            ctx.moveTo(canvasPts[0][0], canvasPts[0][1]);
            for (let i = 1; i < 4; i++) ctx.lineTo(canvasPts[i][0], canvasPts[i][1]);
            ctx.closePath();
            ctx.stroke();
            ctx.fillStyle = bColor + '35';
            ctx.fill();
          } else {
            const x  = t.offsetX + m.x  * t.scaleX;
            const y  = t.offsetY + m.y  * t.scaleY;
            const x2 = t.offsetX + (m.x2 ?? m.x) * t.scaleX;
            const y2 = t.offsetY + (m.y2 ?? m.y) * t.scaleY;
            ctx.strokeRect(x, y, x2 - x, y2 - y);
            ctx.fillStyle = bColor + '35';
            ctx.fillRect(x, y, x2 - x, y2 - y);
          }
          ctx.restore();
        } else {
          drawMark(ctx, { id: 'auto', ...m }, t);
        }
        bboxIdx++;
      } else {
        drawMark(ctx, { id: 'auto', ...m }, t);
      }
    }
    // Manual marks on top
    for (const m of markList) drawMark(ctx, m, t);
    // Feedback callouts
    if (showFeedback && questions?.length) {
      const bboxes = autoMarks.filter(m => m.type === 'bbox' || m.type === 'quad');
      bboxes.forEach((bbox, i) => {
        const q = questions[i];
        if (!q) return;
        // For quad marks, synthesize x/y/x2/y2 from pts centroid bounding box
        let calloutBbox = bbox;
        if (bbox.type === 'quad' && bbox.pts && bbox.pts.length >= 4) {
          const xs = bbox.pts.map(p => p[0]);
          const ys = bbox.pts.map(p => p[1]);
          calloutBbox = { ...bbox, x: Math.min(...xs), y: Math.min(...ys), x2: Math.max(...xs), y2: Math.max(...ys) };
        }
        const isCorrect = q.status === 'correct';
        const text = isCorrect
          ? (q.vedInsight || q.feedback || 'Great job!')
          : (q.feedback || q.vedInsight || 'Check the correct answer.');
        const icon = isCorrect ? '✓' : '✗';
        const iconColor = isCorrect ? '#4ADE80' : '#FCA5A5';
        drawCallout(ctx, t, calloutBbox, text, icon, iconColor);
      });
    }
    // Live drag preview
    if (previewEnd && dragStart.current) {
      drawMark(ctx, {
        id: 'preview', type: tool,
        x: dragStart.current.imgX, y: dragStart.current.imgY,
      }, t, { x2: previewEnd.imgX2, y2: previewEnd.imgY2 });
    }
  }, [tool, autoMarks, naturalW, naturalH, activeQ, showFeedback, questions]);

  useEffect(() => {
    const resize = () => {
      const canvas = canvasRef.current;
      const container = containerRef.current;
      if (!canvas || !container) return;
      canvas.width = container.clientWidth;
      canvas.height = container.clientHeight;
      redraw(marks);
    };
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, [marks, redraw, containerRef]);

  const getImgPos = (e: React.PointerEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { imgX: 0, imgY: 0 };
    const rect = canvas.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;
    const t = getTransform();
    const { x, y } = canvasToImg(px, py, t);
    return { imgX: x, imgY: y };
  };

  // Click on bbox/quad when not in toolbar mode — find which question was clicked
  const onBboxClick = useCallback((e: React.PointerEvent) => {
    if (!onQuestionClick) return;
    const pos = getImgPos(e);
    const bboxes = autoMarks.filter(m => m.type === 'bbox' || m.type === 'quad');
    for (let i = 0; i < bboxes.length; i++) {
      const m = bboxes[i];
      if (m.type === 'quad' && m.pts && m.pts.length >= 4) {
        // Point-in-polygon (ray casting)
        const pts = m.pts;
        let inside = false;
        for (let j = 0, k = 3; j < 4; k = j++) {
          const xi = pts[j][0], yi = pts[j][1];
          const xk = pts[k][0], yk = pts[k][1];
          if ((yi > pos.imgY) !== (yk > pos.imgY) &&
              pos.imgX < ((xk - xi) * (pos.imgY - yi)) / (yk - yi) + xi) {
            inside = !inside;
          }
        }
        if (inside) { onQuestionClick(i); return; }
      } else {
        const x1 = m.x, y1 = m.y, x2 = m.x2 ?? m.x, y2 = m.y2 ?? m.y;
        if (pos.imgX >= x1 && pos.imgX <= x2 && pos.imgY >= y1 && pos.imgY <= y2) {
          onQuestionClick(i);
          return;
        }
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onQuestionClick, autoMarks]);

  const onPointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    const pos = getImgPos(e);
    if (!isDrag) {
      const mark: TeacherMark = { id: Date.now().toString(), type: tool, x: pos.imgX, y: pos.imgY };
      const updated = [...marks, mark];
      setMarks(updated);
      saveAnnotations(sessionId, updated);
      redraw(updated);
    } else {
      dragStart.current = pos;
    }
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!isDrag || !dragStart.current) return;
    const pos = getImgPos(e);
    setDragPreview({ x2: pos.imgX, y2: pos.imgY });
    redraw(marks, { imgX2: pos.imgX, imgY2: pos.imgY });
  };

  const onPointerUp = (e: React.PointerEvent) => {
    if (!isDrag || !dragStart.current) return;
    const pos = getImgPos(e);
    const mark: TeacherMark = {
      id: Date.now().toString(), type: tool,
      x: dragStart.current.imgX, y: dragStart.current.imgY,
      x2: pos.imgX, y2: pos.imgY,
    };
    const updated = [...marks, mark];
    setMarks(updated);
    saveAnnotations(sessionId, updated);
    dragStart.current = null;
    setDragPreview(null);
    redraw(updated);
  };

  const undo = () => {
    const updated = marks.slice(0, -1);
    setMarks(updated);
    saveAnnotations(sessionId, updated);
    redraw(updated);
  };

  const clear = () => {
    setMarks([]);
    saveAnnotations(sessionId, []);
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (ctx && canvas) ctx.clearRect(0, 0, canvas.width, canvas.height);
  };

  const TOOLS: { type: MarkType; label: string; color: string; hint: string }[] = [
    { type: 'tick',      label: '✓',  color: '#16A34A', hint: 'Tick – correct' },
    { type: 'cross',     label: '✗',  color: '#DC2626', hint: 'Cross – wrong' },
    { type: 'circle',    label: '○',  color: '#DC2626', hint: 'Circle – drag to encircle error' },
    { type: 'underline', label: '▁',  color: '#DC2626', hint: 'Underline – drag to underline' },
    { type: 'arrow',     label: '↗',  color: '#DC2626', hint: 'Arrow – drag to point' },
  ];

  return (
    <>
      {/* Teacher toolbar — only when in manual-annotate mode */}
      {showToolbar && (
        <>
          <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1 bg-white/97 backdrop-blur rounded-2xl px-3 py-2 shadow-lg border border-gray-100">
            {TOOLS.map(({ type, label, color, hint }) => (
              <button
                key={type}
                onClick={() => setTool(type)}
                title={hint}
                className="w-9 h-9 rounded-xl text-base font-bold flex items-center justify-center transition-all border-2"
                style={tool === type
                  ? { backgroundColor: color, color: 'white', borderColor: color }
                  : { backgroundColor: '#f9fafb', color, borderColor: 'transparent' }}
              >
                {label}
              </button>
            ))}
            <div className="w-px h-5 bg-gray-200 mx-1" />
            <button onClick={undo} disabled={marks.length === 0} title="Undo"
              className="w-8 h-8 rounded-xl bg-gray-100 flex items-center justify-center text-gray-500 hover:bg-gray-200 disabled:opacity-30 text-sm font-bold">
              ↩
            </button>
            <button onClick={clear} disabled={marks.length === 0} title="Clear manual marks"
              className="w-8 h-8 rounded-xl bg-gray-100 flex items-center justify-center text-gray-500 hover:bg-red-100 hover:text-red-500 disabled:opacity-30 text-sm">
              🗑
            </button>
          </div>
          <div className="absolute bottom-14 left-1/2 -translate-x-1/2 z-20 text-xs bg-black/60 text-white px-3 py-1 rounded-full pointer-events-none">
            {TOOLS.find(t => t.type === tool)?.hint}
          </div>
        </>
      )}

      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full"
        style={{
          cursor: showToolbar ? (isDrag ? 'crosshair' : 'default') : (onQuestionClick ? 'pointer' : 'default'),
          touchAction: 'none',
          zIndex: 10,
          pointerEvents: (showToolbar || onQuestionClick) ? 'auto' : 'none',
        }}
        onPointerDown={showToolbar ? onPointerDown : (onQuestionClick ? onBboxClick : undefined)}
        onPointerMove={showToolbar ? onPointerMove : undefined}
        onPointerUp={showToolbar ? onPointerUp : undefined}
        onPointerLeave={showToolbar ? onPointerUp : undefined}
      />
    </>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────
export default function EvaluatePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [session, setSession] = useState<EvaluationSession | null>(null);
  const [activeQ, setActiveQ] = useState(0);
  const [showChat, setShowChat] = useState(false);
  const [showVedChat, setShowVedChat] = useState(false);
  const [annotating, setAnnotating] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);
  const [reattemptQ, setReattemptQ] = useState<EvaluatedQuestion | null>(null);
  const [reattemptResult, setReattemptResult] = useState<{ status: EvaluatedQuestion['status']; feedback: string } | null>(null);
  const [showScanAgain, setShowScanAgain] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [imgNatural, setImgNatural] = useState({ w: 0, h: 0 });
  const imageContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const s = getSession(id);
    if (!s) return;
    setSession(s);

    // Fetch if no marks, old format (no bbox), or bbox count doesn't match questions (small bbox = answer-only old format)
    const bboxCount = s.autoMarks?.filter(m => m.type === 'bbox' || m.type === 'quad').length ?? 0;
    const hasQuad = s.autoMarks?.some(m => m.type === 'quad') ?? false;
    // Re-annotate if: no marks, count mismatch, or old bbox-only format (no quad polygons yet)
    const needsAnnotate = !s.autoMarks || s.autoMarks.length === 0 || bboxCount !== s.result.questions.length || !hasQuad;
    if (needsAnnotate) {
      const base64 = s.imageDataUrl.split(',')[1];
      const mimeType = s.imageDataUrl.split(';')[0].split(':')[1];
      fetch('/api/annotate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: base64, mimeType, questions: s.result.questions }),
      })
        .then(r => r.json())
        .then(data => {
          const marks: AutoMark[] = data.marks ?? [];
          if (marks.length > 0) {
            saveSession({ ...s, autoMarks: marks });
            setSession(prev => prev ? { ...prev, autoMarks: marks } : prev);
          }
        })
        .catch(() => {});
    }
  }, [id]);

  // Reload session after question update
  const refreshSession = () => {
    const s = getSession(id);
    if (s) setSession({ ...s });
  };

  const handleReattemptSuccess = (status: EvaluatedQuestion['status'], feedback: string, answer: string) => {
    setReattemptQ(null);
    updateQuestion(id, activeQ, { status, studentAnswer: answer, feedback });
    refreshSession();
    setReattemptResult({ status, feedback });
  };

  const handleScanAgain = async (imageDataUrl: string) => {
    setShowScanAgain(false);
    setIsProcessing(true);
    try {
      const base64 = imageDataUrl.split(',')[1];
      const mimeType = imageDataUrl.split(';')[0].split(':')[1];
      const res = await fetch('/api/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: base64, mimeType }),
      });
      const data = await res.json();
      const result: EvaluationResult = {
        worksheetTitle: data.worksheetTitle,
        subject: data.subject,
        chapter: data.chapter,
        topic: data.topic,
        questions: data.questions,
      };
      let autoMarks: AutoMark[] = [];
      try {
        const ar = await fetch('/api/annotate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ imageBase64: base64, mimeType, questions: result.questions }),
        });
        autoMarks = (await ar.json()).marks ?? [];
      } catch { /* optional */ }
      const newSessionId = crypto.randomUUID();
      saveSession({ id: newSessionId, imageDataUrl, result, timestamp: new Date().toISOString(), autoMarks });
      router.push(`/evaluate/${newSessionId}`);
    } catch (err) {
      console.error(err);
      setIsProcessing(false);
    }
  };

  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #7B2FF7, #E8633B)' }}>
        <div className="bg-white rounded-3xl p-10 text-center">
          <div className="text-4xl mb-4 animate-bounce">🤖</div>
          <p className="text-gray-600">Loading your evaluation...</p>
        </div>
      </div>
    );
  }

  const { result, imageDataUrl } = session;
  const questions = result.questions;
  const q = questions[activeQ];

  const statusMsg = {
    correct: 'Nice work 👋 You got it right!',
    incorrect: "Let's learn from this 📚",
    partially_correct: 'Almost there! 💪',
    unanswered: 'No answer was recorded.',
  }[q.status];

  const correctCount = questions.filter(q => q.status === 'correct').length;
  const accuracy = Math.round((correctCount / questions.length) * 100);

  const qStatusColor = {
    correct: '#22C55E',
    incorrect: '#EF4444',
    partially_correct: '#F59E0B',
    unanswered: '#9CA3AF',
  }[q.status];

  return (
    <div className="h-screen overflow-hidden flex flex-col" style={{ background: '#111827' }}>
      {/* Header */}
      <div className="px-4 py-3 flex items-center justify-between shrink-0">
        <button onClick={() => router.push('/')}
          className="flex items-center gap-1.5 text-white/90 hover:text-white font-semibold text-sm">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <polyline points="15,18 9,12 15,6" />
          </svg>
        </button>

        <div className="text-center text-white">
          <div className="font-bold text-sm">{result.worksheetTitle}</div>
          <div className="text-xs text-white/60">{result.subject} • {result.chapter}</div>
        </div>

        <div className="flex items-center gap-2">
          <button onClick={() => setShowScanAgain(true)}
            className="text-white/70 hover:text-white p-1">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
              <circle cx="12" cy="13" r="4" />
            </svg>
          </button>
          <button onClick={() => router.push('/')}
            className="text-white/70 hover:text-white text-xs font-semibold bg-white/10 px-3 py-1.5 rounded-full">
            Done
          </button>
        </div>
      </div>

      {/* Sub-header: label + Show Feedback */}
      <div className="px-4 pb-2 flex items-center justify-between shrink-0">
        <span className="text-white/50 text-xs font-bold tracking-widest uppercase">Annotated Worksheet</span>
        <button
          onClick={() => setShowFeedback(f => !f)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all"
          style={showFeedback
            ? { background: '#F59E0B', color: 'white', borderColor: '#F59E0B' }
            : { background: 'transparent', color: 'white', borderColor: 'rgba(255,255,255,0.3)' }}
        >
          💬 {showFeedback ? 'Hide Feedback' : 'Show Feedback'}
        </button>
      </div>

      {/* Worksheet image — fills remaining height above tabs */}
      <div className="flex-1 min-h-0 px-3 pb-1 flex flex-col relative">
        {/* Score overlay — top-right, outside the canvas coord system */}
        <div className="absolute top-3 right-5 z-20 bg-white rounded-2xl px-4 py-2.5 shadow-xl min-w-[110px]">
          <div className="font-bold text-gray-900 text-sm">Score: {correctCount}/{questions.length}</div>
          <div className="font-bold text-sm mt-0.5" style={{ color: accuracy >= 70 ? '#22C55E' : accuracy >= 40 ? '#F59E0B' : '#EF4444' }}>
            {accuracy}%
          </div>
          <div className="w-full bg-gray-100 rounded-full h-1.5 mt-1.5">
            <div className="h-1.5 rounded-full transition-all"
              style={{ width: `${accuracy}%`, background: accuracy >= 70 ? '#22C55E' : accuracy >= 40 ? '#F59E0B' : '#EF4444' }} />
          </div>
        </div>

        {/* Inner container — canvas and image share the same coordinate space */}
        <div className="flex-1 relative min-h-0" ref={imageContainerRef}>
          <img
            src={imageDataUrl}
            alt="Worksheet"
            className="absolute inset-0 w-full h-full object-contain"
            style={{ pointerEvents: 'none' }}
            onLoad={e => {
              const img = e.currentTarget;
              setImgNatural({ w: img.naturalWidth, h: img.naturalHeight });
            }}
          />
          <AnnotationCanvas
            sessionId={id}
            containerRef={imageContainerRef}
            autoMarks={session.autoMarks ?? []}
            showToolbar={annotating}
            naturalW={imgNatural.w}
            naturalH={imgNatural.h}
            activeQ={activeQ}
            onQuestionClick={i => { setActiveQ(i); setShowChat(false); }}
            showFeedback={showFeedback}
            questions={questions}
          />
        </div>
      </div>

      {/* Q tabs — bottom bar */}
      <div className="px-4 py-3 flex items-center justify-center gap-2.5 shrink-0">
        {questions.map((qq, i) => {
          const dotColor = {
            correct: '#22C55E', incorrect: '#EF4444',
            partially_correct: '#F59E0B', unanswered: '#9CA3AF',
          }[qq.status];
          return (
            <button
              key={i}
              onClick={() => { setActiveQ(i); setShowChat(true); }}
              className="w-10 h-10 rounded-full text-sm font-bold transition-all relative"
              style={i === activeQ
                ? { background: '#F59E0B', color: 'white' }
                : { background: 'rgba(255,255,255,0.15)', color: 'white' }}
            >
              {qq.number}
              <span className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-gray-900"
                style={{ backgroundColor: dotColor }} />
            </button>
          );
        })}
      </div>

      {/* Q detail bottom drawer */}
      {showChat && q && (
        <div className="absolute inset-x-0 bottom-0 z-30 bg-white rounded-t-3xl shadow-2xl flex flex-col"
          style={{ maxHeight: '65vh' }}>
          {/* Drawer handle + close */}
          <div className="flex items-center justify-between px-5 pt-4 pb-2 shrink-0">
            <div className="flex items-center gap-2">
              <StatusIcon status={q.status} />
              <span className="font-bold text-gray-900 text-sm">Question {q.number}</span>
            </div>
            <button onClick={() => setShowChat(false)} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
          </div>

          <div className="flex-1 overflow-y-auto px-5 pb-4">
            <p className="text-gray-700 text-sm mb-3 leading-relaxed">{q.questionText}</p>

            {/* Status banner */}
            <div className="rounded-2xl p-3 mb-3 flex items-center gap-3"
              style={{ backgroundColor: `${qStatusColor}15`, border: `1px solid ${qStatusColor}30` }}>
              <div className="flex-1 min-w-0">
                <div className="font-bold text-sm text-gray-900">{statusMsg}</div>
                {q.studentAnswer && (
                  <div className="text-xs text-gray-500 mt-0.5">
                    Your answer: <span className="font-medium text-gray-700">{q.studentAnswer}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Correct answer */}
            <div className="rounded-2xl p-3 mb-3 bg-green-50 border border-green-100">
              <div className="text-xs font-semibold text-green-700 mb-1">✅ Correct Answer</div>
              <div className="font-bold text-gray-900 text-sm">{q.correctAnswer}</div>
            </div>

            {/* VED Insight */}
            <div className="rounded-2xl p-3 mb-3"
              style={{ background: 'linear-gradient(180deg, #FFF0EB 0%, #FDDDE6 100%)', border: '1px solid rgba(232,99,59,0.25)' }}>
              <div className="flex items-center gap-1.5 mb-1">
                <span>🧠</span>
                <span className="font-bold text-xs" style={{ color: '#E8633B' }}>VED Insight</span>
              </div>
              <p className="text-gray-700 text-sm italic">"{q.vedInsight}"</p>
            </div>

            {/* Feedback */}
            <div className="rounded-2xl p-3 mb-3 bg-gray-50 border border-gray-100">
              <div className="font-semibold text-gray-700 text-xs mb-1">💬 Feedback</div>
              <p className="text-gray-600 text-sm">{q.feedback}</p>
            </div>

            <StepByStep steps={q.steps} />
          </div>

          {/* Action buttons */}
          <div className="px-5 py-3 border-t border-gray-100 flex gap-2 shrink-0">
            {q.status !== 'correct' && (
              <button onClick={() => setReattemptQ(q)}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-full text-sm font-semibold border-2"
                style={{ borderColor: '#7B2FF7', color: '#7B2FF7' }}>
                🔄 Reattempt
              </button>
            )}
            <button
              onClick={() => { setShowChat(false); setShowVedChat(true); }}
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-full text-white font-semibold text-sm"
              style={{ background: 'linear-gradient(135deg, #7B2FF7, #E8633B)' }}>
              🤖 Ask VED
            </button>
          </div>
        </div>
      )}


      {/* Overlays */}
      {showVedChat && q && <AskVedChat key={q.number} sessionId={id} question={q} onClose={() => setShowVedChat(false)} autoTrigger />}
      {reattemptQ && (
        <ReattemptModal question={reattemptQ} onClose={() => setReattemptQ(null)} onSuccess={handleReattemptSuccess} />
      )}
      {reattemptResult && (
        <ReattemptResult
          status={reattemptResult.status}
          feedback={reattemptResult.feedback}
          onClose={() => setReattemptResult(null)}
        />
      )}
      {showScanAgain && (
        <CaptureModal onCapture={handleScanAgain} onCancel={() => setShowScanAgain(false)} />
      )}
      {isProcessing && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center">
          <div className="bg-white rounded-3xl p-10 text-center max-w-sm mx-4">
            <div className="text-5xl mb-4 animate-bounce">🤖</div>
            <h3 className="text-xl font-bold text-gray-900">VED is analysing...</h3>
            <p className="text-gray-400 text-sm mt-2">Reading your new worksheet</p>
            <div className="mt-6 flex justify-center gap-1">
              {[0, 1, 2].map(i => (
                <div key={i} className="w-2.5 h-2.5 rounded-full bg-orange-400 animate-bounce"
                  style={{ animationDelay: `${i * 150}ms` }} />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
