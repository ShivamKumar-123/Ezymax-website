//! Kalks Academy service (:8098): versioned course content (8 phases x fundamental / technical tracks, exams,
//! glossary) seeded from `content/academy`, per-tenant CMS overrides, learner progress, quizzes, exams and
//! verifiable phase certificates. Internal only: the Client Area and Back Office BFFs call it with
//! `X-Kalks-Internal`; API contract in `api.rs`.

pub mod api;
pub mod cert;
pub mod config;
pub mod content;
pub mod store;
