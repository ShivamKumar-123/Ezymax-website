//! The Ezymex logo as vector paths, parsed from the brand SVG (assets/brand/ezymex-logo.svg: absolute M / L / C / Z
//! commands with implicit repeats). The mark (the subpaths left of the wordmark) is drawn in ember, the wordmark in ink.

use crate::pdf::{A4_H, Page, Rgb};

const SVG: &str = include_str!("../../../assets/brand/ezymex-logo.svg");
/// SVG viewBox of the logo.
const VIEW_W: f64 = 2801.0;
const VIEW_H: f64 = 559.0;
/// Subpaths entirely left of this x belong to the mark.
const MARK_MAX_X: f64 = 660.0;

#[derive(Clone, Debug)]
enum Seg {
    M(f64, f64),
    L(f64, f64),
    C(f64, f64, f64, f64, f64, f64),
}

fn parse() -> Vec<Vec<Seg>> {
    let d = SVG.split(" d=\"").nth(1).and_then(|s| s.split('"').next()).unwrap_or("");
    let mut subpaths: Vec<Vec<Seg>> = vec![];
    let mut cmd = 'M';
    let mut nums: Vec<f64> = vec![];
    let flush = |cmd: char, nums: &mut Vec<f64>, subpaths: &mut Vec<Vec<Seg>>| {
        let mut i = 0;
        let mut first = true;
        while i < nums.len() {
            match cmd {
                'M' if i + 1 < nums.len() => {
                    if first {
                        subpaths.push(vec![Seg::M(nums[i], nums[i + 1])]);
                    } else if let Some(p) = subpaths.last_mut() {
                        p.push(Seg::L(nums[i], nums[i + 1]));
                    }
                    i += 2;
                }
                'L' if i + 1 < nums.len() => {
                    if let Some(p) = subpaths.last_mut() {
                        p.push(Seg::L(nums[i], nums[i + 1]));
                    }
                    i += 2;
                }
                'C' if i + 5 < nums.len() => {
                    if let Some(p) = subpaths.last_mut() {
                        p.push(Seg::C(nums[i], nums[i + 1], nums[i + 2], nums[i + 3], nums[i + 4], nums[i + 5]));
                    }
                    i += 6;
                }
                _ => break,
            }
            first = false;
        }
        nums.clear();
    };
    let mut tok = String::new();
    for ch in d.chars().chain(std::iter::once(' ')) {
        if ch.is_ascii_alphabetic() {
            if !tok.is_empty() {
                nums.push(tok.parse().unwrap_or(0.0));
                tok.clear();
            }
            flush(cmd, &mut nums, &mut subpaths);
            cmd = ch.to_ascii_uppercase();
        } else if ch == ' ' || ch == ',' {
            if !tok.is_empty() {
                nums.push(tok.parse().unwrap_or(0.0));
                tok.clear();
            }
        } else {
            tok.push(ch);
        }
    }
    flush(cmd, &mut nums, &mut subpaths);
    subpaths
}

fn max_x(p: &[Seg]) -> f64 {
    p.iter()
        .map(|s| match *s {
            Seg::M(x, _) | Seg::L(x, _) => x,
            Seg::C(a, _, b, _, c, _) => a.max(b).max(c),
        })
        .fold(0.0, f64::max)
}

fn ops(paths: &[&Vec<Seg>], x: f64, y_top: f64, scale: f64) -> String {
    let tx = |px: f64| x + px * scale;
    let ty = |py: f64| A4_H - (y_top + py * scale);
    let mut o = String::new();
    for p in paths {
        for s in p.iter() {
            match *s {
                Seg::M(a, b) => o.push_str(&format!("{:.2} {:.2} m ", tx(a), ty(b))),
                Seg::L(a, b) => o.push_str(&format!("{:.2} {:.2} l ", tx(a), ty(b))),
                Seg::C(a, b, c, d, e, f) => o.push_str(&format!("{:.2} {:.2} {:.2} {:.2} {:.2} {:.2} c ", tx(a), ty(b), tx(c), ty(d), tx(e), ty(f))),
            }
        }
        o.push_str("h ");
    }
    o
}

/// Draws the logo with its top-left corner at (x, y) and the given height; returns the drawn width.
pub fn draw(page: &mut Page, x: f64, y: f64, height: f64, mark: Rgb, word: Rgb) -> f64 {
    let scale = height / VIEW_H;
    let paths = parse();
    let (m, w): (Vec<&Vec<Seg>>, Vec<&Vec<Seg>>) = paths.iter().partition(|p| max_x(p) < MARK_MAX_X);
    page.path_fill(&ops(&m, x, y, scale), mark);
    page.path_fill(&ops(&w, x, y, scale), word);
    VIEW_W * scale
}

#[cfg(test)]
mod tests {
    #[test]
    fn logo_has_mark_and_wordmark() {
        let p = super::parse();
        assert_eq!(p.len(), 10);
        let marks = p.iter().filter(|s| super::max_x(s) < super::MARK_MAX_X).count();
        assert_eq!(marks, 4);
    }
}
