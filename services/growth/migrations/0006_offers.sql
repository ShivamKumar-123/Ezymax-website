-- Offers: a promotion the broker publishes as artwork with its own page in the Client Area, where every live
-- offer is listed and a client is told when one they have not seen yet arrives.
--
-- An offer is a banner. It wants exactly what a banner already has - a title, a body, artwork uploaded to the
-- service, a call to action, a run of dates, targeting by country / KYC / account type / how new the client is,
-- a priority and an audit trail - so it is a fourth `kind` rather than a second table. What differs is where it
-- appears: not in a placement slot but on its own page, so `placement` is ignored for it the way it is for
-- events and posts. Whether it ALSO rides the dashboard carousel is the layout's business, as for everything else.

ALTER TABLE banners DROP CONSTRAINT IF EXISTS banners_kind_check;
ALTER TABLE banners ADD CONSTRAINT banners_kind_check CHECK (kind IN ('banner', 'event', 'post', 'offer'));

-- `poster` layout: finished artwork shown whole in the dashboard carousel, with nothing written over it. The
-- apps have served this since the Diwali banner; the constraint never allowed it to be saved.
ALTER TABLE banners DROP CONSTRAINT IF EXISTS banners_layout_check;
ALTER TABLE banners ADD CONSTRAINT banners_layout_check CHECK (layout IN ('card', 'hero', 'poster'));

-- the Offers page reads every live offer for a tenant, and the rail asks for the same list on a poll
CREATE INDEX IF NOT EXISTS banners_offers_idx ON banners (tenant, priority DESC, id DESC)
    WHERE kind = 'offer' AND active AND deleted_at IS NULL;

-- "have I shown this client this offer yet" is answered per offer, for one client, on every page load
CREATE INDEX IF NOT EXISTS banner_events_seen_idx ON banner_events (user_id, kind, banner_id);
