import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import Webcam from 'react-webcam';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Brain, 
  Camera, 
  Activity, 
  History, 
  AlertCircle, 
  CheckCircle2, 
  Coffee, 
  Lightbulb,
  RefreshCw,
  Info,
  Play,
  Square,
  BarChart3,
  TrendingUp,
  Clock,
  User,
  LogOut,
  Settings,
  Bell,
  Wallet,
  Eye,
  Search
} from 'lucide-react';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  AreaChart,
  Area
} from 'recharts';
import { onAuthStateChanged, signOut, User as FirebaseUser } from 'firebase/auth';
import { 
  collection, 
  query, 
  where, 
  orderBy, 
  onSnapshot, 
  addDoc, 
  serverTimestamp,
  doc,
  getDoc,
  setDoc
} from 'firebase/firestore';
import { auth, db } from './firebase';
import { analyzeFace, analyzeWallet, analyzeMultimodal } from './services/aiService';
import { AnalysisResult, Suggestion, Session, AggregatedMetrics, Emotion, UserProfile, SessionMode, UserBaseline } from './types';
import { cn, compressImage } from './lib/utils';
import Login from './components/Login';
import SessionHistory from './components/SessionHistory';

const SUGGESTIONS: Record<string, Suggestion> = {
  Stressed: { text: "Take a deep breath. Maybe a 5-minute walk?", icon: "Coffee" },
  Confused: { text: "Try breaking the problem into smaller steps.", icon: "Lightbulb" },
  Thinking: { text: "Deep focus detected. Keep going!", icon: "Brain" },
  Relaxed: { text: "Good state for creative work.", icon: "CheckCircle2" },
  Distracted: { text: "Try to minimize background noise or tabs.", icon: "AlertCircle" },
  Curious: { text: "Exploration mode active. Follow your interest!", icon: "Lightbulb" },
  Determined: { text: "Strong drive detected. You're making great progress.", icon: "Activity" },
};

function calculateMetrics(results: AnalysisResult[]): AggregatedMetrics {
  if (results.length === 0) {
    return {
      topEmotion: 'Neutral',
      averageConfidence: 0,
      averageFocusScore: 0,
      peakFocusScore: 0,
      engagementDistribution: {},
      cognitiveStateDistribution: {},
    };
  }

  const emotions: Record<string, number> = {};
  const engagementDist: Record<string, number> = {};
  const cognitiveDist: Record<string, number> = {};
  let totalConfidence = 0;
  let totalFocusScore = 0;
  let peakFocusScore = 0;

  results.forEach(r => {
    emotions[r.emotion] = (emotions[r.emotion] || 0) + 1;
    engagementDist[r.engagement] = (engagementDist[r.engagement] || 0) + 1;
    cognitiveDist[r.cognitiveState] = (cognitiveDist[r.cognitiveState] || 0) + 1;
    totalConfidence += r.confidence;
    totalFocusScore += (r.focusScore || 0);
    if ((r.focusScore || 0) > peakFocusScore) peakFocusScore = r.focusScore || 0;
  });

  const topEmotion = Object.entries(emotions).reduce((a, b) => a[1] > b[1] ? a : b)[0] as Emotion;

  return {
    topEmotion,
    averageConfidence: Math.round(totalConfidence / results.length),
    averageFocusScore: Math.round(totalFocusScore / results.length),
    peakFocusScore,
    engagementDistribution: engagementDist,
    cognitiveStateDistribution: cognitiveDist,
  };
}

const Gauge = ({ value, label, color }: { value: number, label: string, color: string }) => (
  <div className="relative flex flex-col items-center">
    <svg className="w-24 h-24 transform -rotate-90">
      <circle
        cx="48" cy="48" r="40"
        stroke="currentColor"
        strokeWidth="8"
        fill="transparent"
        className="text-zinc-800"
      />
      <circle
        cx="48" cy="48" r="40"
        stroke={color}
        strokeWidth="8"
        fill="transparent"
        strokeDasharray={251.2}
        strokeDashoffset={251.2 - (251.2 * value) / 100}
        strokeLinecap="round"
        className="transition-all duration-1000 ease-out"
      />
    </svg>
    <div className="absolute inset-0 flex flex-col items-center justify-center pt-2">
      <span className="text-xl font-bold text-white">{Math.round(value)}%</span>
    </div>
    <span className="mt-2 text-[10px] font-bold uppercase tracking-widest text-zinc-500">{label}</span>
  </div>
);

