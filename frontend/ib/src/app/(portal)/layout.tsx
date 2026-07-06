'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import PortalShell from '@/components/PortalShell';
import { ibToken } from '@/lib/api';

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [ok, setOk] = useState(false);

  useEffect(() => {
    if (!ibToken()) {
      router.replace('/login');
      return;
    }
    setOk(true);
  }, [router]);

  if (!ok) return null;
  return <PortalShell>{children}</PortalShell>;
}
