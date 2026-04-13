'use client';

import { use } from 'react';
import { useRouter } from 'next/navigation';

const CHAPTERS: Record<string, { name: string; topic: string; status: 'completed' | 'in_progress' | 'not_started'; worksheets: number; score: number }[]> = {
  mathematics: [
    { name: 'Real Numbers', topic: '', status: 'completed', worksheets: 8, score: 92 },
    { name: 'Polynomials', topic: '', status: 'completed', worksheets: 6, score: 88 },
    { name: 'Pair of Linear Equations', topic: '', status: 'completed', worksheets: 8, score: 85 },
    { name: 'Quadratic Equations', topic: '', status: 'in_progress', worksheets: 8, score: 75 },
    { name: 'Arithmetic Progressions', topic: '', status: 'in_progress', worksheets: 7, score: 70 },
    { name: 'Triangles', topic: '', status: 'not_started', worksheets: 9, score: 0 },
    { name: 'Coordinate Geometry', topic: '', status: 'not_started', worksheets: 7, score: 0 },
    { name: 'Trigonometry', topic: '', status: 'not_started', worksheets: 10, score: 0 },
  ],
  physics: [
    { name: 'Light – Reflection', topic: '', status: 'completed', worksheets: 6, score: 90 },
    { name: 'Light – Refraction', topic: '', status: 'in_progress', worksheets: 8, score: 80 },
    { name: 'Human Eye', topic: '', status: 'not_started', worksheets: 5, score: 0 },
    { name: 'Force and Laws of Motion', topic: '', status: 'in_progress', worksheets: 8, score: 72 },
    { name: 'Electricity', topic: '', status: 'not_started', worksheets: 9, score: 0 },
  ],
  chemistry: [
    { name: 'Chemical Reactions', topic: '', status: 'completed', worksheets: 8, score: 85 },
    { name: 'Acids, Bases and Salts', topic: '', status: 'in_progress', worksheets: 7, score: 65 },
    { name: 'Metals and Non-metals', topic: '', status: 'not_started', worksheets: 8, score: 0 },
    { name: 'Carbon Compounds', topic: '', status: 'not_started', worksheets: 6, score: 0 },
  ],
};

const SUBJECT_META: Record<string, { icon: string; color: string; bg: string }> = {
  mathematics: { icon: '📐', color: '#4CAF50', bg: '#E8F5E9' },
  physics: { icon: '🧪', color: '#2196F3', bg: '#E3F2FD' },
  chemistry: { icon: '⚛️', color: '#9C27B0', bg: '#F3E5F5' },
};

function CircleProgress({ value, index, status }: { value: number; index: number; status: string }) {
  const r = 14;
  const circ = 2 * Math.PI * r;
  const dash = status === 'completed' ? circ : status === 'in_progress' ? circ * 0.55 : 0;
  const color = status === 'completed' ? '#E8633B' : status === 'in_progress' ? '#E8633B' : '#d1d5db';

  return (
    <div className="flex flex-col items-center gap-1">
      <svg width="36" height="36">
        <circle cx="18" cy="18" r={r} fill="none" stroke="#e5e7eb" strokeWidth="3" />
        <circle
          cx="18" cy="18" r={r} fill="none" stroke={color} strokeWidth="3"
          strokeDasharray={`${dash} ${circ}`}
          strokeLinecap="round"
          transform="rotate(-90 18 18)"
          opacity={status === 'not_started' ? 0 : 1}
        />
        {status === 'not_started' && (
          <circle cx="18" cy="18" r={r} fill="none" stroke="#e5e7eb" strokeWidth="3" />
        )}
      </svg>
      <span className="text-[10px] font-medium text-gray-500">CH {index + 1}</span>
    </div>
  );
}

export default function SubjectPage({ params }: { params: Promise<{ name: string }> }) {
  const { name } = use(params);
  const router = useRouter();
  const chapters = CHAPTERS[name] || CHAPTERS.mathematics;
  const meta = SUBJECT_META[name] || SUBJECT_META.mathematics;
  const displayName = name.charAt(0).toUpperCase() + name.slice(1);

  const statusBadge = (status: string) => {
    if (status === 'completed') return <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-700">Completed</span>;
    if (status === 'in_progress') return <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-orange-100 text-orange-700">In-progress</span>;
    return <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-600">Not Started</span>;
  };

  return (
    <div className="min-h-screen bg-[#1A2332] flex items-start justify-center p-4 py-8">
      <div className="bg-white rounded-3xl w-full max-w-3xl overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="px-6 pt-6">
          <button onClick={() => router.back()} className="flex items-center gap-1.5 text-sm text-gray-500 mb-4 hover:text-gray-700">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12,8 8,12 12,16" />
              <line x1="16" y1="12" x2="8" y2="12" />
            </svg>
            Back
          </button>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-3xl" style={{ backgroundColor: meta.bg }}>
                {meta.icon}
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">{displayName} Worksheets</h1>
                <p className="text-gray-400 text-sm">{chapters.length} chapters • {chapters.reduce((s, c) => s + c.worksheets, 0)} worksheets</p>
              </div>
            </div>
            <div className="flex gap-2">
              <button className="w-9 h-9 rounded-full border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-50">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polygon points="22,3 2,3 10,12.46 10,19 14,21 14,12.46" />
                </svg>
              </button>
              <button className="w-9 h-9 rounded-full border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-50">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="5" r="1" /><circle cx="12" cy="12" r="1" /><circle cx="12" cy="19" r="1" />
                </svg>
              </button>
            </div>
          </div>

          {/* Chapter progress circles */}
          <div className="flex gap-3 mt-5 pb-4 overflow-x-auto">
            {chapters.map((ch, i) => (
              <CircleProgress key={i} value={ch.score} index={i} status={ch.status} />
            ))}
          </div>
          <div className="border-b border-gray-100" />
        </div>

        {/* Chapter list */}
        <div className="divide-y divide-gray-50 pb-6">
          {chapters.map((ch, i) => (
            <div key={i} className="px-6 py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-white shrink-0"
                    style={{ backgroundColor: ch.status === 'not_started' ? '#9ca3af' : meta.color }}
                  >
                    {i + 1}
                  </div>
                  <div>
                    <div className="font-semibold text-gray-900 text-sm">{ch.name}</div>
                    <div className="flex items-center gap-2 mt-0.5">
                      {statusBadge(ch.status)}
                      <span className="text-xs text-gray-400">{ch.worksheets} Worksheets</span>
                      {ch.score > 0 && <span className="text-xs text-gray-400">• Scored {ch.score}%</span>}
                    </div>
                  </div>
                </div>
                <div className="flex gap-2 shrink-0">
                  {ch.status !== 'not_started' && (
                    <button className="px-4 py-1.5 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50">
                      View
                    </button>
                  )}
                  {ch.status === 'in_progress' && (
                    <button className="px-4 py-1.5 bg-gray-900 text-white rounded-lg text-sm hover:bg-gray-800">
                      Re-evaluate
                    </button>
                  )}
                  {ch.status === 'not_started' && (
                    <button
                      className="px-4 py-1.5 text-white rounded-lg text-sm font-semibold"
                      style={{ backgroundColor: meta.color }}
                    >
                      Start now
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
