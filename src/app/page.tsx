'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getRecentSessions, saveSession } from '@/lib/store';
import { EvaluationResult, RecentWorksheet } from '@/types';
import CaptureModal from '@/components/CaptureModal';

const SUBJECTS = [
  {
    name: 'Physics',
    icon: '🧪',
    bgFrom: '#E3F2FD',
    bgTo: '#BBDEFB',
    color: '#2196F3',
    chapter: 'Ch 8 | Force and Laws',
    progress: 80,
    started: true,
  },
  {
    name: 'Chemistry',
    icon: '⚛️',
    bgFrom: '#F3E5F5',
    bgTo: '#E1BEE7',
    color: '#9C27B0',
    chapter: 'Ch 3 | Carbon Compounds',
    progress: 43,
    started: true,
  },
  {
    name: 'Mathematics',
    icon: '📐',
    bgFrom: '#E8F5E9',
    bgTo: '#C8E6C9',
    color: '#4CAF50',
    chapter: '9 Chapters',
    progress: 0,
    started: false,
  },
];

function ProgressBar({ value, color = '#22c55e' }: { value: number; color?: string }) {
  return (
    <div className="w-full h-1.5 bg-gray-200 rounded-full overflow-hidden">
      <div
        className="h-full rounded-full transition-all"
        style={{ width: `${value}%`, backgroundColor: color }}
      />
    </div>
  );
}

