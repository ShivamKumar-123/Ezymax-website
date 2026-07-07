'use client';

import { useParams } from 'next/navigation';
import UserDetail from '@/components/UserDetail';

export default function ReferralUserPage() {
  const params = useParams<{ userId: string }>();
  return <UserDetail userId={params.userId} />;
}
