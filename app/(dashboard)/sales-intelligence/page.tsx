import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { getAccessTokenCookie,getAdminFromAccessToken } from '@/server/auth';
import { SalesIntelligenceRouteSkeleton } from '@/components/sales-intelligence/list-skeletons';
import { SalesIntelligenceWorkspace } from '@/components/sales-intelligence/workspace';
export default async function SalesIntelligencePage() {
 const token=getAccessTokenCookie(await cookies());
 const admin=token ? await getAdminFromAccessToken(token) : null;
 if(!admin) redirect('/login');
 if(admin.role!=='owner') redirect('/');
 return <Suspense fallback={<SalesIntelligenceRouteSkeleton/>}><SalesIntelligenceWorkspace/></Suspense>;
}
