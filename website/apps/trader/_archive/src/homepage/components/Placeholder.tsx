/**
 * Reserved image area. Renders a dark block with the same footprint the
 * reference gives its artwork, so real images can be dropped in later
 * without moving anything. `photo` uses the lighter grey tone the
 * reference uses for photography and shows a play button.
 */
export function Placeholder({
  className = '',
  label = 'Image',
  photo = false,
  play = false,
}: {
  className?: string;
  label?: string;
  photo?: boolean;
  play?: boolean;
}) {
  return (
    <div className={`kx-placeholder ${photo ? 'kx-placeholder--photo' : ''} ${className}`} aria-hidden>
      <span className="kx-placeholder-label">{label}</span>
      {play && (
        <span className="absolute left-1/2 top-1/2 flex size-[72px] -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-[12px] font-semibold text-[#0a0a0a] shadow-lg">
          Play
        </span>
      )}
    </div>
  );
}
