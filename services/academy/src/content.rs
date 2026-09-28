//! Loads the versioned course content from `content/academy/<lang>/` and lints it.
//!
//! Layout (per language):
//! ```text
//! content/academy/en/glossary.yaml                     terms: [{slug, term, category, definition, related[]}]
//! content/academy/en/phase-N/phase.yaml                slug, order, title, level, summary, sections[{slug, track, title, summary}]
//! content/academy/en/phase-N/<track>/NN-name.md        YAML front matter (slug, title, summary, order, version,
//!                                                      takeaways[], practice{label, symbol}?, quiz[]) + markdown body
//! content/academy/en/phase-N/exam.yaml                 pass_mark, version?, questions[] (quiz shape + chapter)
//! ```
//! The same loader feeds the service seed (idempotent upsert on start) and the `academy-lint` binary.

use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::collections::{HashMap, HashSet};
use std::path::{Path, PathBuf};

pub const MIN_CHAPTERS_PER_SECTION: usize = 6;
pub const MIN_WORDS: usize = 600;
pub const MAX_WORDS: usize = 1200;
pub const MIN_GLOSSARY_TERMS: usize = 150;
pub const WORDS_PER_MINUTE: usize = 200;
pub const TRACKS: [&str; 2] = ["fundamental", "technical"];
pub const LEVELS: [&str; 4] = ["Beginner", "Intermediate", "Advanced", "Professional"];
pub const CATEGORIES: [&str; 7] = ["Markets", "Trading mechanics", "Technical analysis", "Fundamental analysis", "Risk management", "Psychology", "Platform"];

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Question {
    pub question: String,
    pub options: Vec<String>,
    pub answer: usize,
    pub explanation: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub chapter: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Practice {
    pub label: String,
    #[serde(default)]
    pub symbol: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
struct ChapterFront {
    slug: String,
    title: String,
    #[serde(default)]
    summary: String,
    #[serde(default)]
    order: i32,
    #[serde(default = "one")]
    version: i32,
    #[serde(default)]
    takeaways: Vec<String>,
    #[serde(default)]
    practice: Option<Practice>,
    #[serde(default)]
    quiz: Vec<Question>,
}

fn one() -> i32 {
    1
}

#[derive(Debug, Clone, Serialize)]
pub struct Chapter {
    pub slug: String,
    pub title: String,
    pub summary: String,
    pub order: i32,
    pub version: i32,
    pub takeaways: Vec<String>,
    pub practice: Option<Practice>,
    pub quiz: Vec<Question>,
    pub body: String,
    pub words: usize,
    pub minutes: usize,
    pub file: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SectionDef {
    pub slug: String,
    pub track: String,
    pub title: String,
    #[serde(default)]
    pub summary: String,
}

#[derive(Debug, Clone, Deserialize)]
struct PhaseFile {
    slug: String,
    order: i32,
    title: String,
    level: String,
    #[serde(default)]
    summary: String,
    sections: Vec<SectionDef>,
    #[serde(default = "one")]
    version: i32,
}

#[derive(Debug, Clone, Serialize)]
pub struct Section {
    pub def: SectionDef,
    pub order: i32,
    pub chapters: Vec<Chapter>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Exam {
    #[serde(default = "pass_mark")]
    pub pass_mark: i32,
    #[serde(default = "one")]
    pub version: i32,
    pub questions: Vec<Question>,
}

fn pass_mark() -> i32 {
    70
}

#[derive(Debug, Clone, Serialize)]
pub struct Phase {
    pub slug: String,
    pub order: i32,
    pub title: String,
    pub level: String,
    pub summary: String,
    pub version: i32,
    pub sections: Vec<Section>,
    pub exam: Option<Exam>,
    pub dir: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Term {
    pub slug: String,
    pub term: String,
    pub category: String,
    pub definition: String,
    #[serde(default)]
    pub related: Vec<String>,
}

#[derive(Debug, Clone, Deserialize)]
struct GlossaryFile {
    terms: Vec<Term>,
}

#[derive(Debug, Clone, Serialize, Default)]
pub struct Bundle {
    pub lang: String,
    pub phases: Vec<Phase>,
    pub glossary: Vec<Term>,
    /// Files that could not be parsed at all (reported as lint errors).
    pub load_errors: Vec<String>,
}

/// Word count of a markdown body: tokens with at least one letter or digit, svg fences excluded.
pub fn word_count(body: &str) -> usize {
    let mut n = 0;
    let mut in_svg = false;
    for line in body.lines() {
        let t = line.trim_start();
        if t.starts_with("```") {
            in_svg = !in_svg && t.starts_with("```svg");
            continue;
        }
        if in_svg {
            continue;
        }
        n += line.split_whitespace().filter(|w| w.chars().any(|c| c.is_alphanumeric())).count();
    }
    n
}

pub fn minutes_for(words: usize) -> usize {
    words.div_ceil(WORDS_PER_MINUTE).max(1)
}

/// Splits `---\n<yaml>\n---\n<body>`.
pub fn split_front_matter(raw: &str) -> Option<(&str, &str)> {
    let raw = raw.strip_prefix('\u{feff}').unwrap_or(raw);
    let rest = raw.strip_prefix("---\n").or_else(|| raw.strip_prefix("---\r\n"))?;
    let end = rest.find("\n---\n").or_else(|| rest.find("\n---\r\n")).or_else(|| rest.strip_suffix("\n---").map(|s| s.len()))?;
    let fm = &rest[..end];
    let body = rest[end + 4..].trim_start_matches(['\r', '\n', '-']);
    Some((fm, body))
}

pub fn parse_chapter(raw: &str, file: &str) -> Result<Chapter, String> {
    let (fm, body) = split_front_matter(raw).ok_or_else(|| format!("{file}: missing YAML front matter"))?;
    let f: ChapterFront = serde_yaml::from_str(fm).map_err(|e| format!("{file}: front matter: {e}"))?;
    let body = body.trim().to_string();
    let words = word_count(&body);
    Ok(Chapter {
        slug: f.slug.trim().to_string(),
        title: f.title.trim().to_string(),
        summary: f.summary.trim().to_string(),
        order: f.order,
        version: f.version,
        takeaways: f.takeaways,
        practice: f.practice,
        quiz: f.quiz,
        minutes: minutes_for(words),
        words,
        body,
        file: file.to_string(),
    })
}

fn sorted_entries(dir: &Path) -> Vec<PathBuf> {
    let mut v: Vec<PathBuf> = std::fs::read_dir(dir).map(|rd| rd.filter_map(|e| e.ok().map(|e| e.path())).collect()).unwrap_or_default();
    v.sort();
    v
}

fn rel(root: &Path, p: &Path) -> String {
    p.strip_prefix(root).unwrap_or(p).display().to_string()
}

/// Languages present under the content root (directories with at least one phase or a glossary).
pub fn languages(root: &Path) -> Vec<String> {
    sorted_entries(root)
        .into_iter()
        .filter(|p| p.is_dir())
        .filter_map(|p| p.file_name().map(|s| s.to_string_lossy().to_string()))
        .filter(|s| s.len() >= 2 && s.len() <= 5 && s.chars().all(|c| c.is_ascii_lowercase() || c == '-'))
        .collect()
}

pub fn load_lang(root: &Path, lang: &str) -> Bundle {
    let base = root.join(lang);
    let mut b = Bundle { lang: lang.to_string(), ..Default::default() };
    for pdir in sorted_entries(&base).into_iter().filter(|p| p.is_dir()) {
        let pf = pdir.join("phase.yaml");
        if !pf.exists() {
            continue;
        }
        let meta: PhaseFile = match std::fs::read_to_string(&pf).map_err(|e| e.to_string()).and_then(|s| serde_yaml::from_str(&s).map_err(|e| e.to_string())) {
            Ok(m) => m,
            Err(e) => {
                b.load_errors.push(format!("{}: {e}", rel(root, &pf)));
                continue;
            }
        };
        let mut sections = Vec::new();
        for (i, def) in meta.sections.iter().enumerate() {
            let sdir = pdir.join(&def.track);
            let mut chapters = Vec::new();
            for f in sorted_entries(&sdir).into_iter().filter(|p| p.extension().is_some_and(|e| e == "md")) {
                let name = rel(root, &f);
                match std::fs::read_to_string(&f).map_err(|e| format!("{name}: {e}")).and_then(|raw| parse_chapter(&raw, &name)) {
                    Ok(c) => chapters.push(c),
                    Err(e) => b.load_errors.push(e),
                }
            }
            chapters.sort_by(|a, b| a.order.cmp(&b.order).then_with(|| a.file.cmp(&b.file)));
            sections.push(Section { def: def.clone(), order: i as i32 + 1, chapters });
        }
        let ef = pdir.join("exam.yaml");
        let exam = if ef.exists() {
            match std::fs::read_to_string(&ef).map_err(|e| e.to_string()).and_then(|s| serde_yaml::from_str::<Exam>(&s).map_err(|e| e.to_string())) {
                Ok(e) => Some(e),
                Err(e) => {
                    b.load_errors.push(format!("{}: {e}", rel(root, &ef)));
                    None
                }
            }
        } else {
            None
        };
        b.phases.push(Phase {
            slug: meta.slug,
            order: meta.order,
            title: meta.title,
            level: meta.level,
            summary: meta.summary,
            version: meta.version,
            sections,
            exam,
            dir: rel(root, &pdir),
        });
    }
    b.phases.sort_by_key(|p| p.order);
    let gf = base.join("glossary.yaml");
    if gf.exists() {
        match std::fs::read_to_string(&gf).map_err(|e| e.to_string()).and_then(|s| serde_yaml::from_str::<GlossaryFile>(&s).map_err(|e| e.to_string())) {
            Ok(g) => b.glossary = g.terms,
            Err(e) => b.load_errors.push(format!("{}: {e}", rel(root, &gf))),
        }
    }
    b
}

pub fn is_slug(s: &str) -> bool {
    !s.is_empty() && s.len() <= 96 && s.chars().all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '-') && !s.starts_with('-') && !s.ends_with('-')
}

/// Stable content hash used by the seed to detect changed files.
pub fn hash_json(v: &serde_json::Value) -> String {
    let d = Sha256::digest(v.to_string().as_bytes());
    d.iter().take(16).map(|b| format!("{b:02x}")).collect()
}

/// Checks one quiz / exam question list. Returns problems prefixed with `ctx`.
pub fn check_questions(ctx: &str, qs: &[Question], out: &mut Vec<String>) {
    for (i, q) in qs.iter().enumerate() {
        let n = i + 1;
        if q.question.trim().is_empty() {
            out.push(format!("{ctx}: question {n} is empty"));
        }
        if !(3..=4).contains(&q.options.len()) {
            out.push(format!("{ctx}: question {n} needs 3-4 options (has {})", q.options.len()));
        }
        if q.answer >= q.options.len() {
            out.push(format!("{ctx}: question {n} answer index {} is out of range", q.answer));
        }
        if q.options.iter().any(|o| o.trim().is_empty()) {
            out.push(format!("{ctx}: question {n} has an empty option"));
        }
        let uniq: HashSet<&str> = q.options.iter().map(|o| o.trim()).collect();
        if uniq.len() != q.options.len() {
            out.push(format!("{ctx}: question {n} has duplicate options"));
        }
        if q.explanation.trim().is_empty() {
            out.push(format!("{ctx}: question {n} has no explanation"));
        }
    }
}

/// Body checks shared by the lint and the CMS (only the supported markdown subset, safe svg).
pub fn check_body(ctx: &str, body: &str, out: &mut Vec<String>) {
    let mut fence: Option<String> = None;
    let mut svg = String::new();
    for (i, line) in body.lines().enumerate() {
        let t = line.trim_start();
        if t.starts_with("```") {
            match fence.take() {
                Some(kind) => {
                    if kind == "svg" {
                        check_svg(&format!("{ctx}: svg ending line {}", i + 1), &svg, out);
                        svg.clear();
                    }
                }
                None => fence = Some(t.trim_start_matches('`').trim().to_string()),
            }
            continue;
        }
        if let Some(k) = &fence {
            if k == "svg" {
                svg.push_str(line);
                svg.push('\n');
            }
            continue;
        }
        if t.starts_with("# ") {
            out.push(format!("{ctx}: line {} uses an H1 (the title is rendered separately)", i + 1));
        }
        if t.starts_with('<') && t.chars().nth(1).is_some_and(|c| c.is_ascii_alphabetic() || c == '/') {
            out.push(format!("{ctx}: line {} contains raw HTML (only svg fences are allowed)", i + 1));
        }
        if t.contains("](http") || t.contains("![") {
            out.push(format!("{ctx}: line {} contains an external link or image", i + 1));
        }
    }
    if fence.is_some() {
        out.push(format!("{ctx}: unclosed code fence"));
    }
}

pub fn check_svg(ctx: &str, svg: &str, out: &mut Vec<String>) {
    let low = svg.to_ascii_lowercase();
    if !low.contains("<svg") || !low.contains("</svg>") {
        out.push(format!("{ctx}: not a complete <svg> element"));
    }
    for bad in ["<script", "foreignobject", "<image", "href=\"http", "href='http", "javascript:", " on", "@import", "url(http"] {
        let hit = if bad == " on" { low.split_whitespace().any(|w| w.starts_with("on") && w.contains('=')) } else { low.contains(bad) };
        if hit {
            out.push(format!("{ctx}: forbidden svg content `{}`", bad.trim()));
        }
    }
}

#[derive(Debug, Default, Serialize)]
pub struct Counts {
    pub phases: usize,
    pub sections: usize,
    pub chapters: usize,
    pub words: usize,
    pub quizzes: usize,
    pub quiz_questions: usize,
    pub exams: usize,
    pub exam_questions: usize,
    pub glossary_terms: usize,
    pub diagrams: usize,
}

pub fn counts(b: &Bundle) -> Counts {
    let mut c = Counts { phases: b.phases.len(), glossary_terms: b.glossary.len(), ..Default::default() };
    for p in &b.phases {
        c.sections += p.sections.len();
        if let Some(e) = &p.exam {
            c.exams += 1;
            c.exam_questions += e.questions.len();
        }
        for s in &p.sections {
            for ch in &s.chapters {
                c.chapters += 1;
                c.words += ch.words;
                if !ch.quiz.is_empty() {
                    c.quizzes += 1;
                }
                c.quiz_questions += ch.quiz.len();
                c.diagrams += ch.body.matches("```svg").count();
            }
        }
    }
    c
}

/// Full content lint. `errors` fail CI; `warnings` are advisory.
pub fn lint(b: &Bundle) -> (Vec<String>, Vec<String>) {
    let mut errors = b.load_errors.clone();
    let mut warnings = Vec::new();
    let mut slugs: HashMap<String, String> = HashMap::new();
    let mut claim = |slug: &str, what: String, errors: &mut Vec<String>| {
        if !is_slug(slug) {
            errors.push(format!("{what}: invalid slug `{slug}` (lowercase letters, digits and dashes)"));
        }
        if let Some(prev) = slugs.insert(slug.to_string(), what.clone()) {
            errors.push(format!("{what}: duplicate slug `{slug}` (also {prev})"));
        }
    };
    if b.phases.is_empty() {
        errors.push(format!("{}: no phases found", b.lang));
    }
    let mut orders = HashSet::new();
    for p in &b.phases {
        claim(&p.slug, format!("{}/phase.yaml", p.dir), &mut errors);
        if !orders.insert(p.order) {
            errors.push(format!("{}: duplicate phase order {}", p.dir, p.order));
        }
        if !LEVELS.contains(&p.level.as_str()) {
            errors.push(format!("{}: level `{}` must be one of {:?}", p.dir, p.level, LEVELS));
        }
        if p.title.trim().is_empty() || p.summary.trim().is_empty() {
            errors.push(format!("{}: phase title and summary are required", p.dir));
        }
        let tracks: HashSet<&str> = p.sections.iter().map(|s| s.def.track.as_str()).collect();
        for t in TRACKS {
            if !tracks.contains(t) {
                errors.push(format!("{}: missing the {t} section", p.dir));
            }
        }
        let mut phase_chapters = HashSet::new();
        for s in &p.sections {
            claim(&s.def.slug, format!("{} section {}", p.dir, s.def.track), &mut errors);
            if !TRACKS.contains(&s.def.track.as_str()) {
                errors.push(format!("{}: section track `{}` must be fundamental or technical", p.dir, s.def.track));
            }
            if s.chapters.len() < MIN_CHAPTERS_PER_SECTION {
                errors.push(format!("{}/{}: {} chapters (minimum {MIN_CHAPTERS_PER_SECTION})", p.dir, s.def.track, s.chapters.len()));
            }
            let mut ord = HashSet::new();
            for ch in &s.chapters {
                let ctx = ch.file.clone();
                claim(&ch.slug, ctx.clone(), &mut errors);
                phase_chapters.insert(ch.slug.clone());
                if !ord.insert(ch.order) {
                    errors.push(format!("{ctx}: duplicate order {}", ch.order));
                }
                if ch.title.trim().is_empty() || ch.summary.trim().is_empty() {
                    errors.push(format!("{ctx}: title and summary are required"));
                }
                if ch.body.trim().is_empty() {
                    errors.push(format!("{ctx}: empty body"));
                }
                if ch.words < MIN_WORDS || ch.words > MAX_WORDS {
                    errors.push(format!("{ctx}: {} words (expected {MIN_WORDS}-{MAX_WORDS})", ch.words));
                }
                if ch.quiz.is_empty() {
                    errors.push(format!("{ctx}: no quiz"));
                } else if !(3..=5).contains(&ch.quiz.len()) {
                    errors.push(format!("{ctx}: quiz has {} questions (expected 3-5)", ch.quiz.len()));
                }
                check_questions(&ctx, &ch.quiz, &mut errors);
                if !(3..=5).contains(&ch.takeaways.len()) {
                    warnings.push(format!("{ctx}: {} key takeaways (expected 3-5)", ch.takeaways.len()));
                }
                if ch.takeaways.iter().any(|t| t.trim().is_empty()) {
                    errors.push(format!("{ctx}: empty key takeaway"));
                }
                if !ch.body.contains("\n## ") && !ch.body.starts_with("## ") {
                    warnings.push(format!("{ctx}: no ## section headings"));
                }
                check_body(&ctx, &ch.body, &mut errors);
            }
        }
        match &p.exam {
            None => errors.push(format!("{}: missing exam.yaml", p.dir)),
            Some(e) => {
                let ctx = format!("{}/exam.yaml", p.dir);
                if e.questions.len() < 10 {
                    errors.push(format!("{ctx}: {} questions (minimum 10)", e.questions.len()));
                }
                if !(50..=100).contains(&e.pass_mark) {
                    errors.push(format!("{ctx}: pass_mark {} must be 50-100", e.pass_mark));
                }
                check_questions(&ctx, &e.questions, &mut errors);
                for (i, q) in e.questions.iter().enumerate() {
                    if let Some(c) = &q.chapter
                        && !phase_chapters.contains(c)
                    {
                        warnings.push(format!("{ctx}: question {} refers to unknown chapter `{c}`", i + 1));
                    }
                }
            }
        }
    }
    // glossary
    if b.glossary.len() < MIN_GLOSSARY_TERMS {
        errors.push(format!("{}/glossary.yaml: {} terms (minimum {MIN_GLOSSARY_TERMS})", b.lang, b.glossary.len()));
    }
    let mut gslugs = HashSet::new();
    for t in &b.glossary {
        let ctx = format!("glossary `{}`", t.slug);
        if !is_slug(&t.slug) {
            errors.push(format!("{ctx}: invalid slug"));
        }
        if !gslugs.insert(t.slug.clone()) {
            errors.push(format!("{ctx}: duplicate term slug"));
        }
        if t.term.trim().is_empty() || t.definition.trim().is_empty() {
            errors.push(format!("{ctx}: empty term or definition"));
        }
        if !CATEGORIES.contains(&t.category.as_str()) {
            errors.push(format!("{ctx}: category `{}` must be one of {:?}", t.category, CATEGORIES));
        }
    }
    for t in &b.glossary {
        for r in &t.related {
            if !gslugs.contains(r) {
                warnings.push(format!("glossary `{}`: related term `{r}` does not exist", t.slug));
            }
        }
    }
    (errors, warnings)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn front_matter_and_words() {
        let raw = "---\nslug: \"a-b\"\ntitle: \"T\"\nsummary: \"S\"\norder: 2\nquiz:\n  - question: \"Q?\"\n    options: [\"a\", \"b\", \"c\"]\n    answer: 1\n    explanation: \"E\"\n---\n\nHello world, this is 1.0850.\n\n```svg\n<svg viewBox=\"0 0 1 1\"><text>not counted</text></svg>\n```\n\n## Two - words\n";
        let c = parse_chapter(raw, "x.md").unwrap();
        assert_eq!(c.slug, "a-b");
        assert_eq!(c.order, 2);
        assert_eq!(c.version, 1);
        assert_eq!(c.quiz[0].answer, 1);
        assert_eq!(c.words, 7); // Hello world, this is 1.0850. + Two words ("-" and "##" excluded)
        assert_eq!(c.minutes, 1);
    }

    #[test]
    fn body_checks() {
        let mut out = vec![];
        check_body("c", "# Title\n\n<div>x</div>\n\n```svg\n<svg><script>1</script></svg>\n```\n", &mut out);
        assert_eq!(out.len(), 3, "{out:?}");
        let mut ok = vec![];
        check_body("c", "## A\n\nText with 1 < 2 and **bold**.\n\n```svg\n<svg viewBox=\"0 0 10 10\"><rect width=\"100%\" height=\"100%\" fill=\"#121216\"/></svg>\n```\n", &mut ok);
        assert!(ok.is_empty(), "{ok:?}");
    }

    #[test]
    fn slugs() {
        assert!(is_slug("p1-f-what-is-a-market"));
        assert!(!is_slug("P1"));
        assert!(!is_slug("-a"));
        assert!(!is_slug(""));
    }
}
