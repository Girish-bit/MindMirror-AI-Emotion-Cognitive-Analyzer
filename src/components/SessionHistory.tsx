import React from 'react';
import { motion } from 'motion/react';
import { 
  History, 
  Download, 
  X, 
  Calendar, 
  Clock, 
  BarChart3, 
  TrendingUp,
  ChevronRight
} from 'lucide-react';
import { Session } from '../types';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface SessionHistoryProps {
  sessions: Session[];
  onClose: () => void;
}

export default function SessionHistory({ sessions, onClose }: SessionHistoryProps) {
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
    
    // Summary Table
    if (session.metrics) {
      autoTable(doc, {
        startY: 45,
        head: [['Metric', 'Value']],
        body: [
          ['Top Emotion', session.metrics.topEmotion],
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
      `${r.confidence}%`,
      r.engagement,
      r.cognitiveState
    ]);

    autoTable(doc, {
      startY: (doc as any).lastAutoTable.finalY + 15,
      head: [['#', 'Time', 'Emotion', 'Confidence', 'Engagement', 'Cognitive State']],
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
        '© 2026 MindMirror AI Labs - Ethical Cognitive Analysis',
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
      s.metrics?.topEmotion || 'N/A',
      s.metrics?.averageConfidence ? `${s.metrics.averageConfidence}%` : 'N/A',
      s.results.length
    ]);

    autoTable(doc, {
      startY: 35,
      head: [['Date', 'Time Range', 'Top Emotion', 'Avg. Confidence', 'Samples']],
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
        className="bg-zinc-900 border border-zinc-800 w-full max-w-5xl h-full max-h-[85vh] rounded-3xl overflow-hidden flex flex-col shadow-2xl"
      >
        {/* Header */}
        <div className="p-6 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/50 backdrop-blur-xl">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-indigo-500/10 rounded-2xl">
              <History className="w-6 h-6 text-indigo-400" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Session History</h2>
              <p className="text-xs text-zinc-500 font-medium uppercase tracking-widest">Detailed logs & analytics</p>
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
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {sessions.length > 0 ? (
            <div className="grid grid-cols-1 gap-4">
              {sessions.map((session) => (
                <motion.div 
                  key={session.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="group bg-zinc-800/30 border border-zinc-800/50 hover:border-indigo-500/30 rounded-2xl p-6 transition-all hover:bg-zinc-800/50"
                >
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div className="flex items-start gap-4">
                      <div className="p-3 bg-zinc-900 rounded-xl border border-zinc-800 group-hover:border-indigo-500/20 transition-colors">
                        <Calendar className="w-5 h-5 text-zinc-400" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-lg font-bold text-zinc-100">
                            {new Date(session.startTime).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}
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

                    {session.metrics && (
                      <div className="flex flex-wrap items-center gap-4">
                        <div className="px-4 py-2 bg-zinc-900/50 rounded-xl border border-zinc-800/50">
                          <p className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider mb-0.5">Top Emotion</p>
                          <p className="text-sm font-bold text-indigo-300">{session.metrics.topEmotion}</p>
                        </div>
                        <div className="px-4 py-2 bg-zinc-900/50 rounded-xl border border-zinc-800/50">
                          <p className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider mb-0.5">Avg. Confidence</p>
                          <p className="text-sm font-bold text-purple-300">{session.metrics.averageConfidence}%</p>
                        </div>
                        <button 
                          onClick={() => exportToPDF(session)}
                          className="flex items-center gap-2 bg-indigo-500 hover:bg-indigo-600 text-white px-5 py-2.5 rounded-xl text-sm font-bold transition-all shadow-lg shadow-indigo-500/20"
                        >
                          <Download className="w-4 h-4" />
                          PDF
                        </button>
                      </div>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
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
          <p className="text-xs text-zinc-500 font-medium">Total Sessions: {sessions.length}</p>
          <p className="text-xs text-zinc-500 font-medium italic">Data stored locally for this session</p>
        </div>
      </motion.div>
    </motion.div>
  );
}
