import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/session';
import CommunityModeration from './moderation-client';
export const dynamic='force-dynamic';
export default async function CommunityPage(){const user=await getSessionUser();if(!user)redirect('/login?callbackUrl=%2Fadmin%2Fcommunity');if(user.role!=='ADMIN')return <main className="container-main py-8"><h1>Access denied</h1><p>An administrator account is required to moderate reports.</p><Link href="/">Return home</Link></main>;return <main className="container-main py-8"><header><h1 className="text-3xl font-bold">Community moderation</h1><p className="my-2">Reported questions and answers are user opinions, never verified CollegeFind information. Moderator actions are audited.</p><Link href="/admin/enrichment" className="underline">Evidence review</Link></header><CommunityModeration/></main>}
