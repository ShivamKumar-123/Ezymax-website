-- Kalks Academy (services/academy, database kalks_academy).
--
-- Content: one table for every node of the course tree (phase > section > chapter, the phase exam and glossary
-- terms). tenant '*' holds the platform default seeded from content/academy/<lang>/ on every start (idempotent
-- upsert by slug + content hash / version). A broker's Back Office edits are copy-on-write rows under its own
-- tenant slug, which win over '*' for that tenant ("reset to default" deletes the override row).

CREATE TABLE content_nodes (
    tenant          text        NOT NULL,
    lang            text        NOT NULL,
    kind            text        NOT NULL CHECK (kind IN ('phase', 'section', 'chapter', 'exam', 'term')),
    slug            text        NOT NULL,
    parent          text        NOT NULL DEFAULT '',
    ord             integer     NOT NULL DEFAULT 0,
    published       boolean     NOT NULL DEFAULT true,
    data            jsonb       NOT NULL,
    source_version  integer     NOT NULL DEFAULT 0,
    source_hash     text        NOT NULL DEFAULT '',
    updated_by      text        NOT NULL DEFAULT '',
    updated_at      timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (tenant, lang, kind, slug)
);
CREATE INDEX content_nodes_parent ON content_nodes (lang, kind, parent);

CREATE TABLE content_audit (
    id          bigserial   PRIMARY KEY,
    tenant      text        NOT NULL,
    staff       text        NOT NULL,
    action      text        NOT NULL,
    kind        text        NOT NULL,
    slug        text        NOT NULL,
    lang        text        NOT NULL,
    detail      jsonb       NOT NULL DEFAULT '{}'::jsonb,
    at          timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX content_audit_tenant ON content_audit (tenant, at DESC);

-- Learner progress (user_id = gateway user id, resolved by the Client Area BFF from the session).
CREATE TABLE chapter_progress (
    tenant        text        NOT NULL,
    user_id       bigint      NOT NULL,
    chapter       text        NOT NULL,
    phase         text        NOT NULL DEFAULT '',
    read_pct      integer     NOT NULL DEFAULT 0 CHECK (read_pct BETWEEN 0 AND 100),
    quiz_best     integer,
    quiz_total    integer,
    attempts      integer     NOT NULL DEFAULT 0,
    completed_at  timestamptz,
    started_at    timestamptz NOT NULL DEFAULT now(),
    updated_at    timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (tenant, user_id, chapter)
);
CREATE INDEX chapter_progress_chapter ON chapter_progress (tenant, chapter);
CREATE INDEX chapter_progress_recent ON chapter_progress (tenant, user_id, updated_at DESC);

CREATE TABLE exam_attempts (
    id          bigserial   PRIMARY KEY,
    tenant      text        NOT NULL,
    user_id     bigint      NOT NULL,
    phase       text        NOT NULL,
    score       integer     NOT NULL,
    total       integer     NOT NULL,
    pct         integer     NOT NULL,
    passed      boolean     NOT NULL,
    answers     jsonb       NOT NULL,
    created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX exam_attempts_user ON exam_attempts (tenant, user_id, phase, created_at DESC);

-- One certificate per learner and phase; `code` is the public verification id.
CREATE TABLE certificates (
    code          text        PRIMARY KEY,
    tenant        text        NOT NULL,
    tenant_name   text        NOT NULL,
    user_id       bigint      NOT NULL,
    learner_name  text        NOT NULL,
    phase         text        NOT NULL,
    phase_order   integer     NOT NULL,
    phase_title   text        NOT NULL,
    level         text        NOT NULL,
    score_pct     integer     NOT NULL,
    issued_at     timestamptz NOT NULL DEFAULT now(),
    revoked       boolean     NOT NULL DEFAULT false,
    UNIQUE (tenant, user_id, phase)
);

-- Days with learning activity (streaks).
CREATE TABLE learning_days (
    tenant   text   NOT NULL,
    user_id  bigint NOT NULL,
    day      date   NOT NULL,
    PRIMARY KEY (tenant, user_id, day)
);
