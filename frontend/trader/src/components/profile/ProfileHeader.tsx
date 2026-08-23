'use client';

/**
 * Profile hub header — cover banner, avatar with photo upload, name,
 * email, KYC chip. Photos are resized client-side to a 256px JPEG data
 * URI and stored via PUT /profile { avatar } (the existing field).
 */
import { useRef, useState } from 'react';
import { Camera, Loader2, ShieldCheck, ShieldAlert } from 'lucide-react';
import toast from 'react-hot-toast';
import { clsx } from 'clsx';
import { motion } from 'framer-motion';
import api from '@/lib/api/client';

export interface ProfileHeaderProfile {
  email: string;
  first_name?: string | null;
  last_name?: string | null;
  country?: string | null;
  city?: string | null;
  kyc_status?: string | null;
  avatar?: string | null;
  created_at?: string | null;
}

async function fileToAvatarDataUri(file: File, size = 256): Promise<string> {
  const img = document.createElement('img');
  const url = URL.createObjectURL(file);
  await new Promise<void>((res, rej) => { img.onload = () => res(); img.onerror = () => rej(new Error('bad image')); img.src = url; });
  const canvas = document.createElement('canvas');
  canvas.width = size; canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const s = Math.min(img.width, img.height);
  ctx.drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, size, size);
  URL.revokeObjectURL(url);
  return canvas.toDataURL('image/jpeg', 0.86);
}

export default function ProfileHeader({
  profile, onAvatarSaved,
}: { profile: ProfileHeaderProfile | null; onAvatarSaved: () => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const name = [profile?.first_name, profile?.last_name].filter(Boolean).join(' ') || profile?.email?.split('@')[0] || 'Trader';
  const initials = name.slice(0, 2).toUpperCase();
  const kyc = (profile?.kyc_status || 'pending').toLowerCase();
  const verified = kyc === 'approved' || kyc === 'verified';
  const avatar = profile?.avatar && (profile.avatar.startsWith('data:') || profile.avatar.startsWith('http') || profile.avatar.startsWith('/'))
    ? profile.avatar : null;

  const pick = async (f: File | undefined) => {
    if (!f) return;
    if (!f.type.startsWith('image/')) { toast.error('Please choose an image'); return; }
    setUploading(true);
    try {
      const uri = await fileToAvatarDataUri(f);
      await api.put('/profile', { avatar: uri });
      toast.success('Profile photo updated');
      onAvatarSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Upload failed');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  return (
    <motion.section
      initial={{ opacity: 0, y: 18, scale: 0.985 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      className="relative overflow-hidden rounded-[24px]"
      style={{ background: 'var(--bg-card)' }}
    >
      {/* Cover — dashboard artwork under a dark-to-transparent veil so the
          avatar + name stay legible in both themes. */}
      <div className="relative h-44 sm:h-56 overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <motion.img
          src="/assets/dashboard_banner_ny.png"
          alt=""
          initial={{ scale: 1.08 }}
          animate={{ scale: 1 }}
          transition={{ duration: 1.4, ease: [0.22, 1, 0.36, 1] }}
          className="absolute inset-0 h-full w-full object-cover object-[70%_40%]"
        />
        <div aria-hidden className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.15)_0%,rgba(0,0,0,0.4)_50%,rgba(0,0,0,0.92)_100%)]" />
        <div aria-hidden className="absolute inset-0 bg-[linear-gradient(90deg,rgba(0,0,0,0.55)_0%,rgba(0,0,0,0)_60%)]" />
      </div>
      <div className="relative px-5 sm:px-7 pb-5">
        <div className="-mt-12 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex items-end gap-4">
            <div className="relative">
              <div className="h-24 w-24 rounded-full ring-4 ring-[var(--bg-card)] overflow-hidden bg-crx-yellow flex items-center justify-center text-2xl font-bold text-white shadow-[0_10px_30px_rgba(0,0,0,0.45)]">
                {avatar ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={avatar} alt="" className="h-full w-full object-cover" />
                ) : initials}
              </div>
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                aria-label="Change profile photo"
                className="absolute -bottom-1 -right-1 flex h-9 w-9 items-center justify-center rounded-full bg-crx-charcoal text-crx-charcoal-ink ring-2 ring-[var(--bg-card)] hover:bg-crx-charcoal-hover transition-colors"
              >
                {uploading ? <Loader2 size={15} className="animate-spin" /> : <Camera size={15} />}
              </button>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => void pick(e.target.files?.[0])} />
            </div>
            <div className="pb-1 min-w-0">
              <h1 className="text-xl sm:text-2xl font-bold text-white drop-shadow-[0_2px_10px_rgba(0,0,0,0.6)] truncate">{name}</h1>
              <p className="text-sm text-text-secondary truncate">{profile?.email}</p>
              {(profile?.city || profile?.country) && (
                <p className="text-xs text-text-tertiary mt-0.5">{[profile?.city, profile?.country].filter(Boolean).join(', ')}</p>
              )}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 sm:pb-1">
            <span
              className={clsx(
                'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold',
                verified ? 'bg-emerald-500/15 text-emerald-500' : 'bg-crx-yellow-soft text-[#C73E11]',
              )}
            >
              {verified ? <ShieldCheck size={13} /> : <ShieldAlert size={13} />}
              {verified ? 'KYC verified' : `KYC ${kyc.replace('_', ' ')}`}
            </span>
            {profile?.created_at && (
              <span className="rounded-full bg-bg-card-nested px-3 py-1.5 text-xs text-text-secondary">
                Member since {new Date(profile.created_at).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}
              </span>
            )}
          </div>
        </div>
      </div>
    </motion.section>
  );
}
