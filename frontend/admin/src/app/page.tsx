'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/authStore';
import { useAuthRehydrated } from '@/hooks/useAuthRehydrated';
import { Loader2 } from 'lucide-react';

export default function RootPage() {
  const router = useRouter();
  const { isAuthenticated } = useAuthStore();
  const authRehydrated = useAuthRehydrated();

  useEffect(() => {
    if (!authRehydrated) return;
    if (isAuthenticated) {
      router.replace('/dashboard');
    } else {
      router.replace('/login');
    }
  }, [authRehydrated, isAuthenticated, router]);

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-bg-primary">
      <Loader2 size={24} className="animate-spin text-text-tertiary" />
    </div>
  );
}