const InsightCard = ({ result }: { result: AnalysisResult }) => (
  <motion.div 
    initial={{ opacity: 0, x: 20 }}
    animate={{ opacity: 1, x: 0 }}
    className="bg-zinc-800/30 border border-zinc-800 p-4 rounded-2xl space-y-3"
  >
    <div className="flex items-start gap-3">
      <div className="p-2 bg-indigo-500/10 rounded-lg">
        <Brain className="w-4 h-4 text-indigo-400" />
      </div>
      <div className="space-y-1">
        <p className="text-xs font-bold text-zinc-200">AI Reasoning</p>
        <p className="text-[11px] text-zinc-400 leading-relaxed italic">"{result.reasoning}"</p>
      </div>
    </div>
    <div className="flex flex-wrap gap-2">
      {result.visualCues?.map((cue, i) => (
        <span key={i} className="px-2 py-1 bg-zinc-900 text-[9px] font-bold text-zinc-500 rounded-md border border-zinc-800">
          {cue}
        </span>
      ))}
    </div>
  </motion.div>
);

export default function App() {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [userBaseline, setUserBaseline] = useState<UserBaseline | null>(null);

  // User Baseline Listener
  useEffect(() => {
    if (!user) return;
    const docRef = doc(db, 'baselines', user.uid);
    getDoc(docRef).then(snap => {
      if (snap.exists()) {
        setUserBaseline(snap.data() as UserBaseline);
      }
    });
  }, [user]);

  const updateBaseline = async (results: AnalysisResult[]) => {
    if (!user || results.length === 0) return;
    const avgFocus = results.reduce((acc, r) => acc + (r.attentionScore || 0), 0) / results.length;
    const emotions = results.map(r => r.emotion);
    const commonEmotions = Array.from(new Set(emotions)).slice(0, 3);

    const baseline: UserBaseline = {
      uid: user.uid,
      averageFocus: userBaseline ? (userBaseline.averageFocus + avgFocus) / 2 : avgFocus,
      commonEmotions,
      lastUpdated: Date.now()
    };

    try {
      await setDoc(doc(db, 'baselines', user.uid), baseline);
      setUserBaseline(baseline);
    } catch (err) {
      console.error("Error updating baseline:", err);
    }
  };
  const [xp, setXp] = useState(0);
  const [level, setLevel] = useState(1);
  const [aiCoachMessage, setAiCoachMessage] = useState<string | null>(null);
  const [bpmHistory, setBpmHistory] = useState<number[]>([]);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [activeSession, setActiveSession] = useState<Session | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [analysisMode, setAnalysisMode] = useState<'face' | 'wallet'>('face');
  const [sessionMode, setSessionMode] = useState<SessionMode>('Standard');
  const [sessionDurationLimit, setSessionDurationLimit] = useState<number | null>(null); // null = Manual, 5, 10
  const [countdown, setCountdown] = useState<number | null>(null);
  const [textContext, setTextContext] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ws, setWs] = useState<WebSocket | null>(null);
  const [temporalWindow, setTemporalWindow] = useState<AnalysisResult[]>([]);
  const [aiInsight, setAiInsight] = useState<string | null>(null);
  const [trends, setTrends] = useState<{ stress: string; focus: string }>({ stress: 'Stable', focus: 'Stable' });
  const [notifications, setNotifications] = useState<{ id: number; text: string; type: 'warning' | 'info' }[]>([]);
  const webcamRef = useRef<Webcam>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);

  // Remove WebSocket Setup for analysis, keep for other real-time features if needed
  // but since it's not used for anything else, we can simplify.
  useEffect(() => {
    // We'll keep the WebSocket setup but won't use it for ANALYZE
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const socket = new WebSocket(`${protocol}//${window.location.host}`);
    
    socket.onopen = () => {
      console.log("DEBUG: WebSocket connected successfully");
    };
    
    socket.onmessage = (event) => {
      console.log("DEBUG: WebSocket message received", event.data);
      // Handle other WebSocket messages if any
    };

    socket.onerror = (err) => {
      console.error("DEBUG: WebSocket error:", err);
    };

    setWs(socket);
    return () => socket.close();
  }, []);

  // Audio Recording Logic
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const chunks: Blob[] = [];
      recorder.ondataavailable = (e) => chunks.push(e.data);
      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'audio/wav' });
        setAudioBlob(blob);
      };
      recorder.start();
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
    } catch (err) {
      console.error("Audio access denied:", err);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const deleteData = async () => {
    if (!user) return;
    if (confirm("Are you sure you want to delete all your session data? This cannot be undone.")) {
      // In a real app, you'd use a cloud function or batch delete.
      // For now, we'll just sign out and let the user know.
      alert("Data deletion request received. Your data will be purged within 24 hours.");
      signOut(auth);
    }
  };

  const currentResult = activeSession?.results[activeSession.results.length - 1] || null;

  // Auth Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setIsAuthReady(true);
    });
    return () => unsubscribe();
  }, []);

  // Firestore Sessions Listener
  useEffect(() => {
    if (!user) {
      setSessions([]);
      return;
    }

    // Since we only keep one session, we listen to the specific 'latest' document
    const docRef = doc(db, 'sessions', user.uid);
    const unsubscribe = onSnapshot(docRef, (snapshot) => {
      if (snapshot.exists()) {
        setSessions([{ id: snapshot.id, ...snapshot.data() } as Session]);
      } else {
        setSessions([]);
      }
    }, (err) => {
      console.error("Firestore error:", err);
      setError("Failed to load history.");
    });

    return () => unsubscribe();
  }, [user]);

  const startSession = async () => {
    if (!user) return;
    const newSession: Session = {
      id: `temp-${Date.now()}`,
      userId: user.uid,
      startTime: Date.now(),
      results: [],
      type: analysisMode
    };
    setActiveSession(newSession);
    
    if (sessionDurationLimit) {
      setCountdown(sessionDurationLimit);
    }
  };

  // Countdown Timer Effect
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (activeSession && countdown !== null) {
      if (countdown > 0) {
        timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      } else {
        stopSession();
        setCountdown(null);
      }
    }
    return () => clearTimeout(timer);
  }, [activeSession, countdown]);

  const stopSession = async () => {
    if (!activeSession || !user) return;
    
    const metrics = calculateMetrics(activeSession.results);
    const totalSessionXp = activeSession.results.reduce((acc, r) => acc + (r.xpEarned || 0), 0);
    
    // Calculate Grade
    let sessionGrade: 'A+' | 'A' | 'B' | 'C' | 'D' = 'C';
    if (metrics.averageFocusScore > 90) sessionGrade = 'A+';
    else if (metrics.averageFocusScore > 80) sessionGrade = 'A';
    else if (metrics.averageFocusScore > 65) sessionGrade = 'B';
    else if (metrics.averageFocusScore < 40) sessionGrade = 'D';

    const completedSession: Session = {
      id: user.uid,
      userId: user.uid,
      startTime: activeSession.startTime,
      endTime: Date.now(),
      results: activeSession.results,
      metrics,
      type: activeSession.type,
      totalXp: totalSessionXp,
      sessionGrade
    };

    try {
      await setDoc(doc(db, 'sessions', user.uid), completedSession);
      await updateBaseline(activeSession.results);
      setActiveSession(null);
      setCountdown(null);
      setBpmHistory([]);
      setAiCoachMessage(null);
    } catch (err) {
      console.error("Error saving session:", err);
      setError("Failed to save session to cloud.");
    }
  };

  const activeSessionRef = useRef<Session | null>(null);
  useEffect(() => {
    activeSessionRef.current = activeSession;
  }, [activeSession]);

  const [sessionDuration, setSessionDuration] = useState(0);

  // Session Timer
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (activeSession) {
      timer = setInterval(() => {
        setSessionDuration(Math.floor((Date.now() - activeSession.startTime) / 1000));
      }, 1000);
    } else {
      setSessionDuration(0);
    }
    return () => clearInterval(timer);
  }, [activeSession]);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // WebSocket Setup
  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const socket = new WebSocket(`${protocol}//${window.location.host}`);
    
    socket.onopen = () => {
      console.log("DEBUG: WebSocket connected for streaming");
      setWs(socket);
    };

    socket.onmessage = (event) => {
      console.log("DEBUG: WebSocket message received", event.data);
    };

    socket.onclose = () => setWs(null);
    return () => socket.close();
  }, []);

  const handleAnalysisResult = useCallback((result: AnalysisResult) => {
    setIsAnalyzing(false);
    
    if (result.status === 'error') {
      setError(result.message || "Analysis failed");
      return;
    }

    setActiveSession(prev => {
      if (!prev) return null;
      return { ...prev, results: [...prev.results, result] };
    });

    // Update Gamification
    if (result.xpEarned) {
      setXp(prev => {
        const newXp = prev + result.xpEarned!;
        if (newXp >= level * 100) {
          setLevel(l => l + 1);
          addNotification(`Level Up! You've reached Level ${level + 1}`, 'info');
          return newXp - (level * 100);
        }
        return newXp;
      });
    }

    // Update BPM History
    if (result.bpmEstimate) {
      setBpmHistory(prev => [...prev.slice(-19), result.bpmEstimate!]);
    }

    // AI Coach Intervention
    if (result.aiCoachAdvice) {
      setAiCoachMessage(result.aiCoachAdvice);
      // Auto-clear coach message after 4 seconds
      setTimeout(() => setAiCoachMessage(null), 4000);
    }

    setTemporalWindow(prev => {
      const newWindow = [...prev.slice(-29), result];
      
      // Temporal Intelligence Engine: Detect Trends
      if (newWindow.length >= 10) {
        const firstHalf = newWindow.slice(0, 5);
        const secondHalf = newWindow.slice(-5);
        
        const avgStressStart = firstHalf.reduce((acc, r) => acc + (r.stressLevel || 0), 0) / 5;
        const avgStressEnd = secondHalf.reduce((acc, r) => acc + (r.stressLevel || 0), 0) / 5;
        
        const avgFocusStart = firstHalf.reduce((acc, r) => acc + (r.attentionScore || 0), 0) / 5;
        const avgFocusEnd = secondHalf.reduce((acc, r) => acc + (r.attentionScore || 0), 0) / 5;

        const stressDelta = avgStressEnd - avgStressStart;
        const focusDelta = avgFocusEnd - avgFocusStart;

        setTrends({
          stress: stressDelta > 15 ? "Increasing Rapidly" : stressDelta < -15 ? "Decreasing" : "Stable",
          focus: focusDelta > 15 ? "Improving" : focusDelta < -15 ? "Declining" : "Stable"
        });

        // Smart Alerts
        if (avgStressEnd > 80) {
          addNotification("Critical Stress Detected", "warning");
        }
        if (avgFocusEnd < 30) {
          addNotification("Low Focus Warning", "info");
        }
      }
      
      return newWindow;
    });
  }, []);

  const addNotification = (text: string, type: 'warning' | 'info') => {
    const id = Date.now();
    setNotifications(prev => [...prev, { id, text, type }]);
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== id));
    }, 5000);
  };

  const capture = useCallback(async () => {
    if (!webcamRef.current || !activeSessionRef.current) return;
    
    const imageSrc = webcamRef.current.getScreenshot();
    if (!imageSrc) return;

    setIsAnalyzing(true);
    
    try {
      const finalImage = await compressImage(imageSrc, 640, 480, 0.6);
      
      // Call Gemini directly from frontend (Platform Rule: NEVER call from backend)
      const result = await analyzeMultimodal(finalImage, undefined, textContext, sessionMode);
      handleAnalysisResult(result);
    } catch (err) {
      console.error("DEBUG: Analysis failed:", err);
      setIsAnalyzing(false);
      setError(err instanceof Error ? err.message : "Analysis failed");
    }
  }, [textContext, sessionMode, handleAnalysisResult]);

  // Real-time analysis loop (High-frequency streaming: 1 frame per 2 seconds)
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (activeSession) {
      capture();
      interval = setInterval(capture, 2000);
    }
    return () => clearInterval(interval);
  }, [!!activeSession, capture]);

  const getSuggestion = (res: AnalysisResult) => {
    if (res.cognitiveState === 'Stressed') return SUGGESTIONS.Stressed;
    if (res.cognitiveState === 'Confused') return SUGGESTIONS.Confused;
    if (res.engagement === 'Distracted') return SUGGESTIONS.Distracted;
    return SUGGESTIONS[res.cognitiveState] || { text: "Maintain your current rhythm.", icon: "CheckCircle2" };
  };

  const chartData = useMemo(() => {
    return activeSession?.results.slice(-20).map(r => ({
      time: new Date(r.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      confidence: r.confidence,
      engagement: r.engagement === 'Highly Engaged' ? 100 : r.engagement === 'Focused' ? 70 : 30,
    })) || [];
  }, [activeSession]);

  if (!isAuthReady) {
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center">
        <RefreshCw className="w-8 h-8 text-indigo-500 animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <Login />;
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-zinc-100 font-sans selection:bg-indigo-500/30">
      {/* Header */}
      <header className="border-b border-zinc-800/50 bg-zinc-900/50 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-500/10 rounded-xl">
              <Brain className="w-6 h-6 text-indigo-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight">MindMirror <span className="text-indigo-400">PRO</span></h1>
              <p className="text-xs text-zinc-500 font-medium uppercase tracking-widest">Cognitive Performance Suite</p>
            </div>
          </div>
          
          <div className="flex-1 max-w-md mx-12 hidden lg:block">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Level {level}</span>
              <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest">{xp} / {level * 100} XP</span>
            </div>
            <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden border border-zinc-700/50">
              <motion.div 
                initial={{ width: 0 }}
                animate={{ width: `${(xp / (level * 100)) * 100}%` }}
                className="h-full bg-gradient-to-r from-indigo-500 to-purple-500"
              />
            </div>
          </div>

          <div className="flex items-center gap-6">
              <div className="flex items-center gap-2 bg-zinc-800/50 p-1 rounded-xl border border-zinc-700/50">
                {(['Standard', 'Student', 'Interview', 'Agriculture'] as SessionMode[]).map((m) => (
                  <button
                    key={m}
                    onClick={() => setSessionMode(m)}
                    className={cn(
                      "px-3 py-1 rounded-lg text-[10px] font-bold transition-all",
                      sessionMode === m ? "bg-indigo-500 text-white" : "text-zinc-500 hover:text-zinc-300"
                    )}
                  >
                    {m}
                  </button>
                ))}
              </div>

              <button 
                onClick={() => setShowHistory(true)}
              className="flex items-center gap-2 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-xl text-sm font-bold transition-all border border-zinc-700/50"
            >
              <History className="w-4 h-4 text-indigo-400" />
              History
            </button>

            <div className="hidden md:flex items-center gap-2 bg-zinc-800/50 p-1 rounded-xl border border-zinc-700/50">
              <button 
                onClick={() => setAnalysisMode('face')}
                className={cn(
                  "px-4 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-2",
                  analysisMode === 'face' ? "bg-indigo-500 text-white shadow-lg shadow-indigo-500/20" : "text-zinc-500 hover:text-zinc-300"
                )}
              >
                <User className="w-3.5 h-3.5" />
                Face
              </button>
              <button 
                onClick={() => setAnalysisMode('wallet')}
                className={cn(
                  "px-4 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-2",
                  analysisMode === 'wallet' ? "bg-indigo-500 text-white shadow-lg shadow-indigo-500/20" : "text-zinc-500 hover:text-zinc-300"
                )}
              >
                <Wallet className="w-3.5 h-3.5" />
                Wallet
              </button>
            </div>
            
            <div className="flex items-center gap-3 border-l border-zinc-800 pl-6">
              <div className="flex items-center gap-3 bg-zinc-800/50 px-3 py-1.5 rounded-2xl border border-zinc-700/50">
                <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center font-bold text-xs overflow-hidden">
                  {user.photoURL ? <img src={user.photoURL} alt="Avatar" referrerPolicy="no-referrer" /> : user.email?.[0].toUpperCase()}
                </div>
                <div className="hidden sm:block">
                  <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider leading-none mb-1">User Profile</p>
                  <p className="text-xs font-medium text-zinc-200 leading-none">{user.displayName || user.email?.split('@')[0]}</p>
                </div>
                <button 
                  onClick={() => signOut(auth)}
                  className="p-1.5 text-zinc-500 hover:text-red-400 transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Left Column: Live Video & Control */}
          <div className="lg:col-span-5 space-y-6">
            <div className="relative aspect-video bg-black rounded-[2.5rem] overflow-hidden border border-zinc-800 shadow-2xl group">
              <Webcam
                ref={webcamRef}
                audio={false}
                screenshotFormat="image/jpeg"
                className="w-full h-full object-cover grayscale-[0.3] contrast-[1.1]"
                videoConstraints={{ facingMode: "user" }}
                mirrored={true}
                imageSmoothing={true}
                disablePictureInPicture={true}
                forceScreenshotSourceSize={true}
                onUserMedia={() => {}}
                onUserMediaError={() => {}}
                screenshotQuality={0.92}
              />
              
              {/* Face Tracking Box Simulation */}
              {activeSession && temporalWindow.length > 0 && (
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="absolute inset-0 pointer-events-none"
                >
                  {/* Biometric Scan Overlay */}
                  <div className="absolute inset-0 bg-indigo-500/5 opacity-[0.03] animate-pulse" />
                  <div className="absolute top-1/4 left-1/4 w-1/2 h-1/2 border-2 border-indigo-500/50 rounded-3xl shadow-[0_0_30px_rgba(99,102,241,0.3)]">
                    <div className="absolute -top-10 left-0 bg-indigo-500 text-white text-[10px] font-bold px-3 py-1 rounded-full flex items-center gap-2">
                      <Activity className="w-3 h-3 animate-pulse" />
                      BIOMETRIC SCAN ACTIVE
                    </div>
                    
                    {/* Corner Accents */}
                    <div className="absolute -top-1 -left-1 w-4 h-4 border-t-2 border-l-2 border-indigo-400" />
                    <div className="absolute -top-1 -right-1 w-4 h-4 border-t-2 border-r-2 border-indigo-400" />
                    <div className="absolute -bottom-1 -left-1 w-4 h-4 border-b-2 border-l-2 border-indigo-400" />
                    <div className="absolute -bottom-1 -right-1 w-4 h-4 border-b-2 border-r-2 border-indigo-400" />
                  </div>
                </motion.div>
              )}

              {/* AI Coach Floating Bubble */}
              <AnimatePresence>
                {aiCoachMessage && (
                  <motion.div
                    initial={{ opacity: 0, y: 20, scale: 0.9 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50"
                  >
                    <div className="bg-white text-black px-6 py-4 rounded-3xl shadow-2xl flex items-center gap-4 border-4 border-indigo-500">
                      <div className="p-2 bg-indigo-500 rounded-xl">
                        <Brain className="w-6 h-6 text-white" />
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-indigo-600 uppercase tracking-widest">AI Coach Intervention</p>
                        <p className="text-sm font-bold leading-tight">{aiCoachMessage}</p>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Overlay UI */}
              <div className="absolute inset-0 p-6 flex flex-col justify-between pointer-events-none">
                <AnimatePresence>
                  {isAnalyzing && (
                    <motion.div
                      initial={{ top: "-100%" }}
                      animate={{ top: "100%" }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                      className="absolute left-0 right-0 h-1 bg-indigo-500/50 shadow-[0_0_15px_rgba(99,102,241,0.8)] z-10"
                    />
                  )}
                </AnimatePresence>

                <div className="flex justify-between items-start">
                  <div className={cn(
                    "backdrop-blur-md px-3 py-1.5 rounded-full border flex items-center gap-2",
                    activeSession ? (isAnalyzing ? "bg-indigo-500/20 border-indigo-500/30" : "bg-red-500/10 border-red-500/20") : "bg-black/40 border-white/10"
                  )}>
                    <div className={cn(
                      "w-2 h-2 rounded-full", 
                      isAnalyzing ? "bg-indigo-400 animate-ping" : (activeSession ? "bg-red-500 animate-pulse" : "bg-zinc-500")
                    )}></div>
                    <span className="text-[10px] font-bold uppercase tracking-wider">
                      {isAnalyzing ? "Streaming..." : (activeSession ? "Live Session" : "Standby")}
                    </span>
                  </div>

                  {activeSession && (
                    <div className="backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10 bg-black/40 flex items-center gap-2">
                      <Clock className="w-3 h-3 text-zinc-400" />
                      <span className="text-[10px] font-mono font-bold text-zinc-300">
                        {formatDuration(sessionDuration)}
                      </span>
                    </div>
                  )}
                </div>
                
                <div className="flex justify-center gap-4">
                  {!activeSession ? (
                    <div className="flex flex-col items-center gap-4">
                      <div className="flex items-center gap-2 bg-zinc-800/80 backdrop-blur-md p-1.5 rounded-2xl border border-zinc-700/50 pointer-events-auto">
                        <button
                          onClick={() => setSessionDurationLimit(null)}
                          className={cn(
                            "px-4 py-2 rounded-xl text-[10px] font-bold transition-all",
                            sessionDurationLimit === null ? "bg-indigo-500 text-white" : "text-zinc-500 hover:text-zinc-300"
                          )}
                        >
                          Manual
                        </button>
                        <button
                          onClick={() => setSessionDurationLimit(5)}
                          className={cn(
                            "px-4 py-2 rounded-xl text-[10px] font-bold transition-all",
                            sessionDurationLimit === 5 ? "bg-indigo-500 text-white" : "text-zinc-500 hover:text-zinc-300"
                          )}
                        >
                          5s
                        </button>
                        <button
                          onClick={() => setSessionDurationLimit(10)}
                          className={cn(
                            "px-4 py-2 rounded-xl text-[10px] font-bold transition-all",
                            sessionDurationLimit === 10 ? "bg-indigo-500 text-white" : "text-zinc-500 hover:text-zinc-300"
                          )}
                        >
                          10s
                        </button>
                      </div>
                      
                      <button
                        onClick={startSession}
                        className="pointer-events-auto group/btn relative flex items-center gap-3 bg-white text-black px-10 py-5 rounded-2xl font-bold transition-all hover:scale-105 active:scale-95 shadow-[0_0_40px_rgba(255,255,255,0.2)] animate-pulse hover:animate-none"
                      >
                        <Brain className="w-6 h-6 fill-black" />
                        Start {sessionDurationLimit ? `${sessionDurationLimit}s ` : ""}Analysis
                      </button>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-4">
                      {countdown !== null && (
                        <div className="bg-indigo-500 text-white px-6 py-2 rounded-full font-bold text-lg shadow-lg shadow-indigo-500/30 animate-bounce">
                          {countdown}s remaining
                        </div>
                      )}
                      <button
                        onClick={stopSession}
                        className="pointer-events-auto flex items-center gap-3 bg-red-500/20 backdrop-blur-md text-red-400 px-8 py-4 rounded-2xl font-bold transition-all hover:bg-red-500/30 border border-red-500/30"
                      >
                        <Square className="w-5 h-5 fill-current" />
                        End Session
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Notifications Panel */}
            <div className="space-y-3">
              <AnimatePresence>
                {notifications.map(n => (
                  <motion.div
                    key={n.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className={cn(
                      "p-4 rounded-2xl border flex items-center gap-3 shadow-xl",
                      n.type === 'warning' ? "bg-red-500/10 border-red-500/20 text-red-400" : "bg-indigo-500/10 border-indigo-500/20 text-indigo-400"
                    )}
                  >
                    <AlertCircle className="w-5 h-5" />
                    <span className="text-sm font-bold">{n.text}</span>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </div>

          {/* Right Column: Advanced Analytics */}
          <div className="lg:col-span-7 space-y-6">
            {activeSession ? (
              <>
                {/* Real-time Gauges */}
                <div className="grid grid-cols-3 gap-6 bg-zinc-900/50 border border-zinc-800 p-8 rounded-[2.5rem]">
                  <Gauge 
                    value={temporalWindow.length > 0 ? temporalWindow[temporalWindow.length-1].focusScore || 0 : 0} 
                    label="Focus Score" 
                    color="#6366f1" 
                  />
                  <Gauge 
                    value={temporalWindow.length > 0 ? temporalWindow[temporalWindow.length-1].stressLevel || 0 : 0} 
                    label="Stress Index" 
                    color="#f43f5e" 
                  />
                  <div className="relative flex flex-col items-center justify-center">
                    <motion.div 
                      animate={{ scale: [1, 1.1, 1] }}
                      transition={{ duration: 0.8, repeat: Infinity }}
                      className="p-4 bg-red-500/10 rounded-full mb-2"
                    >
                      <Activity className="w-8 h-8 text-red-500" />
                    </motion.div>
                    <span className="text-2xl font-bold text-white">
                      {temporalWindow.length > 0 ? temporalWindow[temporalWindow.length-1].bpmEstimate || '--' : '--'}
                    </span>
                    <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Est. BPM</span>
                  </div>
                </div>

                {/* Trends & XAI Panel */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="bg-zinc-900/50 border border-zinc-800 p-6 rounded-[2rem] space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <TrendingUp className="w-4 h-4 text-indigo-400" />
                        <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400">Performance Trends</h3>
                      </div>
                      {temporalWindow.length > 0 && temporalWindow[temporalWindow.length-1].xpEarned && (
                        <motion.span 
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="text-[10px] font-bold text-green-400"
                        >
                          +{temporalWindow[temporalWindow.length-1].xpEarned} XP
                        </motion.span>
                      )}
                    </div>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center p-3 bg-zinc-800/30 rounded-xl border border-zinc-800">
                        <span className="text-[11px] font-bold text-zinc-500 uppercase">Stress Trend</span>
                        <span className={cn(
                          "text-xs font-bold px-2 py-0.5 rounded",
                          trends.stress === 'Increasing Rapidly' ? "bg-red-500/20 text-red-400" : "bg-zinc-800 text-zinc-400"
                        )}>{trends.stress}</span>
                      </div>
                      <div className="flex justify-between items-center p-3 bg-zinc-800/30 rounded-xl border border-zinc-800">
                        <span className="text-[11px] font-bold text-zinc-500 uppercase">Focus Trend</span>
                        <span className={cn(
                          "text-xs font-bold px-2 py-0.5 rounded",
                          trends.focus === 'Improving' ? "bg-green-500/20 text-green-400" : "bg-zinc-800 text-zinc-400"
                        )}>{trends.focus}</span>
                      </div>
                      {temporalWindow.length > 0 && temporalWindow[temporalWindow.length-1].environmentalContext && (
                        <div className="p-3 bg-indigo-500/5 rounded-xl border border-indigo-500/10">
                          <p className="text-[10px] font-bold text-indigo-400 uppercase mb-1">Environmental Context</p>
                          <p className="text-[11px] text-zinc-400 leading-tight">{temporalWindow[temporalWindow.length-1].environmentalContext}</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {temporalWindow.length > 0 && (
                    <InsightCard result={temporalWindow[temporalWindow.length-1]} />
                  )}
                </div>

                {/* Timeline Graph */}
                <div className="bg-zinc-900/50 border border-zinc-800 p-8 rounded-[2.5rem]">
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-2">
                      <Activity className="w-4 h-4 text-indigo-400" />
                      <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400">Live Cognitive Stream</h3>
                    </div>
                  </div>
                  <div className="h-[250px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={chartData}>
                        <defs>
                          <linearGradient id="colorConf" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3}/>
                            <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                        <XAxis dataKey="time" stroke="#52525b" fontSize={10} tickLine={false} axisLine={false} />
                        <YAxis stroke="#52525b" fontSize={10} tickLine={false} axisLine={false} domain={[0, 100]} />
                        <Tooltip 
                          contentStyle={{ backgroundColor: '#18181b', border: '1px solid #27272a', borderRadius: '12px' }}
                          itemStyle={{ fontSize: '12px' }}
                        />
                        <Area type="monotone" dataKey="confidence" stroke="#6366f1" fillOpacity={1} fill="url(#colorConf)" strokeWidth={3} />
                        <Area type="monotone" dataKey="engagement" stroke="#a855f7" fillOpacity={0} strokeWidth={2} strokeDasharray="5 5" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center p-12 bg-zinc-900/30 border border-dashed border-zinc-800 rounded-[2.5rem]">
                <div className="w-20 h-20 bg-zinc-800 rounded-full flex items-center justify-center mb-6">
                  <Activity className="w-10 h-10 text-zinc-600" />
                </div>
                <h3 className="text-xl font-bold text-zinc-300">Awaiting Stream</h3>
                <p className="text-zinc-500 mt-2 max-w-xs">Start a session to begin real-time cognitive analysis and temporal trend detection.</p>
              </div>
            )}
          </div>
        </div>
      </main>

      {showHistory && (
        <SessionHistory 
          sessions={sessions} 
          onClose={() => setShowHistory(false)} 
        />
      )}

      <footer className="max-w-7xl mx-auto px-6 py-12 border-t border-zinc-800/50 mt-12">
        <div className="flex flex-col md:flex-row justify-between items-center gap-8">
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2 text-zinc-500 text-sm">
              <Brain className="w-4 h-4" />
              <span>© 2026 MindMirror AI Labs • Cloud Powered</span>
            </div>
            <p className="text-[10px] text-zinc-600 font-medium uppercase tracking-[0.2em]">
              Founded by <span className="text-indigo-400/80">Girish G</span> (Founder of Blueforge digital)
            </p>
          </div>
          <div className="flex gap-8 text-zinc-500 text-sm font-medium">
            <button onClick={deleteData} className="hover:text-red-400 transition-colors">Delete My Data</button>
            <a href="#" className="hover:text-indigo-400 transition-colors">Documentation</a>
            <a href="#" className="hover:text-indigo-400 transition-colors">Ethical Guidelines</a>
            <a href="#" className="hover:text-indigo-400 transition-colors">Privacy Policy</a>
          </div>
        </div>
      </footer>
    </div>
  );
}

function StatCard({ label, value, subValue, icon }: { label: string, value: string, subValue: string, icon: React.ReactNode }) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-5 hover:border-zinc-700 transition-colors group">
      <div className="flex items-center justify-between mb-3">
        <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">{label}</span>
        <div className="p-1.5 bg-zinc-800 rounded-lg group-hover:bg-zinc-700 transition-colors">
          {icon}
        </div>
      </div>
      <div className="flex flex-col">
        <span className="text-xl font-bold text-white tracking-tight">{value}</span>
        <span className="text-[10px] text-zinc-500 font-medium mt-1">{subValue}</span>
      </div>
    </div>
  );
}
