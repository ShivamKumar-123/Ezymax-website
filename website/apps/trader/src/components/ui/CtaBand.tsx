import type { ReactNode } from 'react';
import { REGISTER_HREF } from '@/lib/crm';
import { Button } from '@/components/ui/Button';
import { CircleCta } from '@/components/ui/CircleCta';
import { Headline } from '@/components/motion/Headline';
import { RiskNote } from '@/components/ui/RiskNote';
import { Art, type ArtName } from '@/components/ui/Art';
import { PhotoSlot, type PhotoKey } from '@/components/ui/PhotoSlot';

/** Closing call to action used at the foot of most pages. */
export function CtaBand({
  lines = ['Your next trade', 'starts here.'],
  lead = 'Open an account in minutes, practise on demo, then fund with USDT and trade on live.',
  primary = { label: 'Open account', href: REGISTER_HREF },
  secondary = { label: 'Try a free demo', href: REGISTER_HREF },
  options = false,
  art = 'burst',
  photo,
  extra,
}: {
  lines?: ReactNode[];
  lead?: ReactNode;
  primary?: { label: string; href: string };
  secondary?: { label: string; href: string } | null;
  options?: boolean;
  art?: ArtName;
  photo?: PhotoKey;
  extra?: ReactNode;
}) {
  return (
    <section className="section pt-0" aria-label="Get started">
      <div className="container-site">
        <div className="relative isolate overflow-hidden rounded-[36px] border border-white/10 px-6 py-16 sm:px-12 sm:py-20 lg:px-16 lg:py-24">
          {photo ? (
            <PhotoSlot slot={photo} alt="" className="!absolute inset-0 -z-10" sizes="(min-width: 1360px) 1360px, 100vw" position="center" />
          ) : (
            <Art name={art} alt="" className="!absolute inset-0 -z-10" sizes="(min-width: 1360px) 1360px, 100vw" position="70% center" />
          )}
          <div className="absolute inset-0 -z-10 bg-[linear-gradient(100deg,rgba(7,7,10,0.92)_0%,rgba(7,7,10,0.7)_55%,rgba(7,7,10,0.35)_100%)]" />
          <div className="grid items-end gap-12 lg:grid-cols-[1fr_auto]">
            <div className="flex flex-col gap-7">
              <Headline lines={lines} className="t-display max-w-[14ch]" />
              <p className="t-lead max-w-xl" data-reveal>
                {lead}
              </p>
              <div className="flex flex-wrap gap-3" data-reveal>
                <Button href={primary.href}>
                  {primary.label}
                </Button>
                {secondary && (
                  <Button href={secondary.href} variant="outline">
                    {secondary.label}
                  </Button>
                )}
              </div>
              {extra}
              <RiskNote options={options} />
            </div>
            <CircleCta href={REGISTER_HREF} className="hidden lg:grid" size={168} uid="band" />
          </div>
        </div>
      </div>
    </section>
  );
}
