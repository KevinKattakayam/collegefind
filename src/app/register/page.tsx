'use client';
import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { ApiClientError, postJson } from '@/lib/api';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function RegisterPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const validate = () => {
    const e: Record<string, string> = {};
    if (!name.trim()) e.name = 'Name is required';
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) e.email = 'Valid email is required';
    if (!password || password.length < 10) e.password = 'Password must be at least 10 characters';
    else if (new TextEncoder().encode(password).length > 72) e.password = 'Password must be at most 72 bytes';
    if (password !== confirmPwd) e.confirmPwd = 'Passwords do not match';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);
    setServerError('');
    try {
      await postJson('/api/auth/register', { name, email, password });
      const result = await signIn('credentials', { email, password, redirect: false });
      if (result?.error) {
        router.push('/login');
        return;
      }
      router.push('/colleges');
    } catch (err) {
      if (err instanceof ApiClientError && err.details) setErrors(err.details);
      setServerError(err instanceof Error ? err.message : 'Something went wrong');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4">
      <div className="bg-white rounded-lg shadow-card-hover p-8 w-full max-w-[400px]">
        <div className="text-center mb-6">
          <Link href="/" className="text-2xl font-bold text-[#1E3A8A] no-underline">🎓 CollegeFind</Link>
          <h1 className="text-xl font-bold text-[#1E293B] mt-4">Create Account</h1>
          <p className="text-sm text-[#64748B]">Join CollegeFind today</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8]">👤</span>
              <input type="text" value={name} onChange={e => setName(e.target.value)}
                placeholder="Full Name" className="input-field !pl-10" />
            </div>
            {errors.name && <p className="text-xs text-[#DC2626] mt-1">{errors.name}</p>}
          </div>
          <div>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8]">✉</span>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                placeholder="Email address" className="input-field !pl-10" />
            </div>
            {errors.email && <p className="text-xs text-[#DC2626] mt-1">{errors.email}</p>}
          </div>
          <div>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8]">🔒</span>
              <input type={showPwd ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)}
                placeholder="Password (8+ characters)" className="input-field !pl-10 !pr-10" />
              <button type="button" onClick={() => setShowPwd(!showPwd)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#94A3B8] text-sm">{showPwd ? '🙈' : '👁'}</button>
            </div>
            {errors.password && <p className="text-xs text-[#DC2626] mt-1">{errors.password}</p>}
          </div>
          <div>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8]">🔒</span>
              <input type="password" value={confirmPwd} onChange={e => setConfirmPwd(e.target.value)}
                placeholder="Confirm Password" className="input-field !pl-10" />
            </div>
            {errors.confirmPwd && <p className="text-xs text-[#DC2626] mt-1">{errors.confirmPwd}</p>}
          </div>
          {serverError && <p className="text-sm text-[#DC2626]">{serverError}</p>}
          <button type="submit" disabled={loading} className="btn-primary w-full !h-[44px]">
            {loading ? <span className="animate-spin">⟳</span> : 'Create Account'}
          </button>
        </form>
        <p className="text-center text-sm text-[#64748B] mt-4">
          Already have an account? <Link href="/login" className="text-[#2563EB] font-medium no-underline">Login</Link>
        </p>
      </div>
    </div>
  );
}
