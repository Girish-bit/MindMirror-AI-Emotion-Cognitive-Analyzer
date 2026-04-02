import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Brain, ArrowRight, Lock, Mail, Github, Chrome } from 'lucide-react';

interface LoginProps {
  onLogin: (email: string) => void;
}

export default function Login({ onLogin }: LoginProps) {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    // Simulate login delay
    setTimeout(() => {
      onLogin(email || 'demo@mindmirror.ai');
      setIsLoading(false);
    }, 1500);
  };

  return (
    <div className="min-h-screen bg-[#050505] flex items-center justify-center p-6 relative overflow-hidden">
      {/* Background Effects */}
      <div className="absolute top-0 left-0 w-full h-full">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo-600/20 rounded-full blur-[120px] animate-pulse"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-600/20 rounded-full blur-[120px] animate-pulse delay-700"></div>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 pointer-events-none"></div>
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative w-full max-w-md"
      >
        <div className="bg-zinc-900/40 backdrop-blur-2xl border border-white/10 rounded-[2.5rem] p-10 shadow-2xl">
          {/* Logo */}
          <div className="flex flex-col items-center mb-10">
            <motion.div 
              whileHover={{ rotate: 10, scale: 1.1 }}
              className="p-4 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-3xl shadow-lg shadow-indigo-500/20 mb-6"
            >
              <Brain className="w-10 h-10 text-white" />
            </motion.div>
            <h1 className="text-3xl font-bold tracking-tight text-white mb-2">Welcome Back</h1>
            <p className="text-zinc-500 text-sm font-medium">Enter your details to access MindMirror</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-4">
              <div className="relative group">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500 group-focus-within:text-indigo-400 transition-colors" />
                <input 
                  type="email" 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Email Address"
                  className="w-full bg-zinc-800/50 border border-zinc-700/50 rounded-2xl py-4 pl-12 pr-4 text-white placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-all"
                  required
                />
              </div>
              <div className="relative group">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500 group-focus-within:text-indigo-400 transition-colors" />
                <input 
                  type="password" 
                  placeholder="Password"
                  className="w-full bg-zinc-800/50 border border-zinc-700/50 rounded-2xl py-4 pl-12 pr-4 text-white placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-all"
                  required
                />
              </div>
            </div>

            <button 
              type="submit"
              disabled={isLoading}
              className="w-full bg-white text-black font-bold py-4 rounded-2xl flex items-center justify-center gap-2 hover:bg-zinc-200 transition-all active:scale-[0.98] disabled:opacity-50"
            >
              {isLoading ? (
                <div className="w-5 h-5 border-2 border-black/20 border-t-black rounded-full animate-spin"></div>
              ) : (
                <>
                  Continue
                  <ArrowRight className="w-5 h-5" />
                </>
              )}
            </button>
          </form>

          <div className="mt-8">
            <div className="relative mb-8">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-zinc-800"></div>
              </div>
              <div className="relative flex justify-center text-xs uppercase tracking-widest">
                <span className="bg-[#0c0c0c] px-4 text-zinc-600 font-bold">Or continue with</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <button className="flex items-center justify-center gap-3 bg-zinc-800/50 border border-zinc-700/50 py-3 rounded-xl hover:bg-zinc-800 transition-colors">
                <Github className="w-5 h-5 text-white" />
                <span className="text-sm font-medium text-zinc-300">GitHub</span>
              </button>
              <button className="flex items-center justify-center gap-3 bg-zinc-800/50 border border-zinc-700/50 py-3 rounded-xl hover:bg-zinc-800 transition-colors">
                <Chrome className="w-5 h-5 text-white" />
                <span className="text-sm font-medium text-zinc-300">Google</span>
              </button>
            </div>
          </div>
        </div>

        <p className="text-center mt-8 text-zinc-600 text-sm">
          Don't have an account? <a href="#" className="text-indigo-400 font-bold hover:underline">Sign up</a>
        </p>
      </motion.div>
    </div>
  );
}
