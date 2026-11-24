'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { signOut } from 'next-auth/react';
import Link from 'next/link';

type User = {
  id: string;
  name: string;
  email: string;
  role: 'USER' | 'ADMIN';
  timeZone: string | null;
  createdAt: string;
};

type ApiResponse = { user?: User; error?: string };

export default function AccountClient() {
  const [user, setUser] = useState<User | null>(null);
  const [name, setName] = useState('');
  const [timeZone, setTimeZone] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [sessionExpired, setSessionExpired] = useState(false);

  useEffect(() => {
    let active = true;
    fetch('/api/account', { cache: 'no-store' })
      .then(async response => {
        const data = await response.json() as ApiResponse;
        if (response.status === 401) {
          if (active) {
            setSessionExpired(true);
            setError('Your session expired. Sign in again to manage account settings.');
          }
          return;
        }
        if (!response.ok || !data.user) throw new Error(data.error ?? 'Account details could not be loaded');
        if (active) {
          setUser(data.user);
          setName(data.user.name);
          setTimeZone(data.user.timeZone ?? '');
        }
      })
      .catch(cause => {
        if (active) setError(cause instanceof Error ? cause.message : 'Account details could not be loaded');
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  async function reload() {
    setError('');
    setSessionExpired(false);
    setLoading(true);
    try {
      const response = await fetch('/api/account', { cache: 'no-store' });
      const data = await response.json() as ApiResponse;
      if (response.status === 401) {
        setSessionExpired(true);
        throw new Error('Your session expired. Sign in again to manage account settings.');
      }
      if (!response.ok || !data.user) throw new Error(data.error ?? 'Account details could not be loaded');
      setUser(data.user);
      setName(data.user.name);
      setTimeZone(data.user.timeZone ?? '');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Account details could not be loaded');
    } finally {
      setLoading(false);
    }
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const response = await fetch('/api/account', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name, timeZone: timeZone || null }),
      });
      const data = await response.json() as ApiResponse;
      if (response.status === 401) setSessionExpired(true);
      if (!response.ok || !data.user) {
        throw new Error(response.status === 401 ? 'Your session expired. Sign in again to save account settings.' : data.error ?? 'Settings were not saved');
      }
      setUser(data.user);
      setName(data.user.name);
      setMessage('Account settings saved.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Settings could not be saved.');
    } finally {
      setBusy(false);
    }
  }

  async function deactivate() {
    if (confirmation !== 'DELETE') return;
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/account', {
        method: 'DELETE',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ confirmation }),
      });
      const data = await response.json() as ApiResponse;
      if (response.status === 401) setSessionExpired(true);
      if (!response.ok) {
        throw new Error(response.status === 401 ? 'Your session expired. Sign in again before deactivating your account.' : data.error ?? 'Account deactivation failed');
      }
      await signOut({ callbackUrl: '/' });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Account could not be deactivated.');
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <p role="status">Loading account…</p>;
  if (error && !user) {
    return (
      <div role="alert">
        {error}{' '}
        {sessionExpired ? <Link className="underline" href="/login?callbackUrl=%2Faccount">Sign in</Link> : <button onClick={() => void reload()} className="underline">Retry</button>}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <nav aria-label="Account destinations" className="flex flex-wrap gap-4">
        <Link href="/saved">Saved colleges and comparisons</Link>
        <Link href="/planner">Admissions planner</Link>
        {user?.role === 'ADMIN' && <>
          <Link href="/admin/enrichment">Evidence review</Link>
          <Link href="/admin/community">Community moderation</Link>
        </>}
      </nav>

      <form onSubmit={save} className="max-w-xl space-y-4 rounded-xl border bg-white p-5">
        <h2 className="text-xl font-semibold">Profile settings</h2>
        <label className="block">Display name
          <input className="input-field" required maxLength={100} value={name} onChange={event => setName(event.target.value)} />
        </label>
        <label className="block">Email address
          <input className="input-field" readOnly value={user?.email ?? ''} />
          <span className="text-xs text-slate-600">Email changes require a verified account workflow, which is not configured.</span>
        </label>
        <label className="block">Default planner timezone
          <input className="input-field" maxLength={100} placeholder="Asia/Kolkata" value={timeZone} onChange={event => setTimeZone(event.target.value)} />
          <span className="text-xs text-slate-600">Use an IANA zone such as Asia/Kolkata. Leave blank to use your browser timezone.</span>
        </label>
        <button className="btn-primary" disabled={busy}>Save settings</button>
      </form>

      <section className="max-w-xl rounded-xl border bg-white p-5">
        <h2 className="text-xl font-semibold">Your data</h2>
        <p className="my-2 text-sm">Export includes saved items, plans and your community contributions. It never contains passwords, session tokens or review credentials.</p>
        <a className="btn-outlined inline-flex" href="/api/account/export">Download account data</a>
      </section>

      <section className="max-w-xl rounded-xl border border-red-200 bg-white p-5">
        <h2 className="text-xl font-semibold text-red-800">Deactivate account</h2>
        <p className="my-2 text-sm">Private saved items and plans are removed. Your account is disabled; evidence review audit references are retained. Your community posts are hidden and replaced with a removal notice.</p>
        <label className="block">Type DELETE to confirm
          <input className="input-field" value={confirmation} onChange={event => setConfirmation(event.target.value)} autoComplete="off" />
        </label>
        <button type="button" className="btn-danger mt-3" disabled={busy || confirmation !== 'DELETE'} onClick={() => void deactivate()}>Deactivate and sign out</button>
      </section>
      {error && <p role="alert">{error} {sessionExpired && <Link className="underline" href="/login?callbackUrl=%2Faccount">Sign in</Link>}</p>}
      <p role="status" aria-live="polite">{message}</p>
    </div>
  );
}
