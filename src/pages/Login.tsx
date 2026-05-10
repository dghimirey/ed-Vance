import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Eye,
  EyeOff,
  BarChart3,
  BellRing,
  ShieldCheck,
} from 'lucide-react';

import logo from '../../logo.png';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const { signIn } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    setLoading(true);
    setError('');

    const { error } = await signIn(email, password);

    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      navigate('/');
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#0B1020] text-white">
      {/* Background Glow */}
      <div className="absolute top-[-120px] left-[-120px] h-[320px] w-[320px] rounded-full bg-blue-500/20 blur-3xl" />
      <div className="absolute bottom-[-120px] right-[-120px] h-[320px] w-[320px] rounded-full bg-purple-500/20 blur-3xl" />

      <div className="relative z-10 flex min-h-screen items-center justify-center px-4 py-10">
        <div className="grid w-full max-w-6xl overflow-hidden rounded-3xl border border-white/10 bg-white/5 shadow-2xl backdrop-blur-xl lg:grid-cols-2">
          
          {/* Left Side */}
          <div className="hidden flex-col justify-between bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-600 p-10 lg:flex">
            <div>
              <div className="mb-8 flex items-center gap-4">
                <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-white/10 p-3 backdrop-blur-md shadow-lg border border-white/20">
                  <img
                    src={logo}
                    alt="Digital School System"
                    className="h-full w-full object-contain"
                  />
                </div>

                <div>
                  <h1 className="text-3xl font-black tracking-tight">
                    Digital School System
                  </h1>

                  <p className="mt-1 text-sm text-blue-100">
                    Smart Academic Analytics Platform
                  </p>
                </div>
              </div>

              <div className="space-y-5 mt-12">
                <div className="flex items-start gap-4 rounded-2xl bg-white/10 p-4 border border-white/10 backdrop-blur-md">
                  <div className="rounded-xl bg-white/10 p-2">
                    <BarChart3 className="h-5 w-5" />
                  </div>

                  <div>
                    <h3 className="font-semibold">
                      Performance Analytics
                    </h3>

                    <p className="text-sm text-blue-100">
                      Track subject-wise progress, compare exams, and identify weak subjects automatically.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-4 rounded-2xl bg-white/10 p-4 border border-white/10 backdrop-blur-md">
                  <div className="rounded-xl bg-white/10 p-2">
                    <BellRing className="h-5 w-5" />
                  </div>

                  <div>
                    <h3 className="font-semibold">
                      Smart Academic Alerts
                    </h3>

                    <p className="text-sm text-blue-100">
                      Get intelligent notifications about attendance, marks, and improvement trends.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-4 rounded-2xl bg-white/10 p-4 border border-white/10 backdrop-blur-md">
                  <div className="rounded-xl bg-white/10 p-2">
                    <ShieldCheck className="h-5 w-5" />
                  </div>

                  <div>
                    <h3 className="font-semibold">
                      Secure School Management
                    </h3>

                    <p className="text-sm text-blue-100">
                      Centralized platform for students, teachers, parents, and administration.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <p className="text-sm text-blue-100">
              Designed for modern educational institutions with analytics-first architecture.
            </p>
          </div>

          {/* Right Side */}
          <div className="flex items-center justify-center bg-[#111827]/80 p-6 sm:p-10">
            <div className="w-full max-w-md">
              
              {/* Mobile Logo */}
              <div className="mb-8 text-center lg:hidden">
                <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-blue-500 to-purple-500 p-3 shadow-2xl">
                  <img
                    src={logo}
                    alt="Logo"
                    className="h-full w-full object-contain"
                  />
                </div>

                <h1 className="text-3xl font-black">
                  Digital School System
                </h1>

                <p className="mt-2 text-gray-400">
                  Smart Academic Management Platform
                </p>
              </div>

              {/* Login Card */}
              <div className="rounded-3xl border border-white/10 bg-white/5 p-8 shadow-2xl backdrop-blur-xl">
                <div className="mb-8">
                  <h2 className="text-3xl font-bold">
                    Welcome Back
                  </h2>

                  <p className="mt-2 text-gray-400">
                    Sign in to continue to your dashboard.
                  </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-5">
                  {error && (
                    <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-300">
                      {error}
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label
                      htmlFor="email"
                      className="text-sm font-medium text-gray-300"
                    >
                      Email Address
                    </Label>

                    <Input
                      id="email"
                      type="email"
                      placeholder="you@school.edu.np"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      required
                      autoComplete="email"
                      className="h-12 rounded-xl border-white/10 bg-white/5 text-white placeholder:text-gray-500 focus:border-purple-500 focus:ring-purple-500"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label
                      htmlFor="password"
                      className="text-sm font-medium text-gray-300"
                    >
                      Password
                    </Label>

                    <div className="relative">
                      <Input
                        id="password"
                        type={showPassword ? 'text' : 'password'}
                        placeholder="Enter your password"
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        required
                        autoComplete="current-password"
                        className="h-12 rounded-xl border-white/10 bg-white/5 pr-11 text-white placeholder:text-gray-500 focus:border-purple-500 focus:ring-purple-500"
                      />

                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 transition hover:text-white"
                      >
                        {showPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </div>

                  <Button
                    type="submit"
                    disabled={loading}
                    className="h-12 w-full rounded-xl bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500 text-sm font-semibold shadow-lg transition-all duration-300 hover:scale-[1.01] hover:from-blue-600 hover:to-purple-600"
                  >
                    {loading ? 'Signing in...' : 'Sign In'}
                  </Button>
                </form>

                <div className="mt-8 border-t border-white/10 pt-5 text-center">
                  <p className="text-xs text-gray-500">
                    Presented by Diamond Ghimire, Sachin Kharel and Bishal Paudel.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