export default function Home() {
  const router = useRouter();
  const [showCapture, setShowCapture] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [recent, setRecent] = useState<RecentWorksheet[]>([]);

  useEffect(() => {
    setRecent(getRecentSessions(4));
  }, []);

  const handleCapture = async (imageDataUrl: string) => {
    setShowCapture(false);
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

      // Auto-annotate: ask Gemini to place correction marks on the image
      let autoMarks: import('@/types').AutoMark[] = [];
      try {
        const annotateRes = await fetch('/api/annotate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ questions: result.questions }),
        });
        const annotateData = await annotateRes.json();
        autoMarks = annotateData.marks ?? [];
      } catch {
        // Annotations optional — don't block navigation
      }

      const sessionId = crypto.randomUUID();
      saveSession({ id: sessionId, imageDataUrl, result, timestamp: new Date().toISOString(), autoMarks });
      router.push(`/evaluate/${sessionId}`);
    } catch (err) {
      console.error(err);
      setIsProcessing(false);
    }
  };

  const subjectColors: Record<string, string> = {
    Mathematics: '#4CAF50',
    Maths: '#4CAF50',
    Physics: '#2196F3',
    Chemistry: '#9C27B0',
    Biology: '#FF9800',
    Science: '#2196F3',
  };

  return (
    <div className="min-h-screen bg-[#1A2332] flex items-start justify-center p-4 py-8">
      <div className="bg-white rounded-3xl w-full max-w-4xl overflow-hidden shadow-2xl relative">
        {/* Header */}
        <div className="px-8 pt-8 pb-0">
          <div className="flex items-start justify-between">
            <div>
              <button className="flex items-center gap-1.5 text-sm text-gray-500 mb-4 hover:text-gray-700">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12,8 8,12 12,16" />
                  <line x1="16" y1="12" x2="8" y2="12" />
                </svg>
                Back
              </button>
              <h1 className="text-3xl font-bold text-gray-900">Worksheets</h1>
              <p className="text-gray-400 text-sm mt-1 max-w-xs">
                Take a photo of your homework or textbook problem and VED will help you solve it step-by-step.
              </p>
            </div>
            {/* Decorative illustration */}
            <div className="text-7xl select-none mt-2">📋</div>
          </div>
        </div>

        {/* Subject cards */}
        <div className="px-8 pt-6 grid grid-cols-3 gap-4">
          {SUBJECTS.map(s => (
            <button
              key={s.name}
              onClick={() => router.push(`/subject/${s.name.toLowerCase()}`)}
              className="rounded-2xl p-5 text-left hover:shadow-md transition-shadow"
              style={{ background: `linear-gradient(135deg, ${s.bgFrom}, ${s.bgTo})` }}
            >
              <div className="text-4xl mb-3">{s.icon}</div>
              <div className="font-bold text-gray-900 text-lg">{s.name}</div>
              <div className="text-xs text-gray-500 mt-0.5 mb-3">{s.chapter}</div>
              {s.started && (
                <>
                  <div className="text-xs text-gray-600 mb-1">{s.progress}%</div>
                  <ProgressBar value={s.progress} />
                </>
              )}
              <div
                className="mt-3 w-full py-2 rounded-xl text-sm font-semibold text-center transition-colors"
                style={{
                  backgroundColor: s.started ? 'transparent' : s.color,
                  color: s.started ? '#374151' : '#ffffff',
                  border: s.started ? '1px solid #D0D0DD' : 'none',
                }}
              >
                {s.started ? 'Continue →' : 'Start Learning →'}
              </div>
            </button>
          ))}
        </div>

        {/* Recent Worksheets */}
        <div className="px-8 py-6">
          <h2 className="font-bold text-gray-900 text-lg mb-4">Recent Worksheets</h2>
          {recent.length === 0 ? (
            <div className="text-center py-8 text-gray-400 text-sm border-2 border-dashed border-gray-200 rounded-2xl">
              No worksheets yet. Tap <strong>Scan Worksheet</strong> to evaluate your first one!
            </div>
          ) : (
            <div className="grid grid-cols-4 gap-3">
              {recent.map(ws => (
                <button
                  key={ws.id}
                  onClick={() => router.push(`/evaluate/${ws.id}`)}
                  className="rounded-2xl border border-gray-100 p-4 text-left hover:shadow-md transition-shadow bg-white"
                >
                  <span
                    className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                    style={{
                      backgroundColor: `${subjectColors[ws.subject] || '#6b7280'}20`,
                      color: subjectColors[ws.subject] || '#6b7280',
                    }}
                  >
                    {ws.subject}
                  </span>
                  <div className="font-semibold text-gray-900 text-sm mt-2 leading-tight line-clamp-2">
                    {ws.title}
                  </div>
                  <div className="flex items-center gap-1 mt-2 text-xs text-amber-600">
                    <span>⚠️</span>
                    <span>Worksheet: {ws.scored}/{ws.total}</span>
                  </div>
                  <ProgressBar
                    value={ws.total > 0 ? (ws.scored / ws.total) * 100 : 0}
                    color={ws.scored / ws.total >= 0.7 ? '#22c55e' : '#f59e0b'}
                  />
                  <div className="mt-3 w-full py-1.5 bg-gray-900 text-white text-xs font-semibold rounded-lg text-center">
                    Continue
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Scan Worksheet FAB */}
        <div className="px-8 pb-8 flex justify-end">
          <button
            onClick={() => setShowCapture(true)}
            className="flex items-center gap-2.5 px-6 py-3 rounded-full text-white font-semibold shadow-lg hover:shadow-xl transition-all hover:scale-105"
            style={{ background: 'linear-gradient(135deg, #E8633B, #C94E2A)', boxShadow: '0 4px 20px rgba(232,99,59,0.35)' }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
              <circle cx="12" cy="13" r="4" />
            </svg>
            Scan Worksheet
          </button>
        </div>
      </div>

      {/* Capture modal */}
      {showCapture && (
        <CaptureModal onCapture={handleCapture} onCancel={() => setShowCapture(false)} />
      )}

      {/* Processing overlay */}
      {isProcessing && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center">
          <div className="bg-white rounded-3xl p-10 text-center max-w-sm mx-4">
            <div className="text-5xl mb-4 animate-bounce">🤖</div>
            <h3 className="text-xl font-bold text-gray-900">VED is analysing...</h3>
            <p className="text-gray-400 text-sm mt-2">
              Reading your worksheet and evaluating answers
            </p>
            <div className="mt-6 flex justify-center gap-1">
              {[0, 1, 2].map(i => (
                <div
                  key={i}
                  className="w-2.5 h-2.5 rounded-full bg-orange-400 animate-bounce"
                  style={{ animationDelay: `${i * 150}ms` }}
                />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
