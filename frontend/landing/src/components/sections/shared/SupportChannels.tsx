import { getIcon } from "@/lib/icons";
import { Reveal } from "@/components/ui/Reveal";

type Channel = { label: string; icon: string; note?: string };

export function SupportChannels({ heading, channels }: { heading: string; channels: Channel[] }) {
  return (
    <section className="relative py-10 md:py-14">
      <div className="container-x">
        <Reveal>
          <div className="flex flex-col gap-6 rounded-panel border border-line glass p-6 md:flex-row md:items-center md:justify-between md:p-8">
            <span className="bracket">{heading}</span>
            <ul className="flex flex-wrap gap-2">
              {channels.map((c) => {
                const Icon = getIcon(c.icon);
                return (
                  <li key={c.label} className="inline-flex items-center gap-2 rounded-full border border-line bg-white/[0.03] px-4 py-2 text-sm text-ink">
                    <Icon className="size-4 text-orange-400" />
                    {c.label}
                    {c.note ? <span className="text-xs text-dim">({c.note})</span> : null}
                  </li>
                );
              })}
            </ul>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
