import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getSessionUser } from '@/lib/session';
import PlannerClient from './planner-client';
export const dynamic = 'force-dynamic';
export default async function PlannerPage() {
  const user = await getSessionUser();
  if (!user) redirect('/login?callbackUrl=%2Fplanner');
  return <main className="container-main space-y-6 py-8">
    <header><h1 className="text-3xl font-black">Admissions planner</h1><p className="mt-2 text-slate-700">Create private planning drafts for your admissions cycles. Saving a plan does not submit an application or confirm eligibility.</p><Link href="/saved" className="text-indigo-700 underline">View saved colleges</Link></header>
    <PlannerClient />
  </main>;
}
