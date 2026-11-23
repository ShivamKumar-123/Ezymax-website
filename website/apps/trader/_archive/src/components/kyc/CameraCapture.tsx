'use client';

/**
 * Webcam capture for KYC (client 2026-06-16). On a laptop the file input only
 * opens a file picker (`capture` is mobile-only), so the camera never opens.
 * This component opens the webcam via getUserMedia, lets the user snap a photo,
 * and hands back a JPEG File — same shape as a file upload.
 */
import { useCallback, useRef, useState } from 'react';
import { Camera, X } from 'lucide-react';

export default function CameraCapture({
  onCapture,
  facingMode = 'user',
  label = 'Use camera',
}: {
  onCapture: (file: File) => void;
  facingMode?: 'user' | 'environment';
  label?: string;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setOpen(false);
  }, []);

  const start = useCallback(async () => {
    setError(null);
    setOpen(true);
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('unsupported');
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode },
        audio: false,
      });
      streamRef.current = stream;
      // Attach after the <video> is in the DOM.
      requestAnimationFrame(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
        }
      });
    } catch (e: any) {
      setError(
        e?.name === 'NotAllowedError' || e?.name === 'SecurityError'
          ? 'Camera permission denied. Allow camera access in your browser settings and try again.'
          : e?.name === 'NotFoundError'
            ? 'No camera found on this device. Upload a file or continue on your phone.'
            : 'Could not open the camera. Upload a file or continue on your phone.',
      );
    }
  }, [facingMode]);

  const capture = useCallback(() => {
    const v = videoRef.current;
    if (!v || !v.videoWidth) return;
    const canvas = document.createElement('canvas');
    canvas.width = v.videoWidth;
    canvas.height = v.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(v, 0, 0);
    canvas.toBlob(
      (blob) => {
        if (blob) {
          onCapture(new File([blob], `kyc_capture_${Date.now()}.jpg`, { type: 'image/jpeg' }));
        }
        stop();
      },
      'image/jpeg',
      0.9,
    );
  }, [onCapture, stop]);

  return (
    <>
      <button
        type="button"
        onClick={start}
        className="inline-flex items-center gap-1.5 text-xs font-medium text-accent hover:underline"
      >
        <Camera size={14} /> {label}
      </button>

      {open && (
        <div className="fixed inset-0 z-[60] bg-black/85 flex items-center justify-center p-4" onClick={stop}>
          <div className="bg-bg-secondary border border-border-primary rounded-2xl p-4 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-bold text-text-primary">Take a photo</p>
              <button type="button" onClick={stop} className="p-1 rounded-md hover:bg-bg-hover text-text-tertiary"><X size={16} /></button>
            </div>
            {error ? (
              <p className="text-sm text-red-400 py-8 text-center leading-relaxed">{error}</p>
            ) : (
              <video ref={videoRef} playsInline muted className="w-full rounded-xl bg-black aspect-video object-cover" />
            )}
            <div className="flex justify-center gap-2 mt-3">
              <button type="button" onClick={stop} className="px-4 py-2 rounded-xl text-xs font-medium text-text-secondary border border-border-primary hover:bg-bg-hover">
                Cancel
              </button>
              {!error && (
                <button type="button" onClick={capture} className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-accent hover:opacity-90">
                  Capture
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
