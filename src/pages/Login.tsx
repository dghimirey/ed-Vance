import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Eye, EyeOff } from 'lucide-react';

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
        <div className="w-full max-w-md">
          {/* Centered Heading */}
          <div className="mb-10 text-center">
            <h1 className="text-4xl font-black tracking-tight bg-gradient-to-r from-blue-400 via-indigo-400 to-purple-400 bg-clip-text text-transparent">
              Digital School System
            </h1>
          </div>

          {/* Login Card */}
          <div className="rounded-3xl border border-white/10 bg-white/5 p-8 shadow-2xl backdrop-blur-xl">
            <div className="mb-8">
              <h2 className="text-2xl font-bold">
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
  );
}
