'use client';

import { EvaluationSession, ChatMessage, RecentWorksheet } from '@/types';

const SESSIONS_KEY = 'ved-sessions';
const CHATS_KEY = 'ved-chats';

function get<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const s = localStorage.getItem(key);
    return s ? JSON.parse(s) : fallback;
  } catch {
    return fallback;
  }
}

function set<T>(key: string, value: T) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(key, JSON.stringify(value));
}

export function saveSession(session: EvaluationSession) {
  const sessions = get<Record<string, EvaluationSession>>(SESSIONS_KEY, {});
  sessions[session.id] = session;
  set(SESSIONS_KEY, sessions);
}

export function getSession(id: string): EvaluationSession | null {
  const sessions = get<Record<string, EvaluationSession>>(SESSIONS_KEY, {});
  return sessions[id] || null;
}

export function getRecentSessions(limit = 4): RecentWorksheet[] {
  const sessions = get<Record<string, EvaluationSession>>(SESSIONS_KEY, {});
  return Object.values(sessions)
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, limit)
    .map(s => ({
      id: s.id,
      subject: s.result.subject,
      title: s.result.worksheetTitle,
      scored: s.result.questions.filter(q => q.status === 'correct').length,
      total: s.result.questions.length,
      timestamp: s.timestamp,
    }));
}

export function getChatMessages(sessionId: string): ChatMessage[] {
  const chats = get<Record<string, ChatMessage[]>>(CHATS_KEY, {});
  return chats[sessionId] || [];
}

export function addChatMessage(sessionId: string, msg: ChatMessage) {
  const chats = get<Record<string, ChatMessage[]>>(CHATS_KEY, {});
  if (!chats[sessionId]) chats[sessionId] = [];
  chats[sessionId].push(msg);
  set(CHATS_KEY, chats);
}

export function updateQuestion(sessionId: string, questionIndex: number, updates: Partial<import('@/types').EvaluatedQuestion>) {
  const sessions = get<Record<string, EvaluationSession>>(SESSIONS_KEY, {});
  const session = sessions[sessionId];
  if (!session) return;
  session.result.questions[questionIndex] = { ...session.result.questions[questionIndex], ...updates };
  set(SESSIONS_KEY, sessions);
}

const ANNOTATIONS_KEY = 'ved-annotations';

export type MarkType = 'tick' | 'cross' | 'circle' | 'underline' | 'arrow' | 'bbox' | 'quad';

export interface TeacherMark {
  id: string;
  type: MarkType;
  x: number;
  y: number;
  x2?: number;
  y2?: number;
  color?: string;
  pts?: [number, number][];
}

export function getAnnotations(sessionId: string): TeacherMark[] {
  const all = get<Record<string, TeacherMark[]>>(ANNOTATIONS_KEY, {});
  return all[sessionId] || [];
}

export function saveAnnotations(sessionId: string, marks: TeacherMark[]) {
  const all = get<Record<string, TeacherMark[]>>(ANNOTATIONS_KEY, {});
  all[sessionId] = marks;
  set(ANNOTATIONS_KEY, all);
}
