// Press-in warm-ups for links into the social screens from elsewhere (the More tab rows), so the hub, PAMM and MAM
// open on fresh content. Same keys and fetchers as the screens (src/features/social/api.ts).
import { prefetch } from "@/lib/query";
import { fetchers, keys, leaderboardPath, shared, socialGet, type Leaderboard } from "./api";
import { filtersStore } from "./state";

export const prefetchSocial = {
  /** the leaderboard with the reader's filters, and their copies */
  hub: () => {
    const f = filtersStore.get();
    const key = keys.leaderboard(f);
    prefetch(key, shared(key, () => socialGet<Leaderboard>(leaderboardPath(f))), { persist: true });
    prefetch(keys.subs, fetchers.subs, { persist: true });
  },
  pamm: () => {
    prefetch(keys.funds, fetchers.funds, { persist: true });
    prefetch(keys.investments, fetchers.investments, { persist: true });
  },
  mam: () => {
    prefetch(keys.links, fetchers.links, { persist: true });
    prefetch(keys.managers, fetchers.managers, { persist: true });
  },
};
