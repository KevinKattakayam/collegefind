'use client';
import { useState, Suspense } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { safeRedirectPath } from '@/lib/safe-redirect';

const TOO_MANY_ATTEMPTS = 'TooManyAttempts';

function LoginContent() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  // Only same-site relative paths are allowed (prevents open redirects to phishing sites).
  const callbackUrl = safeRedirectPath(searchParams.get('callbackUrl'));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!email || !password) { setError('All fields are required'); return; }
    setLoading(true);
    const result = await signIn('credentials', { email, password, redirect: false });
    setLoading(false);
    if (result?.error === TOO_MANY_ATTEMPTS) setError('Too many sign-in attempts. Please wait 15 minutes and try again.');
    else if (result?.error) setError('Incorrect email or password');
    else router.push(callbackUrl);
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4">
      <div className="bg-white rounded-lg shadow-card-hover p-8 w-full max-w-[400px]">
        <div className="text-center mb-6">
          <Link href="/" className="text-2xl font-bold text-[#1E3A8A] no-underline">🎓 CollegeFind</Link>
          <h1 className="text-xl font-bold text-[#1E293B] mt-4">Welcome Back</h1>
          <p className="text-sm text-[#64748B]">Login to your account</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8]">✉</span>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)}
              placeholder="Email address" className="input-field !pl-10" />
          </div>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8]">🔒</span>
            <input type={showPwd ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)}
              placeholder="Password" className="input-field !pl-10 !pr-10" />
            <button type="button" onClick={() => setShowPwd(!showPwd)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[#94A3B8] text-sm">{showPwd ? '🙈' : '👁'}</button>
          </div>
          <div className="text-right"><span className="text-xs text-[#64748B] cursor-pointer">Forgot Password?</span></div>
          {error && <p className="text-sm text-[#DC2626]">{error}</p>}
          <button type="submit" disabled={loading} className="btn-primary w-full !h-[44px]">
            {loading ? <span className="animate-spin">⟳</span> : 'Login'}
          </button>
        </form>
        <p className="text-center text-sm text-[#64748B] mt-4">
          Don&apos;t have an account? <Link href="/register" className="text-[#2563EB] font-medium no-underline">Register</Link>
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return <Suspense><LoginContent /></Suspense>;
}
