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
  getDoc
} from 'firebase/firestore';
import { auth, db } from './firebase';
import { analyzeFace, analyzeWallet } from './services/aiService';
import { AnalysisResult, Suggestion, Session, AggregatedMetrics, Emotion, UserProfile } from './types';
import { cn } from './lib/utils';
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
      engagementDistribution: {},
      cognitiveStateDistribution: {},
    };
  }

  const emotions: Record<string, number> = {};
  const engagementDist: Record<string, number> = {};
  const cognitiveDist: Record<string, number> = {};
  let totalConfidence = 0;

  results.forEach(r => {
    emotions[r.emotion] = (emotions[r.emotion] || 0) + 1;
    engagementDist[r.engagement] = (engagementDist[r.engagement] || 0) + 1;
    cognitiveDist[r.cognitiveState] = (cognitiveDist[r.cognitiveState] || 0) + 1;
    totalConfidence += r.confidence;
  });

  const topEmotion = Object.entries(emotions).reduce((a, b) => a[1] > b[1] ? a : b)[0] as Emotion;

  return {
    topEmotion,
    averageConfidence: Math.round(totalConfidence / results.length),
    engagementDistribution: engagementDist,
    cognitiveStateDistribution: cognitiveDist,
  };
}

export default function App() {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [activeSession, setActiveSession] = useState<Session | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [analysisMode, setAnalysisMode] = useState<'face' | 'wallet'>('face');
  const [error, setError] = useState<string | null>(null);
  const webcamRef = useRef<Webcam>(null);

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

    const q = query(
      collection(db, 'sessions'),
      where('userId', '==', user.uid),
      orderBy('startTime', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const sessionData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Session[];
      setSessions(sessionData);
    }, (err) => {
      console.error("Firestore error:", err);
      setError("Failed to load history.");
    });

    return () => unsubscribe();
  }, [user]);

  const startSession = () => {
    if (!user) return;
    const newSession: Session = {
      id: `temp-${Date.now()}`,
      userId: user.uid,
      startTime: Date.now(),
      results: [],
      type: analysisMode
    };
    setActiveSession(newSession);
  };

  const stopSession = async () => {
    if (!activeSession || !user) return;
    
    const metrics = calculateMetrics(activeSession.results);
    const completedSession = {
      userId: user.uid,
      startTime: activeSession.startTime,
      endTime: Date.now(),
      results: activeSession.results,
      metrics,
      type: activeSession.type,
      createdAt: serverTimestamp()
    };

    try {
      await addDoc(collection(db, 'sessions'), completedSession);
      setActiveSession(null);
    } catch (err) {
      console.error("Error saving session:", err);
      setError("Failed to save session to cloud.");
    }
  };

  const capture = useCallback(async () => {
    if (!webcamRef.current || !activeSession) return;
    
    const imageSrc = webcamRef.current.getScreenshot();
    if (!imageSrc) return;

    setIsAnalyzing(true);
    setError(null);

    try {
      const analysis = activeSession.type === 'face' 
        ? await analyzeFace(imageSrc) 
        : await analyzeWallet(imageSrc);
        
      setActiveSession(prev => {
        if (!prev) return null;
        return {
          ...prev,
          results: [...prev.results, analysis],
        };
      });
    } catch (err) {
      setError("Analysis failed. Please try again.");
    } finally {
      setIsAnalyzing(false);
    }
  }, [webcamRef, activeSession]);

  // Real-time analysis loop (every 10 seconds)
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (activeSession) {
      // Initial capture
      capture();
      interval = setInterval(capture, 10000);
    }
    return () => clearInterval(interval);
  }, [activeSession, capture]);

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
              <h1 className="text-xl font-bold tracking-tight">MindMirror <span className="text-indigo-400">AI</span></h1>
              <p className="text-xs text-zinc-500 font-medium uppercase tracking-widest">Cognitive & Object Intelligence</p>
            </div>
          </div>
          
          <div className="flex items-center gap-6">
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

      <main className="max-w-7xl mx-auto px-6 py-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left: Webcam & Controls */}
        <div className="lg:col-span-7 space-y-6">
          <div className="relative group">
            <div className="absolute -inset-1 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-3xl blur opacity-20 group-hover:opacity-30 transition duration-1000"></div>
            <div className="relative bg-zinc-900 rounded-2xl border border-zinc-800 overflow-hidden aspect-video shadow-2xl">
              <Webcam
                audio={false}
                ref={webcamRef}
                screenshotFormat="image/jpeg"
                className="w-full h-full object-cover"
                videoConstraints={{ facingMode: "user" }}
                mirrored={true}
                imageSmoothing={true}
                screenshotQuality={0.92}
                disablePictureInPicture={true}
                forceScreenshotSourceSize={true}
                onUserMedia={() => {}}
                onUserMediaError={() => {}}
              />
              
              {/* Overlay UI */}
              <div className="absolute inset-0 pointer-events-none flex flex-col justify-between p-6">
                <div className="flex justify-between items-start">
                  <div className={cn(
                    "backdrop-blur-md px-3 py-1.5 rounded-full border flex items-center gap-2",
                    activeSession ? "bg-red-500/10 border-red-500/20" : "bg-black/40 border-white/10"
                  )}>
                    <div className={cn("w-2 h-2 rounded-full", activeSession ? "bg-red-500 animate-pulse" : "bg-zinc-500")}></div>
                    <span className="text-[10px] font-bold uppercase tracking-wider">
                      {activeSession ? `${activeSession.type.toUpperCase()} SESSION ACTIVE` : "Standby"}
                    </span>
                  </div>
                  
                  {activeSession?.type === 'wallet' && (
                    <div className="bg-indigo-500/20 backdrop-blur-md border border-indigo-500/30 px-3 py-1.5 rounded-xl flex items-center gap-2">
                      <Search className="w-3.5 h-3.5 text-indigo-400" />
                      <span className="text-[10px] font-bold text-indigo-200">Object Detection Mode</span>
                    </div>
                  )}
                </div>
                
                <div className="flex justify-center gap-4">
                  {!activeSession ? (
                    <button
                      onClick={startSession}
                      className="pointer-events-auto group/btn relative flex items-center gap-3 bg-white text-black px-8 py-4 rounded-2xl font-bold transition-all hover:scale-105 active:scale-95"
                    >
                      <Play className="w-5 h-5 fill-current" />
                      Start {analysisMode === 'face' ? 'Face' : 'Wallet'} Analysis
                    </button>
                  ) : (
                    <div className="flex gap-3 pointer-events-auto">
                      <button
                        onClick={capture}
                        disabled={isAnalyzing}
                        className="flex items-center gap-3 bg-zinc-800 text-white px-6 py-4 rounded-2xl font-bold transition-all hover:bg-zinc-700 disabled:opacity-50"
                      >
                        {isAnalyzing ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Camera className="w-5 h-5" />}
                        {isAnalyzing ? "Analyzing..." : "Manual Capture"}
                      </button>
                      <button
                        onClick={stopSession}
                        className="flex items-center gap-3 bg-red-500 text-white px-6 py-4 rounded-2xl font-bold transition-all hover:bg-red-600"
                      >
                        <Square className="w-5 h-5 fill-current" />
                        Stop & Save
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Session Trends Chart */}
          {activeSession && activeSession.results.length > 1 && (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6"
            >
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-indigo-400" />
                  <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400">Session Trends</h3>
                </div>
              </div>
              <div className="h-[200px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData}>
                    <defs>
                      <linearGradient id="colorConf" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                    <XAxis 
                      dataKey="time" 
                      stroke="#52525b" 
                      fontSize={10} 
                      tickLine={false} 
                      axisLine={false}
                    />
                    <YAxis 
                      stroke="#52525b" 
                      fontSize={10} 
                      tickLine={false} 
                      axisLine={false}
                      domain={[0, 100]}
                    />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#18181b', border: '1px solid #27272a', borderRadius: '12px' }}
                      itemStyle={{ fontSize: '12px' }}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="confidence" 
                      stroke="#6366f1" 
                      fillOpacity={1} 
                      fill="url(#colorConf)" 
                      strokeWidth={2}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="engagement" 
                      stroke="#a855f7" 
                      fillOpacity={0}
                      strokeWidth={2}
                      strokeDasharray="5 5"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </motion.div>
          )}

          {/* Ethics Disclaimer */}
          <div className="p-4 bg-indigo-500/5 border border-indigo-500/10 rounded-2xl flex gap-4 items-start">
            <AlertCircle className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />
            <p className="text-sm text-zinc-400 leading-relaxed">
              <strong className="text-zinc-200">Ethical Notice:</strong> This system uses computer vision to predict emotional and behavioral cues. It does not access private thoughts. Wallet detection is for demonstration purposes.
            </p>
          </div>
        </div>

        {/* Right: Analytics */}
        <div className="lg:col-span-5 space-y-6">
          <AnimatePresence mode="wait">
            {currentResult ? (
              <motion.div
                key="results"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="space-y-6"
              >
                {/* Main Stats */}
                <div className="grid grid-cols-2 gap-4">
                  <StatCard 
                    label="Primary Emotion" 
                    value={currentResult.emotion} 
                    subValue={`${currentResult.confidence}% Confidence`}
                    icon={<Activity className="w-5 h-5 text-indigo-400" />}
                  />
                  <StatCard 
                    label="Engagement" 
                    value={currentResult.engagement} 
                    subValue="Behavioral Tracking"
                    icon={<Brain className="w-5 h-5 text-purple-400" />}
                  />
                </div>

                {/* Wallet Items (Conditional) */}
                {currentResult.walletItems && currentResult.walletItems.length > 0 && (
                  <motion.div 
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6"
                  >
                    <div className="flex items-center gap-2 mb-4">
                      <Wallet className="w-4 h-4 text-indigo-400" />
                      <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400">Predicted Wallet Items</h3>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {currentResult.walletItems.map((item, i) => (
                        <span key={i} className="px-3 py-1.5 bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs font-bold rounded-lg">
                          {item}
                        </span>
                      ))}
                    </div>
                  </motion.div>
                )}

                {/* Cognitive State */}
                <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-8 opacity-5">
                    <Brain className="w-32 h-32" />
                  </div>
                  <h3 className="text-sm font-medium text-zinc-500 mb-4 uppercase tracking-wider">Cognitive State</h3>
                  <div className="flex items-end gap-4">
                    <span className="text-4xl font-bold tracking-tight text-white">{currentResult.cognitiveState}</span>
                    <div className="mb-1.5 px-2 py-0.5 bg-indigo-500/20 text-indigo-300 text-[10px] font-bold rounded uppercase">Detected</div>
                  </div>
                </div>

                {/* Smart Suggestion */}
                <motion.div 
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="bg-gradient-to-br from-indigo-600/20 to-purple-600/20 border border-indigo-500/20 rounded-3xl p-6"
                >
                  <div className="flex items-center gap-3 mb-3">
                    <div className="p-2 bg-indigo-500/20 rounded-lg">
                      {React.createElement(getSuggestion(currentResult).icon === 'Coffee' ? Coffee : 
                        getSuggestion(currentResult).icon === 'Lightbulb' ? Lightbulb : 
                        getSuggestion(currentResult).icon === 'Brain' ? Brain : Activity, 
                        { className: "w-5 h-5 text-indigo-400" })}
                    </div>
                    <h3 className="font-bold text-indigo-100">Smart Suggestion</h3>
                  </div>
                  <p className="text-indigo-200/80 leading-relaxed">
                    {getSuggestion(currentResult).text}
                  </p>
                </motion.div>
              </motion.div>
            ) : (
              <div className="h-[300px] flex flex-col items-center justify-center text-center p-8 bg-zinc-900/50 border border-dashed border-zinc-800 rounded-3xl">
                <div className="w-16 h-16 bg-zinc-800 rounded-full flex items-center justify-center mb-4">
                  <Camera className="w-8 h-8 text-zinc-600" />
                </div>
                <h3 className="text-lg font-medium text-zinc-300">Ready for {analysisMode === 'face' ? 'Face' : 'Wallet'} Session</h3>
                <p className="text-sm text-zinc-500 mt-2">Start a session to begin real-time cloud-synced monitoring.</p>
              </div>
            )}
          </AnimatePresence>
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
