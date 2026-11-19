import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/session';
import AccountClient from './account-client';

export const dynamic = 'force-dynamic';
export default async function AccountPage() {
  const session = await getSessionUser();
  if (!session) redirect('/login?callbackUrl=%2Faccount');
  return <main className="container-main space-y-6 py-8"><header><h1 className="text-3xl font-bold">Account and privacy</h1><p className="mt-2 text-slate-700">Manage your display name, planner timezone and personal data. Email changes are not available here.</p></header><AccountClient /></main>;
}
