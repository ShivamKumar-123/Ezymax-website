//! Content lint for content/academy: `cargo run -p academy --bin academy-lint [-- <content dir>] [--json]`.
//! Exits 1 on any error (section < 6 chapters, chapter without a quiz, empty / duplicate slugs, word counts
//! outside 600-1200, invalid quiz answers, unsafe svg, glossary < 150 terms, …).

use academy::content::{counts, languages, lint, load_lang};
use std::path::PathBuf;

fn main() {
    let args: Vec<String> = std::env::args().skip(1).collect();
    let json = args.iter().any(|a| a == "--json");
    let root = args.iter().find(|a| !a.starts_with("--")).map(PathBuf::from).unwrap_or_else(|| PathBuf::from(concat!(env!("CARGO_MANIFEST_DIR"), "/../../content/academy")));
    let mut failed = false;
    let mut report = vec![];
    for lang in languages(&root) {
        let b = load_lang(&root, &lang);
        let (errors, warnings) = lint(&b);
        let c = counts(&b);
        if !json {
            println!("[{lang}] phases {} · sections {} · chapters {} · words {} · quizzes {} ({} questions) · exams {} ({} questions) · glossary {} · diagrams {}", c.phases, c.sections, c.chapters, c.words, c.quizzes, c.quiz_questions, c.exams, c.exam_questions, c.glossary_terms, c.diagrams);
            for p in &b.phases {
                for s in &p.sections {
                    let w: usize = s.chapters.iter().map(|x| x.words).sum();
                    println!("  {:<8} {:<12} {:>2} chapters {:>6} words  {}", p.slug, s.def.track, s.chapters.len(), w, s.def.title);
                }
            }
            for w in &warnings {
                println!("  warning: {w}");
            }
            for e in &errors {
                println!("  ERROR: {e}");
            }
        }
        failed |= !errors.is_empty();
        report.push(serde_json::json!({"lang": lang, "counts": c, "errors": errors, "warnings": warnings}));
    }
    if report.is_empty() {
        eprintln!("no languages found under {}", root.display());
        failed = true;
    }
    if json {
        println!("{}", serde_json::to_string_pretty(&report).unwrap_or_default());
    } else {
        println!("{}", if failed { "content lint: FAILED" } else { "content lint: OK" });
    }
    std::process::exit(i32::from(failed));
}
