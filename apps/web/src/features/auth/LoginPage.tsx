import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Banknote, Lock, Mail, ArrowRight, Shield, AlertCircle } from 'lucide-react';
import { useAuth } from './AuthContext.js';
import { api } from '../../lib/api.js';

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [email, setEmail] = useState('admin@lendora.com');
  const [password, setPassword] = useState('Admin@123');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const res = await api.login({ email, password });
      login(res.token, res.user);
      navigate('/dashboard');
    } catch (err: any) {
      setError(err.message || 'Login failed. Please check credentials.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleQuickLogin = (roleEmail: string) => {
    setEmail(roleEmail);
    setPassword('Admin@123');
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center items-center p-4 relative overflow-hidden">
      {/* Background glow accents */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-brand-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-72 h-72 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md relative z-10">
        {/* Brand Header */}
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-brand-600 to-emerald-400 flex items-center justify-center shadow-xl shadow-brand-500/20 mx-auto mb-4">
            <Banknote className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-black tracking-tight text-white">LENDORA</h1>
          <p className="text-xs text-slate-400 mt-1 font-medium">Loan Management & Customer CRM Platform</p>
        </div>

        {/* Login Card */}
        <div className="glass-panel rounded-2xl p-8 shadow-2xl border border-slate-800">
          <h2 className="text-lg font-bold text-slate-100 mb-1">Sign In to Dashboard</h2>
          <p className="text-xs text-slate-400 mb-6">Enter your authorized staff credentials to continue</p>

          {error && (
            <div className="mb-6 p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center text-xs text-rose-400 space-x-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                Email Address
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="name@lendora.com"
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-900/80 border border-slate-800 rounded-xl text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-900/80 border border-slate-800 rounded-xl text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3 px-4 bg-brand-600 hover:bg-brand-500 active:bg-brand-700 text-white text-sm font-semibold rounded-xl shadow-lg shadow-brand-500/20 flex items-center justify-center space-x-2 transition disabled:opacity-50 mt-2"
            >
              <span>{isSubmitting ? 'Authenticating...' : 'Sign In'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          {/* Quick Role Switcher for Evaluation */}
          <div className="mt-8 pt-6 border-t border-slate-800/80">
            <div className="flex items-center space-x-1.5 text-xs text-slate-400 mb-3 font-semibold uppercase tracking-wider">
              <Shield className="w-3.5 h-3.5 text-brand-400" />
              <span>Quick Login by Role:</span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <button
                type="button"
                onClick={() => handleQuickLogin('admin@lendora.com')}
                className="p-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-lg text-slate-300 text-left transition"
              >
                <div className="font-semibold text-brand-400">Admin</div>
                <div className="text-[10px] text-slate-500 truncate">admin@lendora.com</div>
              </button>
              <button
                type="button"
                onClick={() => handleQuickLogin('manager@lendora.com')}
                className="p-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-lg text-slate-300 text-left transition"
              >
                <div className="font-semibold text-blue-400">Manager</div>
                <div className="text-[10px] text-slate-500 truncate">manager@lendora.com</div>
              </button>
              <button
                type="button"
                onClick={() => handleQuickLogin('agent@lendora.com')}
                className="p-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-lg text-slate-300 text-left transition"
              >
                <div className="font-semibold text-amber-400">Collection Agent</div>
                <div className="text-[10px] text-slate-500 truncate">agent@lendora.com</div>
              </button>
              <button
                type="button"
                onClick={() => handleQuickLogin('accountant@lendora.com')}
                className="p-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-lg text-slate-300 text-left transition"
              >
                <div className="font-semibold text-purple-400">Accountant</div>
                <div className="text-[10px] text-slate-500 truncate">accountant@lendora.com</div>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
