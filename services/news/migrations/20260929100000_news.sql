-- Ezymex news + economic calendar (services/news). Platform-wide items; per-tenant staff overrides.

CREATE TABLE sources (
    id             text PRIMARY KEY,
    name           text NOT NULL,
    url            text NOT NULL,
    homepage       text NOT NULL DEFAULT '',
    country        text NOT NULL DEFAULT '',
    kind           text NOT NULL,
    interval_secs  int  NOT NULL DEFAULT 600,
    enabled        boolean NOT NULL,
    terms          text NOT NULL DEFAULT '',
    etag           text,
    last_modified  text,
    last_fetch_at  timestamptz,
    last_ok_at     timestamptz,
    last_error     text,
    items_total    int NOT NULL DEFAULT 0,
    updated_by     text,
    updated_at     timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE items (
    id            bigserial PRIMARY KEY,
    dedupe_key    text NOT NULL UNIQUE,
    title_fp      text NOT NULL,
    source_id     text NOT NULL REFERENCES sources(id),
    title         text NOT NULL,
    summary       text NOT NULL DEFAULT '',
    link          text NOT NULL DEFAULT '',
    published_at  timestamptz NOT NULL,
    fetched_at    timestamptz NOT NULL DEFAULT now(),
    countries     text[] NOT NULL DEFAULT '{}',
    currencies    text[] NOT NULL DEFAULT '{}',
    symbols       text[] NOT NULL DEFAULT '{}',
    category      text NOT NULL DEFAULT 'markets',
    sentiment     text NOT NULL DEFAULT 'neutral',
    importance    int  NOT NULL DEFAULT 30
);
CREATE INDEX items_published ON items (published_at DESC);
CREATE INDEX items_title_fp ON items (title_fp, published_at DESC);
CREATE INDEX items_symbols ON items USING gin (symbols);
CREATE INDEX items_countries ON items USING gin (countries);

-- staff decisions per tenant: pin / hide / retag (NULL = keep the automatic tags)
CREATE TABLE item_overrides (
    tenant      text NOT NULL,
    item_id     bigint NOT NULL REFERENCES items(id) ON DELETE CASCADE,
    pinned      boolean NOT NULL DEFAULT false,
    pinned_at   timestamptz,
    hidden      boolean NOT NULL DEFAULT false,
    symbols     text[],
    countries   text[],
    currencies  text[],
    importance  int,
    updated_by  text NOT NULL,
    updated_at  timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (tenant, item_id)
);

CREATE TABLE calendar_events (
    id            bigserial PRIMARY KEY,
    ext_key       text NOT NULL UNIQUE,
    source        text NOT NULL DEFAULT 'forexfactory',
    title         text NOT NULL,
    currency      text NOT NULL,
    country       text NOT NULL DEFAULT '',
    starts_at     timestamptz NOT NULL,
    all_day       boolean NOT NULL DEFAULT false,
    impact        smallint NOT NULL,
    forecast      text NOT NULL DEFAULT '',
    previous      text NOT NULL DEFAULT '',
    actual        text NOT NULL DEFAULT '',
    actual_at     timestamptz,
    actual_source text,
    impact_override smallint,
    symbols       text[] NOT NULL DEFAULT '{}',
    seen_at       timestamptz NOT NULL DEFAULT now(),
    updated_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX calendar_starts ON calendar_events (starts_at);
CREATE INDEX calendar_series ON calendar_events (currency, title, starts_at DESC);

CREATE TABLE calendar_fetches (
    id           text PRIMARY KEY,
    url          text NOT NULL,
    etag         text,
    last_modified text,
    last_fetch_at timestamptz,
    last_ok_at   timestamptz,
    last_error   text,
    events       int NOT NULL DEFAULT 0
);

-- "remind me" on one event, and "alert me before every high-impact event" subscriptions
CREATE TABLE calendar_reminders (
    tenant      text NOT NULL,
    user_id     bigint NOT NULL,
    event_id    bigint NOT NULL REFERENCES calendar_events(id) ON DELETE CASCADE,
    minutes     int NOT NULL DEFAULT 15,
    created_at  timestamptz NOT NULL DEFAULT now(),
    sent_at     timestamptz,
    PRIMARY KEY (tenant, user_id, event_id)
);
CREATE INDEX calendar_reminders_due ON calendar_reminders (event_id) WHERE sent_at IS NULL;

CREATE TABLE calendar_alerts (
    tenant      text NOT NULL,
    user_id     bigint NOT NULL,
    high_impact boolean NOT NULL DEFAULT true,
    currencies  text[] NOT NULL DEFAULT '{}',
    minutes     int NOT NULL DEFAULT 15,
    updated_at  timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (tenant, user_id)
);
CREATE TABLE calendar_alerts_sent (
    tenant   text NOT NULL,
    user_id  bigint NOT NULL,
    event_id bigint NOT NULL REFERENCES calendar_events(id) ON DELETE CASCADE,
    sent_at  timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (tenant, user_id, event_id)
);

-- D138 daily AI market brief, one per server-time day
CREATE TABLE briefs (
    day         date PRIMARY KEY,
    model       text NOT NULL,
    body        jsonb NOT NULL,
    inputs      jsonb NOT NULL DEFAULT '{}',
    created_at  timestamptz NOT NULL DEFAULT now(),
    created_by  text NOT NULL DEFAULT 'scheduler'
);

CREATE TABLE audit (
    id        bigserial PRIMARY KEY,
    tenant    text NOT NULL,
    staff     text NOT NULL,
    action    text NOT NULL,
    target    text NOT NULL,
    detail    jsonb NOT NULL DEFAULT '{}',
    at        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX audit_tenant ON audit (tenant, at DESC);
