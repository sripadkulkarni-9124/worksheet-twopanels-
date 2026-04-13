export interface SolutionStep {
  title: string;
  points: string[];
}

export interface EvaluatedQuestion {
  number: number;
  questionText: string;
  studentAnswer: string | null;
  correctAnswer: string;
  status: 'correct' | 'incorrect' | 'partially_correct' | 'unanswered';
  feedback: string;
  vedInsight: string;
  steps: SolutionStep[];
}

export interface EvaluationResult {
  worksheetTitle: string;
  subject: string;
  chapter: string;
  topic: string;
  questions: EvaluatedQuestion[];
}

export interface AutoMark {
  type: 'tick' | 'cross' | 'circle' | 'underline' | 'arrow' | 'bbox';
  x: number;
  y: number;
  x2?: number;
  y2?: number;
  color?: string;
}

export interface EvaluationSession {
  id: string;
  imageDataUrl: string;
  result: EvaluationResult;
  timestamp: string;
  autoMarks?: AutoMark[];
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

// For home page display
export interface SubjectProgress {
  name: string;
  icon: string;
  bgColor: string;
  iconBg: string;
  chapter: string;
  progress: number;
  started: boolean;
}

export interface RecentWorksheet {
  id: string;
  subject: string;
  title: string;
  scored: number;
  total: number;
  timestamp: string;
}
