import { Skeleton } from "@kalks/ui/primitives";

// Shown inside the Client Area shell while a page's server payload is on its way: a link that wasn't prefetched in
// full (in-page links, a revisit after the router cache expired) shows this at once instead of leaving the previous
// page on screen for a server round trip. Neutral: a title block and two rows of cards, like most pages.
export default function Loading() {
  return (
    <div className="pb-16" aria-busy="true">
      <div className="mb-6">
        <Skeleton className="h-8 w-64 max-w-full" />
        <Skeleton className="mt-3 h-4 w-96 max-w-full" />
      </div>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <Skeleton className="h-[320px] rounded-[20px] xl:col-span-8" />
        <Skeleton className="h-[320px] rounded-[20px] xl:col-span-4" />
      </div>
      <Skeleton className="mt-4 h-[200px] w-full rounded-[20px]" />
    </div>
  );
}
