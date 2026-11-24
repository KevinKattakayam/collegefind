'use client';

import { useRef, useState } from 'react';
import { compareHistoricalRank, historicalRank } from '@/lib/historical-rank';

export default function RankComparison({ opening, closing }: { opening: number | null; closing: number }) {
  const rankInput = useRef<HTMLInputElement>(null);
  const [result, setResult] = useState('');
  const [error, setError] = useState('');
  return <form className="mt-5 space-y-3" noValidate onSubmit={(event) => {
    event.preventDefault();
    const input = historicalRank.safeParse(rankInput.current?.value);
    setError(input.success ? '' : 'Enter a whole rank from 1 to 3,000,000.');
    setResult(input.success ? compareHistoricalRank(input.data, opening, closing) : '');
  }}>
    <label className="block max-w-sm">Your rank using the same rank definition
      <input ref={rankInput} className="input-field w-full" inputMode="numeric" aria-describedby="rank-help rank-error" aria-invalid={Boolean(error)} />
    </label>
    <p id="rank-help" className="text-sm">Use the same exam and rank list shown above. The seat category, quota, PwD status and seat pool must apply to your situation for the comparison to be relevant.</p>
    <p id="rank-error" role="alert">{error}</p>
    <button className="btn-primary">Compare historical rank</button>
    <p role="status">{result}</p>
  </form>;
}
