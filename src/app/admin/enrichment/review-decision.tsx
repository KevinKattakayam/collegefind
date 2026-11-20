'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

export default function ReviewDecision({
  id, currentDecisionId, fixture, held, expired, future, conflicted,
}: { id: string; currentDecisionId: string | null; fixture: boolean; held: boolean; expired: boolean; future: boolean; conflicted: boolean }) {
  const router = useRouter();
  const [reason, setReason] = useState('');
  const [message, setMessage] = useState('');
  const [pending, setPending] = useState(false);
  const cannotApprove = fixture || held || expired || future || conflicted;

  async function submit(status: 'APPROVED' | 'REJECTED' | 'PENDING') {
    if (pending) return;
    setPending(true);
    setMessage('Submitting decision…');
    try {
      const response = await fetch('/api/admin/evidence', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind: 'field', id, status, reason, expectedDecisionId: currentDecisionId }),
      });
      if (!response.ok) {
        setMessage(response.status === 401 || response.status === 403
          ? 'Decision denied. An authorized reviewer is required.'
          : 'Decision not recorded. Review the claim state and reason, then try again.');
        return;
      }
      setMessage(`${status === 'APPROVED' ? 'Approval' : status === 'PENDING' ? 'Hold' : 'Rejection'} recorded in the audit history.`);
      router.refresh();
    } catch {
      setMessage('Request failed; no decision was confirmed. Try again.');
    } finally {
      setPending(false);
    }
  }

  return <div className="flex flex-col gap-3">
    <label>Review reason<input className="block w-full" value={reason} onChange={(event) => setReason(event.target.value)} /></label>
    <p>Enter why the source, institution/campus, scope, year and freshness support this decision.</p>
    {cannotApprove && <p role="note">Approval is blocked while this claim is a fixture, held, expired, not yet valid or conflicted. Rejection remains available.</p>}
    <div className="flex flex-wrap gap-2">
      <button disabled={pending || reason.trim().length < 3 || cannotApprove} onClick={() => submit('APPROVED')}>Approve</button>
      <button disabled={pending || reason.trim().length < 3} onClick={() => submit('REJECTED')}>Reject</button>
      <button disabled={pending || reason.trim().length < 3} onClick={() => submit('PENDING')}>Hold</button>
    </div>
    <p role="status" aria-live="polite">{message}</p>
  </div>;
}
