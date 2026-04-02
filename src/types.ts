export type Emotion = 
  | 'Happy' | 'Sad' | 'Angry' | 'Surprised' | 'Neutral' | 'Fear' | 'Disgust'
  | 'Contempt' | 'Boredom' | 'Interest' | 'Confusion' | 'Anxiety' | 'Pride' 
  | 'Shame' | 'Guilt' | 'Awe' | 'Contentment' | 'Amusement' | 'Relief' 
  | 'Embarrassment' | 'Excitement' | 'Frustration' | 'Curiosity' | 'Determination';

export type SessionMode = 'Student' | 'Interview' | 'Agriculture' | 'Standard';

export interface AnalysisResult {
  emotion: Emotion;
  confidence: number;
  engagement: 'Focused' | 'Distracted' | 'Highly Engaged';
  cognitiveState: 'Thinking' | 'Confused' | 'Stressed' | 'Relaxed' | 'Curious' | 'Determined';
  timestamp: number;
  walletItems?: string[];
  // Advanced Multimodal Fields
  gazeDirection?: 'Center' | 'Left' | 'Right' | 'Up' | 'Down';
  attentionScore?: number; // 0-100
  voiceTone?: string;
  fusedInsight?: string;
  stressLevel?: number; // 0-100
}

export interface UserBaseline {
  uid: string;
  averageFocus: number;
  commonEmotions: Emotion[];
  lastUpdated: number;
}

export interface UserProfile {
  uid: string;
  email: string;
  displayName?: string;
  photoURL?: string;
  createdAt: number;
}

export interface Session {
  id: string;
  userId: string;
  startTime: number;
  endTime?: number;
  results: AnalysisResult[];
  metrics?: AggregatedMetrics;
  type: 'face' | 'wallet';
}

export interface AggregatedMetrics {
  topEmotion: Emotion;
  averageConfidence: number;
  engagementDistribution: Record<string, number>;
  cognitiveStateDistribution: Record<string, number>;
}

export interface Suggestion {
  text: string;
  icon: string;
}
