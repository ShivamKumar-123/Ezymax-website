//! A small, dependency-free PDF 1.4 writer for statements: A4 pages, the standard Helvetica fonts
//! (WinAnsiEncoding, no embedding), text with measured widths, filled rectangles, lines and vector paths.
//! Content streams are Flate-compressed. Coordinates are in points from the top-left corner.

use std::io::Write;

use flate2::Compression;
use flate2::write::ZlibEncoder;

pub const A4_W: f64 = 595.28;
pub const A4_H: f64 = 841.89;

#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Rgb(pub f64, pub f64, pub f64);

impl Rgb {
    pub const fn hex(v: u32) -> Rgb {
        Rgb(((v >> 16) & 0xff) as f64 / 255.0, ((v >> 8) & 0xff) as f64 / 255.0, (v & 0xff) as f64 / 255.0)
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Font {
    Regular,
    Bold,
}

// Helvetica / Helvetica-Bold advance widths (1/1000 em) for 0x20..=0x7E (Adobe AFM).
const HELV: [u16; 95] = [
    278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 278, 278, 584, 584, 584, 556, 1015, 667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556, 833,
    722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 278, 278, 278, 469, 556, 333, 556, 556, 500, 556, 556, 278, 556, 556, 222, 222, 500, 222, 833, 556, 556, 556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500, 334,
    260, 334, 584,
];
const HELV_B: [u16; 95] = [
    278, 333, 474, 556, 556, 889, 722, 238, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 333, 333, 584, 584, 584, 611, 975, 722, 722, 722, 722, 667, 611, 778, 722, 278, 556, 722, 611, 833,
    722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 333, 278, 333, 584, 556, 333, 556, 611, 556, 611, 556, 333, 611, 611, 278, 278, 556, 278, 889, 611, 611, 611, 611, 389, 556, 333, 611, 556, 778, 556, 556, 500, 389,
    280, 389, 584,
];

/// WinAnsiEncoding byte for a char ('?' when it has none).
pub fn win_ansi(c: char) -> u8 {
    match c as u32 {
        0x20..=0x7e => c as u8,
        0xa0..=0xff => c as u32 as u8,
        0x20ac => 0x80,
        0x2018 => 0x91,
        0x2019 => 0x92,
        0x201c => 0x93,
        0x201d => 0x94,
        0x2022 => 0x95,
        0x2013 => 0x96,
        0x2014 => 0x97,
        0x2122 => 0x99,
        0x2212 => b'-',
        0x2192 => b'>',
        _ => b'?',
    }
}

pub fn text_width(s: &str, font: Font, size: f64) -> f64 {
    let table = if font == Font::Bold { &HELV_B } else { &HELV };
    let units: u32 = s
        .chars()
        .map(|c| {
            let b = win_ansi(c);
            if (0x20..=0x7e).contains(&b) { table[(b - 0x20) as usize] as u32 } else { 556 }
        })
        .sum();
    units as f64 * size / 1000.0
}

/// Truncates `s` with "..." so it fits `max` points.
pub fn fit(s: &str, font: Font, size: f64, max: f64) -> String {
    if text_width(s, font, size) <= max {
        return s.to_string();
    }
    let mut out: String = s.to_string();
    while !out.is_empty() && text_width(&format!("{out}..."), font, size) > max {
        out.pop();
    }
    format!("{out}...")
}

fn escape(s: &str) -> Vec<u8> {
    let mut v = Vec::with_capacity(s.len() + 2);
    for c in s.chars() {
        let b = win_ansi(c);
        if matches!(b, b'(' | b')' | b'\\') {
            v.push(b'\\');
        }
        v.push(b);
    }
    v
}

fn f(x: f64) -> String {
    let s = format!("{:.3}", x);
    let s = s.trim_end_matches('0').trim_end_matches('.').to_string();
    if s == "-0" { "0".into() } else { s }
}

#[derive(Default)]
pub struct Page {
    ops: Vec<u8>,
}

impl Page {
    fn push(&mut self, s: &str) {
        self.ops.extend_from_slice(s.as_bytes());
        self.ops.push(b'\n');
    }

    pub fn fill_color(&mut self, c: Rgb) {
        self.push(&format!("{} {} {} rg", f(c.0), f(c.1), f(c.2)));
    }

    pub fn stroke_color(&mut self, c: Rgb) {
        self.push(&format!("{} {} {} RG", f(c.0), f(c.1), f(c.2)));
    }

    /// Text with its baseline at `y` (from the top).
    pub fn text(&mut self, x: f64, y: f64, s: &str, font: Font, size: f64, color: Rgb) {
        self.fill_color(color);
        let mut line = format!("BT /{} {} Tf {} {} Td (", if font == Font::Bold { "F2" } else { "F1" }, f(size), f(x), f(A4_H - y)).into_bytes();
        line.extend(escape(s));
        line.extend_from_slice(b") Tj ET\n");
        self.ops.extend(line);
    }

    pub fn text_right(&mut self, right: f64, y: f64, s: &str, font: Font, size: f64, color: Rgb) {
        let w = text_width(s, font, size);
        self.text(right - w, y, s, font, size, color);
    }

    pub fn text_center(&mut self, cx: f64, y: f64, s: &str, font: Font, size: f64, color: Rgb) {
        let w = text_width(s, font, size);
        self.text(cx - w / 2.0, y, s, font, size, color);
    }

    pub fn rect(&mut self, x: f64, y: f64, w: f64, h: f64, color: Rgb) {
        self.fill_color(color);
        self.push(&format!("{} {} {} {} re f", f(x), f(A4_H - y - h), f(w), f(h)));
    }

    pub fn line(&mut self, x1: f64, y1: f64, x2: f64, y2: f64, width: f64, color: Rgb) {
        self.stroke_color(color);
        self.push(&format!("{} w {} {} m {} {} l S", f(width), f(x1), f(A4_H - y1), f(x2), f(A4_H - y2)));
    }

    /// Raw path operators already in PDF user space (bottom-left origin), filled even-odd.
    pub fn path_fill(&mut self, ops: &str, color: Rgb) {
        self.fill_color(color);
        self.push(ops);
        self.push("f*");
    }
}

pub struct Doc {
    pub title: String,
    pub pages: Vec<Page>,
}

impl Doc {
    pub fn new(title: &str) -> Self {
        Self { title: title.to_string(), pages: vec![] }
    }

    pub fn add_page(&mut self) -> &mut Page {
        self.pages.push(Page::default());
        self.pages.last_mut().unwrap()
    }

    pub fn render(self) -> Vec<u8> {
        let mut out: Vec<u8> = b"%PDF-1.4\n%\xe2\xe3\xcf\xd3\n".to_vec();
        let mut offsets: Vec<usize> = vec![];
        let n_pages = self.pages.len().max(1);
        // object ids: 1 catalog, 2 pages, 3 F1, 4 F2, 5 info, then (page, content) pairs
        let page_id = |i: usize| 6 + i * 2;
        let mut objs: Vec<Vec<u8>> = vec![];
        objs.push(b"<< /Type /Catalog /Pages 2 0 R >>".to_vec());
        let kids: Vec<String> = (0..n_pages).map(|i| format!("{} 0 R", page_id(i))).collect();
        objs.push(format!("<< /Type /Pages /Kids [{}] /Count {} >>", kids.join(" "), n_pages).into_bytes());
        objs.push(b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>".to_vec());
        objs.push(b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>".to_vec());
        let now = chrono::Utc::now().format("D:%Y%m%d%H%M%SZ").to_string();
        let mut info = b"<< /Title (".to_vec();
        info.extend(escape(&self.title));
        info.extend(format!(") /Producer (Ezymex reports) /Creator (Ezymex) /CreationDate ({now}) >>").into_bytes());
        objs.push(info);
        let mut pages = self.pages;
        if pages.is_empty() {
            pages.push(Page::default());
        }
        for (i, p) in pages.into_iter().enumerate() {
            objs.push(
                format!(
                    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 {} {}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents {} 0 R >>",
                    f(A4_W),
                    f(A4_H),
                    page_id(i) + 1
                )
                .into_bytes(),
            );
            let mut enc = ZlibEncoder::new(Vec::new(), Compression::default());
            enc.write_all(&p.ops).expect("in-memory write");
            let data = enc.finish().expect("in-memory write");
            let mut o = format!("<< /Length {} /Filter /FlateDecode >>\nstream\n", data.len()).into_bytes();
            o.extend(data);
            o.extend_from_slice(b"\nendstream");
            objs.push(o);
        }
        for (i, o) in objs.iter().enumerate() {
            offsets.push(out.len());
            out.extend(format!("{} 0 obj\n", i + 1).into_bytes());
            out.extend(o);
            out.extend_from_slice(b"\nendobj\n");
        }
        let xref = out.len();
        out.extend(format!("xref\n0 {}\n0000000000 65535 f \n", objs.len() + 1).into_bytes());
        for o in offsets {
            out.extend(format!("{o:010} 00000 n \n").into_bytes());
        }
        out.extend(format!("trailer\n<< /Size {} /Root 1 0 R /Info 5 0 R >>\nstartxref\n{xref}\n%%EOF\n", objs.len() + 1).into_bytes());
        out
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn widths_and_fit() {
        assert!((text_width("AB", Font::Regular, 10.0) - 13.34).abs() < 1e-9);
        assert!(text_width("Win", Font::Bold, 10.0) > text_width("Win", Font::Regular, 10.0));
        let s = fit("A very long symbol name here", Font::Regular, 8.0, 40.0);
        assert!(s.ends_with("...") && text_width(&s, Font::Regular, 8.0) <= 40.0);
    }

    #[test]
    fn document_structure_and_xref() {
        let mut d = Doc::new("Test (1)");
        let p = d.add_page();
        p.text(40.0, 40.0, "Hello (world) \\ ok – €", Font::Bold, 12.0, Rgb::hex(0x111111));
        p.rect(0.0, 0.0, 10.0, 10.0, Rgb::hex(0xff5a1f));
        d.add_page();
        let bytes = d.render();
        let s = String::from_utf8_lossy(&bytes);
        assert!(s.starts_with("%PDF-1.4"));
        assert!(s.contains("/Count 2"));
        assert!(s.trim_end().ends_with("%%EOF"));
        // every xref offset points at "<n> 0 obj" (checked on the raw bytes: streams are binary)
        let pos = bytes.windows(9).rposition(|w| w == b"startxref").unwrap();
        let tail = std::str::from_utf8(&bytes[pos..]).unwrap();
        let xref_at: usize = tail.lines().nth(1).unwrap().parse().unwrap();
        let table = std::str::from_utf8(&bytes[xref_at..pos]).unwrap();
        let mut n = 0;
        for (i, line) in table.lines().skip(3).take_while(|l| l.ends_with(" n ")).enumerate() {
            let off: usize = line[..10].parse().unwrap();
            assert!(bytes[off..].starts_with(format!("{} 0 obj", i + 1).as_bytes()), "object {} offset", i + 1);
            n += 1;
        }
        assert_eq!(n, 9);
    }
}
