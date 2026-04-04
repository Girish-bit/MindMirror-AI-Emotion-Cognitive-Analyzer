import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  History, 
  Download, 
  X, 
  Calendar, 
  Clock, 
  BarChart3, 
  TrendingUp,
  ChevronRight,
  ChevronDown,
  PieChart as PieChartIcon,
  Activity,
  Brain
} from 'lucide-react';
import { 
  PieChart, 
  Pie, 
  Cell, 
  ResponsiveContainer, 
  Tooltip as RechartsTooltip,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid
} from 'recharts';
import { Session, Emotion } from '../types';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface SessionHistoryProps {
  sessions: Session[];
  onClose: () => void;
}

const COLORS = ['#6366f1', '#a855f7', '#ec4899', '#f43f5e', '#f59e0b', '#10b981', '#06b6d4'];

export default function SessionHistory({ sessions, onClose }: SessionHistoryProps) {
  const [expandedSession, setExpandedSession] = useState<string | null>(null);

  const globalMetrics = useMemo(() => {
    if (sessions.length === 0) return null;
    
    const emotionCounts: Record<string, number> = {};
    let totalConfidence = 0;
    let totalSamples = 0;

    sessions.forEach(s => {
      if (s.metrics) {
        emotionCounts[s.metrics.topEmotion] = (emotionCounts[s.metrics.topEmotion] || 0) + 1;
        totalConfidence += s.metrics.averageConfidence;
        totalSamples += s.results.length;
      }
    });

    const topEmotion = Object.entries(emotionCounts).reduce((a, b) => a[1] > b[1] ? a : b)[0] as Emotion;
    const avgConfidence = Math.round(totalConfidence / sessions.length);

    return {
      topEmotion,
      avgConfidence,
      totalSamples,
      totalSessions: sessions.length
    };
  }, [sessions]);

  const exportToPDF = (session: Session) => {
    const doc = new jsPDF();
    
    // Header
    doc.setFontSize(22);
    doc.setTextColor(99, 102, 241); // Indigo-500
    doc.text('MindMirror AI: Session Report', 14, 22);
    
    doc.setFontSize(12);
    doc.setTextColor(100);
    doc.text(`Date: ${new Date(session.startTime).toLocaleDateString()}`, 14, 32);
    doc.text(`Time: ${new Date(session.startTime).toLocaleTimeString()} - ${session.endTime ? new Date(session.endTime).toLocaleTimeString() : 'Active'}`, 14, 38);
    doc.text(`Type: ${session.type.toUpperCase()}`, 14, 44);
    
    // Summary Table
    if (session.metrics) {
      autoTable(doc, {
        startY: 50,
        head: [['Metric', 'Value']],
        body: [
          ['Session Grade', session.sessionGrade || 'N/A'],
          ['Total XP Earned', session.totalXp?.toString() || '0'],
          ['Top Emotion', session.metrics.topEmotion],
          ['Average Focus Score', `${session.metrics.averageFocusScore}%`],
          ['Peak Focus Score', `${session.metrics.peakFocusScore}%`],
          ['Average Confidence', `${session.metrics.averageConfidence}%`],
          ['Total Samples', session.results.length.toString()],
        ],
        theme: 'striped',
        headStyles: { fillColor: [99, 102, 241] },
      });
    }

    // Detailed Samples Table
    const tableData = session.results.map((r, index) => [
      index + 1,
      new Date(r.timestamp).toLocaleTimeString(),
      r.emotion,
      `${r.focusScore}%`,
      `${r.bpmEstimate || '--'}`,
      r.cognitiveState,
      r.aiCoachAdvice || 'N/A'
    ]);

    autoTable(doc, {
      startY: (doc as any).lastAutoTable.finalY + 15,
      head: [['#', 'Time', 'Emotion', 'Focus', 'BPM', 'State', 'AI Advice']],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [79, 70, 229] }, // Indigo-600
    });

    // Footer
    const pageCount = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(10);
      doc.setTextColor(150);
      doc.text(
        '© 2026 MindMirror AI Labs - Cloud-Synced Cognitive Analysis',
        14,
        doc.internal.pageSize.getHeight() - 10
      );
    }

    doc.save(`MindMirror_Session_${session.id}.pdf`);
  };

  const exportAllToPDF = () => {
    const doc = new jsPDF();
    
    doc.setFontSize(22);
    doc.setTextColor(99, 102, 241);
    doc.text('MindMirror AI: Full History Report', 14, 22);
    
    const tableData = sessions.map((s) => [
      new Date(s.startTime).toLocaleDateString(),
      `${new Date(s.startTime).toLocaleTimeString()} - ${s.endTime ? new Date(s.endTime).toLocaleTimeString() : 'Active'}`,
      s.type.toUpperCase(),
      s.metrics?.topEmotion || 'N/A',
      s.metrics?.averageConfidence ? `${s.metrics.averageConfidence}%` : 'N/A',
      s.results.length
    ]);

    autoTable(doc, {
      startY: 35,
      head: [['Date', 'Time Range', 'Type', 'Top Emotion', 'Avg. Confidence', 'Samples']],
      body: tableData,
      theme: 'striped',
      headStyles: { fillColor: [99, 102, 241] },
    });

    doc.save('MindMirror_Full_History.pdf');
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-8 bg-black/80 backdrop-blur-md"
    >
      <motion.div 
        initial={{ scale: 0.95, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0, y: 20 }}
        className="bg-zinc-900 border border-zinc-800 w-full max-w-5xl h-full max-h-[90vh] rounded-3xl overflow-hidden flex flex-col shadow-2xl"
      >
        {/* Header */}
        <div className="p-6 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/50 backdrop-blur-xl">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-indigo-500/10 rounded-2xl">
              <History className="w-6 h-6 text-indigo-400" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Latest Session</h2>
              <p className="text-xs text-zinc-500 font-medium uppercase tracking-widest">Most recent cloud-synced analysis</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {sessions.length > 0 && (
              <button 
                onClick={exportAllToPDF}
                className="flex items-center gap-2 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-xl text-sm font-bold transition-all border border-zinc-700/50"
              >
                <Download className="w-4 h-4" />
                Export All
              </button>
            )}
            <button 
              onClick={onClose}
              className="p-2 hover:bg-zinc-800 rounded-full text-zinc-500 hover:text-white transition-all"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-8">
          {sessions.length > 0 ? (
            <>
              <div className="space-y-4">
                <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-widest px-2">Most Recent Analysis</h3>
                {sessions.map((session) => (
                  <motion.div 
                    key={session.id}
                    layout
                    className="bg-zinc-800/30 border border-zinc-800/50 hover:border-indigo-500/30 rounded-2xl overflow-hidden transition-all"
                  >
                    <div className="p-6 flex flex-col md:flex-row md:items-center justify-between gap-6">
                      <div className="flex items-start gap-4">
                        <div className="p-3 bg-zinc-900 rounded-xl border border-zinc-800">
                          <Calendar className="w-5 h-5 text-zinc-400" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-lg font-bold text-zinc-100">
                              {new Date(session.startTime).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}
                            </span>
                            <span className="px-2 py-0.5 bg-indigo-500/10 text-indigo-400 text-[10px] font-bold rounded uppercase border border-indigo-500/20">
                              {session.type}
                            </span>
                            {!session.endTime && (
                              <span className="px-2 py-0.5 bg-red-500/20 text-red-400 text-[10px] font-bold rounded uppercase animate-pulse">Active</span>
                            )}
                          </div>
                          <div className="flex items-center gap-4 text-xs text-zinc-500 font-medium">
                            <div className="flex items-center gap-1.5">
                              <Clock className="w-3.5 h-3.5" />
                              {new Date(session.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} 
                              {session.endTime && ` - ${new Date(session.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}
                            </div>
                            <div className="flex items-center gap-1.5">
                              <BarChart3 className="w-3.5 h-3.5" />
                              {session.results.length} Samples
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        {session.metrics && (
                          <div className="flex items-center gap-4 mr-4">
                            <div className="flex flex-col items-center justify-center w-12 h-12 bg-indigo-500/10 rounded-full border border-indigo-500/20">
                              <span className="text-xs font-bold text-zinc-500 uppercase leading-none mb-1">Grade</span>
                              <span className="text-lg font-black text-indigo-400 leading-none">{session.sessionGrade || 'C'}</span>
                            </div>
                            <div className="text-right">
                              <p className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider">Focus Score</p>
                              <p className="text-sm font-bold text-indigo-300">{session.metrics.averageFocusScore}%</p>
                            </div>
                            <div className="w-px h-8 bg-zinc-800"></div>
                            <div className="text-right">
                              <p className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider">XP Earned</p>
                              <p className="text-sm font-bold text-green-400">+{session.totalXp || 0}</p>
                            </div>
                          </div>
                        )}
                        
                        <button 
                          onClick={() => setExpandedSession(expandedSession === session.id ? null : session.id)}
                          className="p-2 bg-zinc-900 border border-zinc-800 rounded-xl hover:bg-zinc-800 transition-colors"
                        >
                          {expandedSession === session.id ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
                        </button>
                        
                        <button 
                          onClick={() => exportToPDF(session)}
                          className="p-2.5 bg-indigo-500 hover:bg-indigo-600 text-white rounded-xl transition-all shadow-lg shadow-indigo-500/20"
                        >
                          <Download className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Expandable Details */}
                    <AnimatePresence>
                      {expandedSession === session.id && (
                        <motion.div 
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="border-t border-zinc-800 bg-zinc-900/30"
                        >
                          <div className="p-6 grid grid-cols-1 lg:grid-cols-2 gap-8">
                             {/* Focus Score Over Time */}
                             <div className="space-y-4">
                               <div className="flex items-center gap-2">
                                 <Activity className="w-4 h-4 text-indigo-400" />
                                 <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-400">Focus Performance Trend</h4>
                               </div>
                               <div className="h-[200px] w-full">
                                 <ResponsiveContainer width="100%" height="100%">
                                   <AreaChart data={session.results.map(r => ({ time: new Date(r.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), focus: r.focusScore }))}>
                                     <defs>
                                       <linearGradient id="colorFocusHist" x1="0" y1="0" x2="0" y2="1">
                                         <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3}/>
                                         <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                                       </linearGradient>
                                     </defs>
                                     <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                                     <XAxis dataKey="time" stroke="#52525b" fontSize={10} tickLine={false} axisLine={false} />
                                     <YAxis stroke="#52525b" fontSize={10} tickLine={false} axisLine={false} domain={[0, 100]} />
                                     <RechartsTooltip 
                                       contentStyle={{ backgroundColor: '#18181b', border: '1px solid #27272a', borderRadius: '12px' }}
                                       itemStyle={{ fontSize: '12px', color: '#fff' }}
                                     />
                                     <Area type="monotone" dataKey="focus" stroke="#6366f1" fillOpacity={1} fill="url(#colorFocusHist)" strokeWidth={2} />
                                   </AreaChart>
                                 </ResponsiveContainer>
                               </div>
                             </div>

                             {/* BPM Over Time */}
                             <div className="space-y-4">
                               <div className="flex items-center gap-2">
                                 <Activity className="w-4 h-4 text-red-400" />
                                 <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-400">Estimated Heart Rate (BPM)</h4>
                               </div>
                               <div className="h-[200px] w-full">
                                 <ResponsiveContainer width="100%" height="100%">
                                   <AreaChart data={session.results.map(r => ({ time: new Date(r.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), bpm: r.bpmEstimate }))}>
                                     <defs>
                                       <linearGradient id="colorBpmHist" x1="0" y1="0" x2="0" y2="1">
                                         <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.3}/>
                                         <stop offset="95%" stopColor="#f43f5e" stopOpacity={0}/>
                                       </linearGradient>
                                     </defs>
                                     <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                                     <XAxis dataKey="time" stroke="#52525b" fontSize={10} tickLine={false} axisLine={false} />
                                     <YAxis stroke="#52525b" fontSize={10} tickLine={false} axisLine={false} domain={[60, 120]} />
                                     <RechartsTooltip 
                                       contentStyle={{ backgroundColor: '#18181b', border: '1px solid #27272a', borderRadius: '12px' }}
                                       itemStyle={{ fontSize: '12px', color: '#fff' }}
                                     />
                                     <Area type="monotone" dataKey="bpm" stroke="#f43f5e" fillOpacity={1} fill="url(#colorBpmHist)" strokeWidth={2} />
                                   </AreaChart>
                                 </ResponsiveContainer>
                               </div>
                             </div>

                            {/* Cognitive State Summary */}
                            <div className="lg:col-span-2 bg-zinc-900/50 rounded-2xl p-4 border border-zinc-800">
                              <div className="flex items-center gap-2 mb-4">
                                <Brain className="w-4 h-4 text-zinc-400" />
                                <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-400">Cognitive State Breakdown</h4>
                              </div>
                              <div className="flex flex-wrap gap-4">
                                {Object.entries(session.metrics?.cognitiveStateDistribution || {}).map(([state, count]) => (
                                  <div key={state} className="flex items-center gap-2 px-3 py-1.5 bg-zinc-800 rounded-lg border border-zinc-700/50">
                                    <span className="text-xs font-bold text-zinc-200">{state}</span>
                                    <span className="text-[10px] font-bold text-zinc-500 bg-zinc-900 px-1.5 py-0.5 rounded">{count}x</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                ))}
              </div>
            </>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-center p-12">
              <div className="w-20 h-20 bg-zinc-800 rounded-full flex items-center justify-center mb-6">
                <History className="w-10 h-10 text-zinc-600" />
              </div>
              <h3 className="text-xl font-bold text-zinc-300">No History Found</h3>
              <p className="text-zinc-500 mt-2 max-w-xs">Your completed sessions will appear here with detailed analytics and PDF export options.</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-zinc-800 bg-zinc-900/50 flex justify-between items-center">
          <p className="text-xs text-zinc-500 font-medium italic">Only the most recent session is stored to optimize performance</p>
        </div>
      </motion.div>
    </motion.div>
  );
}
