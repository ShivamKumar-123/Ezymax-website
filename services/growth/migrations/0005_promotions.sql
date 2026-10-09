-- Brand promotions: the banners table also carries events and brand posts, a hero layout (the dashboard carousel),
-- a markdown body and images uploaded to the service. Additive only: every existing banner stays a `card` banner and
-- is served exactly as before.

-- uploaded images (PNG / JPEG / WEBP, sniffed by magic bytes, at most 5 MB), stored privately under
-- GROWTH_STORAGE_DIR (0600 files) and served publicly by an unguessable id (immutable: a new image is a new id)
CREATE TABLE IF NOT EXISTS growth_media (
    id          TEXT PRIMARY KEY,
    tenant      TEXT NOT NULL,
    mime        TEXT NOT NULL CHECK (mime IN ('image/png', 'image/jpeg', 'image/webp')),
    size_bytes  INT NOT NULL CHECK (size_bytes > 0),
    sha256      TEXT NOT NULL,
    path        TEXT NOT NULL,
    created_by  TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- the same file uploaded twice by a tenant is stored once
CREATE UNIQUE INDEX IF NOT EXISTS growth_media_sha_idx ON growth_media (tenant, sha256);

-- banner  = the targeted banner (placement slots); event = a dated event (time range, place or online link);
-- post    = a brand post. Events and posts are listed in the Client Area's "Events & updates" and open a detail page.
-- layout  = card (the banner slot / the updates list) or hero (the dashboard's full-width carousel)
ALTER TABLE banners ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'banner';
ALTER TABLE banners DROP CONSTRAINT IF EXISTS banners_kind_check;
ALTER TABLE banners ADD CONSTRAINT banners_kind_check CHECK (kind IN ('banner', 'event', 'post'));
ALTER TABLE banners ADD COLUMN IF NOT EXISTS layout TEXT NOT NULL DEFAULT 'card';
ALTER TABLE banners DROP CONSTRAINT IF EXISTS banners_layout_check;
ALTER TABLE banners ADD CONSTRAINT banners_layout_check CHECK (layout IN ('card', 'hero'));
-- markdown (rendered as text by the apps, never as HTML)
ALTER TABLE banners ADD COLUMN IF NOT EXISTS content TEXT NOT NULL DEFAULT '';
ALTER TABLE banners ADD COLUMN IF NOT EXISTS event_starts_at TIMESTAMPTZ;
ALTER TABLE banners ADD COLUMN IF NOT EXISTS event_ends_at TIMESTAMPTZ;
-- a place ("Dubai, DIFC") or an online link (https://…)
ALTER TABLE banners ADD COLUMN IF NOT EXISTS location TEXT;
ALTER TABLE banners ADD COLUMN IF NOT EXISTS image_media_id TEXT REFERENCES growth_media(id);
-- removed by staff: kept for the audit trail and the stats, never shown again
ALTER TABLE banners ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS banners_live_idx ON banners (tenant, kind) WHERE active AND deleted_at IS NULL;
