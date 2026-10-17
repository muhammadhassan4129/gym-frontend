import React, { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import {
  Dumbbell,
  User,
  LockKeyhole,
  Eye,
  EyeOff,
  ArrowRight,
  Loader2,
  AlertCircle,
  Users,
  Receipt,
  BarChart3,
} from 'lucide-react';
import PwaControls from '../components/PwaControls';

import authService from '../services/authService';

const focusClass =
  'focus-visible:outline-none focus-visible:ring-2 ' +
  'focus-visible:ring-lime-300 focus-visible:ring-offset-2 ' +
  'focus-visible:ring-offset-[#14191e]';

function Login({ setIsAuth }) {
  const navigate = useNavigate();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const submittingRef = useRef(false);
  const usernameRef = useRef(null);
  const passwordRef = useRef(null);

  async function handleLogin(event) {
    event.preventDefault();

    if (submittingRef.current) return;

    setError('');

    if (!username.trim()) {
      setError('Enter your username.');
      usernameRef.current?.focus();
      return;
    }

    // Do not trim passwords: spaces may be intentional.
    if (!password) {
      setError('Enter your password.');
      passwordRef.current?.focus();
      return;
    }

    submittingRef.current = true;
    setLoading(true);

    try {
      await authService.login({
        username: username.trim(),
        password,
      });

      setPassword('');
      setIsAuth(true);
      navigate('/', { replace: true });
    } catch (requestError) {
      setError(
        requestError?.response?.data?.message ||
          requestError?.message ||
          'Unable to sign in. Please try again.'
      );
    } finally {
      submittingRef.current = false;
      setLoading(false);
    }
  }

  const features = [
    {
      icon: Users,
      title: 'Know your members',
      description:
        'Keep profiles, subscriptions and member details organized.',
    },
    {
      icon: Receipt,
      title: 'Keep payments clear',
      description:
        'Track monthly invoices, partial payments and outstanding dues.',
    },
    {
      icon: BarChart3,
      title: 'See the bigger picture',
      description:
        'Review collections, operating costs and financial reports.',
    },
  ];

  return (
    <main className="relative isolate flex min-h-screen min-h-[100dvh] items-center justify-center overflow-hidden bg-[#0b0e11] px-4 py-8 font-sans text-zinc-100 sm:px-6 lg:px-10">
      {/* Decorative background */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -left-40 -top-40 h-96 w-96 rounded-full bg-lime-300/5 blur-3xl"
      />

      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-40 -right-40 h-96 w-96 rounded-full bg-lime-300/5 blur-3xl"
      />

      <div className="relative grid w-full max-w-6xl overflow-hidden rounded-3xl border border-white/10 bg-[#10151a] shadow-2xl lg:grid-cols-2">
        {/* Brand panel */}
        <section className="relative hidden flex-col justify-between overflow-hidden border-r border-white/10 bg-[#141b15] p-10 lg:flex xl:p-12">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -right-24 top-20 h-80 w-80 rounded-full border border-lime-300/10"
          />

          <div
            aria-hidden="true"
            className="pointer-events-none absolute -right-12 top-32 h-56 w-56 rounded-full border border-lime-300/10"
          />

          <div className="relative">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-lime-300 text-zinc-950">
                <Dumbbell size={27} aria-hidden="true" />
              </div>

              <div>
                <p className="text-xl font-extrabold tracking-tight text-white">
                  Gym Master
                </p>

                <p className="mt-1 text-[9px] font-semibold uppercase tracking-[0.2em] text-zinc-500">
                  Management studio
                </p>
              </div>
            </div>

            <div className="mt-20">
              <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-lime-300">
                Built for the everyday grind
              </p>

              <h2 className="mt-5 text-5xl font-extrabold leading-tight tracking-tight text-white">
                Stronger members.
                <br />
                <span className="text-lime-300">
                  Smarter management.
                </span>
              </h2>

              <p className="mt-5 max-w-sm text-sm leading-7 text-zinc-400">
                Spend less time managing paperwork and more time
                building a gym people love.
              </p>
            </div>

            <div className="mt-10 space-y-6">
              {features.map((feature) => {
                const Icon = feature.icon;

                return (
                  <div key={feature.title} className="flex gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-lime-300/15 bg-lime-300/5 text-lime-300">
                      <Icon size={19} aria-hidden="true" />
                    </div>

                    <div>
                      <h3 className="text-sm font-semibold text-zinc-200">
                        {feature.title}
                      </h3>

                      <p className="mt-1 max-w-xs text-xs leading-relaxed text-zinc-500">
                        {feature.description}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <p className="relative mt-12 border-t border-white/10 pt-5 text-[10px] uppercase tracking-widest text-zinc-500">
            Your gym. Your people. Your progress.
          </p>
        </section>

        {/* Login form */}
        <section className="flex flex-col justify-center px-6 py-10 sm:px-10 sm:py-14 lg:px-12">
          {/* Mobile brand */}
          <div className="mb-10 flex items-center gap-3 lg:hidden">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-lime-300 text-zinc-950">
              <Dumbbell size={24} aria-hidden="true" />
            </div>

            <div>
              <p className="text-lg font-bold text-white">
                Gym Master
              </p>

              <p className="mt-0.5 text-[9px] uppercase tracking-widest text-zinc-500">
                Management studio
              </p>
            </div>
          </div>

          <div className="w-full max-w-sm self-center">
            <div className="mb-8">
              <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-lime-300">
                <LockKeyhole size={22} aria-hidden="true" />
              </div>

              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-lime-300">
                Admin workspace
              </p>

              <h1 className="mt-3 text-3xl font-bold tracking-tight text-white sm:text-4xl">
                Welcome back.
              </h1>

              <p className="mt-3 text-sm leading-relaxed text-zinc-400">
                Sign in to manage your gym.
              </p>
            </div>

            {error && (
              <div
                id="login-error"
                role="alert"
                className="mb-6 flex items-start gap-2.5 rounded-xl border border-red-300/20 bg-red-300/5 p-3.5 text-xs leading-relaxed text-red-200"
              >
                <AlertCircle
                  size={17}
                  className="mt-0.5 shrink-0"
                  aria-hidden="true"
                />

                <p>{error}</p>
              </div>
            )}

            <PwaControls />
            <form
              onSubmit={handleLogin}
              noValidate
              aria-busy={loading}
              aria-describedby={error ? 'login-error' : undefined}
              className="space-y-5"
            >
              {/* Username */}
              <div>
                <label
                  htmlFor="login-username"
                  className="mb-2 block text-xs font-semibold text-zinc-300"
                >
                  Username
                </label>

                <div className="relative">
                  <User
                    size={18}
                    aria-hidden="true"
                    className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500"
                  />

                  <input
                    ref={usernameRef}
                    id="login-username"
                    name="username"
                    type="text"
                    value={username}
                    onChange={(event) => {
                      setUsername(event.target.value);
                      setError('');
                    }}
                    autoComplete="username"
                    autoCapitalize="none"
                    spellCheck={false}
                    placeholder="Enter your username"
                    disabled={loading}
                    required
                    className="min-h-12 w-full rounded-xl border border-white/10 bg-[#0b1015] py-3 pl-11 pr-4 text-sm text-white outline-none transition placeholder:text-zinc-600 focus:border-lime-300/60 focus:ring-2 focus:ring-lime-300/10 disabled:opacity-60"
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <label
                  htmlFor="login-password"
                  className="mb-2 block text-xs font-semibold text-zinc-300"
                >
                  Password
                </label>

                <div className="relative">
                  <LockKeyhole
                    size={18}
                    aria-hidden="true"
                    className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500"
                  />

                  <input
                    ref={passwordRef}
                    id="login-password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(event) => {
                      setPassword(event.target.value);
                      setError('');
                    }}
                    autoComplete="current-password"
                    placeholder="Enter your password"
                    disabled={loading}
                    required
                    className="min-h-12 w-full rounded-xl border border-white/10 bg-[#0b1015] py-3 pl-11 pr-12 text-sm text-white outline-none transition placeholder:text-zinc-600 focus:border-lime-300/60 focus:ring-2 focus:ring-lime-300/10 disabled:opacity-60"
                  />

                  <button
                    type="button"
                    onClick={() => setShowPassword((previous) => !previous)}
                    disabled={loading}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    aria-pressed={showPassword}
                    className={`absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-2 text-zinc-500 hover:text-lime-300 disabled:opacity-40 ${focusClass}`}
                  >
                    {showPassword ? (
                      <EyeOff size={18} aria-hidden="true" />
                    ) : (
                      <Eye size={18} aria-hidden="true" />
                    )}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className={`inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-lime-300 px-5 py-3 text-sm font-bold text-zinc-950 transition hover:bg-lime-200 disabled:cursor-not-allowed disabled:opacity-50 ${focusClass}`}
              >
                {loading ? (
                  <>
                    <Loader2
                      size={18}
                      className="animate-spin motion-reduce:animate-none"
                      aria-hidden="true"
                    />
                    Signing in...
                  </>
                ) : (
                  <>
                    Sign in
                    <ArrowRight size={18} aria-hidden="true" />
                  </>
                )}
              </button>
            </form>

            <p className="mt-6 text-center text-xs leading-relaxed text-zinc-500">
              Use the admin credentials provided for your gym.
            </p>

            <div className="mt-10 flex items-center justify-between border-t border-white/10 pt-5 text-[10px] text-zinc-600">
              <span>Gym Master</span>
              <span>Management workspace</span>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

export default Login;