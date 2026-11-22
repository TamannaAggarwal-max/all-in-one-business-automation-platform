import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Lock, Mail, Store } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

export function LoginPage() {
  const { loginWithEmail, loginWithGoogle } = useAuth();
  const { showError, showSuccess } = useToast();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const user = await loginWithEmail(email, password);
      showSuccess(`Signed in as ${user.fullName}`);
      navigate(user.role === 'SALES_EMPLOYEE' ? '/leads' : '/dashboard');
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Unable to sign in');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDemoFill = async () => {
    setEmail('demo@bizpilot.app');
    setPassword('Demo@12345');
    setSubmitting(true);
    try {
      const user = await loginWithEmail('demo@bizpilot.app', 'Demo@12345');
      showSuccess(`Signed in to ${user.businessName} Demo Workspace`);
      navigate('/dashboard');
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Demo sign-in failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setSubmitting(true);
    try {
      const user = await loginWithGoogle();
      showSuccess(`Welcome back, ${user.fullName}`);
      navigate(user.role === 'SALES_EMPLOYEE' ? '/leads' : '/dashboard');
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Google sign-in failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col lg:flex-row">
      {/* Left Brand Panel */}
      <div className="lg:w-5/12 bg-slate-950 text-white p-8 sm:p-12 flex flex-col justify-between">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-sky-500 text-slate-950 flex items-center justify-center font-display font-bold text-sm">
              BP
            </div>
            <span className="font-display font-bold text-xl tracking-tight">BizPilot</span>
          </div>
          <p className="text-sky-400 text-sm font-medium mt-8">Your Business, Automated.</p>
          <h1 className="font-display text-3xl sm:text-4xl font-bold tracking-tight mt-3 text-balance leading-tight">
            One operating system for leads, automation, products, and your storefront.
          </h1>
          <p className="text-slate-300 text-sm sm:text-base mt-5 leading-relaxed max-w-md">
            Capture inquiries from WhatsApp, web forms, and calls, automate follow-ups, publish branded storefronts, and turn catalog data into AI-assisted growth.
          </p>
        </div>

        <div className="mt-10 pt-8 border-t border-slate-800 space-y-4">
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-400">Public Demo Storefront</span>
            <Link
              to="/store/atelier-nord"
              className="inline-flex items-center gap-1.5 text-sky-400 hover:text-sky-300 font-medium"
            >
              <Store className="w-4 h-4" />
              <span>Visit Atelier Nord</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
          <div className="rounded-lg bg-slate-900 border border-slate-800 p-4 text-xs text-slate-300 space-y-1">
            <p className="font-semibold text-white">Demo Admin Credentials</p>
            <p className="font-mono">Email: demo@bizpilot.app</p>
            <p className="font-mono">Password: Demo@12345</p>
          </div>
        </div>
      </div>

      {/* Right Sign-in Form */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-md bg-white border border-slate-200 rounded-xl p-6 sm:p-8">
          <h2 className="font-display text-2xl font-bold text-slate-900">Sign in to BizPilot</h2>
          <p className="text-sm text-slate-600 mt-1">
            Access your business CRM, automations, and catalog.
          </p>

          <div className="mt-6 space-y-3">
            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={submitting}
              className="w-full flex items-center justify-center gap-2.5 px-4 py-2.5 rounded-lg border border-slate-300 bg-white text-slate-800 text-sm font-medium hover:bg-slate-50 transition-colors disabled:opacity-50"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" aria-hidden="true">
                <path
                  fill="#4285F4"
                  d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17Z"
                />
                <path
                  fill="#34A853"
                  d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.11-6.72-4.96H1.29v3.14C3.26 21.3 7.31 24 12 24Z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.28 14.24c-.24-.72-.38-1.49-.38-2.24s.14-1.52.38-2.24V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.99-3.14Z"
                />
                <path
                  fill="#EA4335"
                  d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.99 3.14c.95-2.85 3.6-4.96 6.72-4.96Z"
                />
              </svg>
              <span>Continue with Google</span>
            </button>

            <button
              type="button"
              onClick={handleDemoFill}
              disabled={submitting}
              className="w-full px-4 py-2.5 rounded-lg bg-sky-50 border border-sky-200 text-sky-900 text-sm font-medium hover:bg-sky-100 transition-colors disabled:opacity-50"
            >
              One-Click Demo Admin Login (Atelier Nord)
            </button>
          </div>

          <div className="my-6 flex items-center gap-3">
            <div className="h-px flex-1 bg-slate-200" />
            <span className="text-xs text-slate-400">or sign in with email</span>
            <div className="h-px flex-1 bg-slate-200" />
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                Email Address
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@company.com"
                  className="w-full pl-9 pr-3 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-sky-600"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">Password</label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-9 pr-3 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-sky-600"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-2.5 px-4 rounded-lg bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 transition-colors disabled:opacity-50"
            >
              {submitting ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-slate-600">
            New to BizPilot?{' '}
            <Link to="/register" className="font-medium text-sky-600 hover:text-sky-700">
              Create your business workspace
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
