import type { Metadata } from 'next';
import { Suspense } from 'react';
import PredictorClient from './PredictorClient';

export const metadata: Metadata = {
  title: 'Admission chance estimator',
  description:
    'Estimate Safe, Target and Reach options from official past closing ranks, using your rank, category, gender and home state. Every estimate shows its data and sources.',
};

export default function PredictorPage() {
  return (
    <Suspense fallback={<div className="container-main py-10">Loading…</div>}>
      <PredictorClient />
    </Suspense>
  );
}
