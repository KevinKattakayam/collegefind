'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

export default function SourceUseAssessment({ sourceId, required, status, assessment }: { sourceId: string; required: boolean; status: string; assessment: { reason: string; basisUrl: string | null; assessedAt: Date } | null }) {
  const router = useRouter();
  const [decision, setDecision] = useState<'CLEARED' | 'RESTRICTED' | 'UNRESOLVED'>('UNRESOLVED');
  const [reason, setReason] = useState('');
  const [basisUrl, setBasisUrl] = useState('');
  const [message, setMessage] = useState('');
  const [pending, setPending] = useState(false);
  if (!required) return <p><strong>Source-use check:</strong> No explicit additional source-use assessment is flagged in the stored source record. This is not a legal determination.</p>;

  async function submit() {
    if (pending || reason.trim().length < 8 || (decision === 'CLEARED' && !basisUrl.trim())) return;
    setPending(true); setMessage('Recording separate source-use assessment…');
    try {
      const response = await fetch('/api/admin/source-use', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sourceId, status: decision, reason, basisUrl }) });
      if (!response.ok) { setMessage(response.status === 401 || response.status === 403 ? 'An authorized reviewer is required.' : 'Assessment not recorded. Check the reason and HTTPS basis URL.'); return; }
      setMessage('Source-use assessment recorded in audit history. This is separate from factual approval.');
      router.refresh();
    } catch { setMessage('Request failed; no source-use assessment was confirmed.'); }
    finally { setPending(false); }
  }

  return <section className="my-3 rounded border border-amber-600 p-3" aria-label="Source-use clearance">
    <p><strong>Separate source-use status:</strong> {status}. Factual accuracy and permission/reuse are separate decisions. A clearance must be supported by the source’s actual terms; this control does not infer permission.</p>
    {assessment && <p>Latest assessment: {assessment.reason} · {assessment.assessedAt.toISOString().slice(0, 10)}{assessment.basisUrl ? <> · <a href={assessment.basisUrl} target="_blank" rel="noopener noreferrer">Open recorded basis</a></> : ''}</p>}
    <label>Source-use outcome<select value={decision} onChange={(event) => setDecision(event.target.value as typeof decision)} className="ml-2">
      <option value="UNRESOLVED">Unresolved</option><option value="CLEARED">Clearance established</option><option value="RESTRICTED">Restricted / do not publish</option>
    </select></label>
    <label className="mt-2 block">Terms or license basis URL<input className="block w-full" type="url" value={basisUrl} onChange={(event) => setBasisUrl(event.target.value)} placeholder="Required for clearance; HTTPS URL" /></label>
    <label className="mt-2 block">Reason / basis<input className="block w-full" value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Describe the specific reuse basis or restriction" /></label>
    <button type="button" className="mt-2" disabled={pending || reason.trim().length < 8 || (decision === 'CLEARED' && !basisUrl.trim())} onClick={submit}>Record source-use assessment</button>
    <p role="status" aria-live="polite">{message}</p>
  </section>;
}
