export default function SectionCard({
  title,
  subtitle,
  action,
  children,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-border-primary bg-card noise-texture">
      <div className="flex items-center justify-between gap-3 border-b border-border-primary px-4 sm:px-5 py-3">
        <div className="min-w-0">
          <h3 className="text-sm font-bold text-text-primary">{title}</h3>
          {subtitle && <p className="text-[11px] text-text-tertiary mt-0.5">{subtitle}</p>}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
      <div className="overflow-x-auto">{children}</div>
    </div>
  );
}
