export type Emotion = 
  | 'Happy' | 'Sad' | 'Angry' | 'Surprised' | 'Neutral' | 'Fear' | 'Disgust'
  | 'Contempt' | 'Boredom' | 'Interest' | 'Confusion' | 'Anxiety' | 'Pride' 
  | 'Shame' | 'Guilt' | 'Awe' | 'Contentment' | 'Amusement' | 'Relief' 
  | 'Embarrassment' | 'Excitement' | 'Frustration' | 'Curiosity' | 'Determination';

export interface AnalysisResult {
  emotion: Emotion;
  confidence: number;
  engagement: 'Focused' | 'Distracted' | 'Highly Engaged';
  cognitiveState: 'Thinking' | 'Confused' | 'Stressed' | 'Relaxed' | 'Curious' | 'Determined';
  timestamp: number;
  walletItems?: string[];
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
