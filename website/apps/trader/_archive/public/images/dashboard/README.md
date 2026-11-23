# Dashboard assets

Everything the trader dashboard (`/dashboard`) renders as an image or a
custom icon lives here, so dashboard artwork is never mixed in with the
marketing-site banners that fill the rest of `public/images/`.

```
public/images/dashboard/          ← images (banners, illustrations, cards)
public/images/dashboard/icons/    ← icons (custom SVG/PNG, not lucide)
```

## Referencing a file

The `public/` folder is served from the site root, so drop the
`public/` prefix and keep the rest of the path:

| File on disk                                        | Use this in code            |
| --------------------------------------------------- | --------------------------- |
| `public/images/dashboard/promo.png`                  | `/images/dashboard/promo.png`       |
| `public/images/dashboard/icons/wallet.svg`           | `/images/dashboard/icons/wallet.svg`|

```tsx
import Image from 'next/image';

<Image
  src="/images/dashboard/promo.png"
  alt=""
  aria-hidden
  fill
  sizes="(max-width: 768px) 100vw, 50vw"
  className="object-cover"
/>
```

## Why not `public/dashboard/`

`/dashboard` is a real app route (`src/app/dashboard/page.tsx`). A public
folder of the same name would put static files on URLs that sit under a
routed path — it works today, but the day anyone adds a
`/dashboard/[something]` route the two start competing for the same URL
space. Nesting under `images/` keeps assets and routes in separate
namespaces.

## Notes

- Prefer `next/image` over a bare `<img>`: it serves a resized, modern
  format per viewport. The source PNGs elsewhere in this folder tree run
  1–2 MB each and are delivered at roughly a tenth of that.
- Name files for what they are, not where they sit — `margin-empty.png`
  survives a layout change, `card3.png` does not.
- Icons that exist in `lucide-react` should come from the package rather
  than being added here as files; this folder is for marks lucide has no
  equivalent for.
