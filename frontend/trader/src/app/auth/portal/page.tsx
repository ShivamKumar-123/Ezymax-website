'use client';

/**
 * Login portal — the intermediate "how do you want to sign in?" screen
 * the landing-page Login button now points at. It reuses the exact
 * split-screen chrome of the sign-in page (FullScreenSignup), but the
 * right panel shows two choices instead of the credentials form:
 *   • Login with SwissCresta → the real /auth/login page.
 * (The MT5 option was removed 2026-07-21 per client request.)
 */

import Link from 'next/link';
import Image from 'next/image';
import { ArrowRight } from 'lucide-react';

export default function LoginPortalPage() {
  return (
    <div className="min-h-screen flex items-center justify-center overflow-hidden bg-[#FAFAFA] p-4">
      <div className="w-full relative max-w-5xl rounded-3xl overflow-hidden flex flex-col md:flex-row shadow-2xl ring-1 ring-black/5">
        {/* Decorative orange ball + blurred bands behind the left panel */}
        <div className="absolute inset-0 z-0 pointer-events-none">
          <div className="absolute inset-0 bg-gradient-to-t from-transparent to-black/60" />
          <div className="absolute -bottom-12 -left-8 w-60 h-60 bg-[#E94E1B] rounded-full opacity-90" />
          <div className="absolute -bottom-6 left-32 w-32 h-20 bg-white rounded-full opacity-90 blur-2xl" />
          <div className="absolute bottom-2 left-12 w-32 h-20 bg-white rounded-full opacity-70 blur-xl" />
        </div>

        {/* Left dark hero panel */}
        <div className="bg-black text-white p-8 md:p-12 md:w-1/2 relative overflow-hidden z-10 flex flex-col justify-between min-h-[20rem] md:min-h-[36rem]">
          <Link
            href="/"
            aria-label="SwissCresta home"
            className="inline-flex items-center self-start relative z-10 bg-white/95 rounded-lg px-3 py-1.5"
          >
            <Image
              src="/marketing/swisscresta-logo.png"
              alt="SwissCresta"
              width={220}
              height={48}
              priority
              className="h-8 w-auto"
            />
          </Link>
          <h1 className="text-2xl md:text-3xl font-medium leading-tight tracking-tight relative z-10">
            A Swiss-precision trading platform for serious investors.
          </h1>
        </div>

        {/* Right panel — pick a login method */}
        <div className="p-8 md:p-12 md:w-1/2 flex flex-col justify-center bg-white text-[#0A0A0A] relative z-20">
          <div className="mb-8">
            <p className="text-sm uppercase tracking-wider text-[#E94E1B] font-semibold mb-3">
              Welcome back
            </p>
            <h2 className="text-3xl font-medium mb-2 tracking-tight">Sign in to your account</h2>
            <p className="text-[#5B5B5B]">
              Access your account on the SwissCresta platform.
            </p>
          </div>

          <div className="flex flex-col gap-3">
            {/* Login with SwissCresta → real sign-in page */}
            <Link
              href="/auth/login"
              className="group w-full bg-[#E94E1B] hover:bg-[#C73E11] text-white font-medium py-3.5 px-4 rounded-lg transition-colors inline-flex items-center justify-between gap-2"
            >
              <span>Login with SwissCresta</span>
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </Link>

          </div>

          <div className="mt-8 text-center text-[#5B5B5B] text-sm">
            Don&apos;t have an account yet?{' '}
            <Link
              href="/auth/register"
              className="text-[#0A0A0A] font-medium underline underline-offset-2 hover:text-[#E94E1B]"
            >
              Create one
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
