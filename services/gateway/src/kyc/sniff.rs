//! File type detection from content (never from the name or the declared type) and cheap image-size parsing.

pub const JPEG: &str = "image/jpeg";
pub const PNG: &str = "image/png";
pub const HEIC: &str = "image/heic";
pub const PDF: &str = "application/pdf";

/// The real type of an upload, or None when it isn't one of the accepted formats.
pub fn sniff(b: &[u8]) -> Option<&'static str> {
    if b.len() >= 3 && b[..3] == [0xFF, 0xD8, 0xFF] {
        return Some(JPEG);
    }
    if b.len() >= 8 && b[..8] == [0x89, b'P', b'N', b'G', 0x0D, 0x0A, 0x1A, 0x0A] {
        return Some(PNG);
    }
    if b.len() >= 5 && &b[..5] == b"%PDF-" {
        return Some(PDF);
    }
    // ISO-BMFF: size(4) "ftyp" brand(4)
    if b.len() >= 12 && &b[4..8] == b"ftyp" {
        let brand = &b[8..12];
        if [b"heic", b"heix", b"hevc", b"hevx", b"heim", b"heis", b"mif1", b"msf1"].iter().any(|x| brand == *x) {
            return Some(HEIC);
        }
    }
    None
}

pub fn is_image(mime: &str) -> bool {
    mime != PDF
}

pub fn extension(mime: &str) -> &'static str {
    match mime {
        JPEG => "jpg",
        PNG => "png",
        HEIC => "heic",
        _ => "pdf",
    }
}

fn be16(b: &[u8], i: usize) -> Option<u32> {
    Some(u16::from_be_bytes([*b.get(i)?, *b.get(i + 1)?]) as u32)
}

fn be32(b: &[u8], i: usize) -> Option<u32> {
    Some(u32::from_be_bytes([*b.get(i)?, *b.get(i + 1)?, *b.get(i + 2)?, *b.get(i + 3)?]))
}

/// (width, height) in pixels for JPEG / PNG / HEIC; None for PDFs or unparseable headers.
pub fn dimensions(mime: &str, b: &[u8]) -> Option<(u32, u32)> {
    match mime {
        PNG => {
            if b.get(12..16)? != b"IHDR" {
                return None;
            }
            Some((be32(b, 16)?, be32(b, 20)?))
        }
        JPEG => {
            let mut i = 2usize;
            while i + 4 <= b.len() {
                if b[i] != 0xFF {
                    return None;
                }
                let marker = b[i + 1];
                if marker == 0xFF {
                    i += 1;
                    continue;
                }
                if marker == 0xD8 || marker == 0x01 || (0xD0..=0xD7).contains(&marker) {
                    i += 2;
                    continue;
                }
                let len = be16(b, i + 2)? as usize;
                if len < 2 {
                    return None;
                }
                // SOF0..SOF15 except DHT (C4), JPG (C8) and DAC (CC)
                if (0xC0..=0xCF).contains(&marker) && !matches!(marker, 0xC4 | 0xC8 | 0xCC) {
                    let h = be16(b, i + 5)?;
                    let w = be16(b, i + 7)?;
                    return Some((w, h));
                }
                i += 2 + len;
            }
            None
        }
        HEIC => {
            // first 'ispe' (image spatial extents) property: version/flags(4), width(4), height(4)
            let limit = b.len().min(256 * 1024);
            let pos = b[..limit].windows(4).position(|w| w == b"ispe")?;
            Some((be32(b, pos + 8)?, be32(b, pos + 12)?))
        }
        _ => None,
    }
}

/// PDFs that could run code in a viewer (JavaScript, launch actions, embedded files) are refused.
/// A PDF name must end at a delimiter, so `/JS` does not match a font called `/JSans`.
pub fn pdf_active_content(b: &[u8]) -> bool {
    const BAD: [&[u8]; 4] = [b"/JavaScript", b"/JS", b"/Launch", b"/EmbeddedFile"];
    BAD.iter().any(|needle| {
        b.windows(needle.len()).enumerate().any(|(i, w)| w == *needle && b.get(i + needle.len()).is_none_or(|c| !c.is_ascii_alphanumeric()))
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn sniffs_by_content() {
        assert_eq!(sniff(&[0xFF, 0xD8, 0xFF, 0xE0, 0, 0]), Some(JPEG));
        assert_eq!(sniff(b"\x89PNG\r\n\x1a\n...."), Some(PNG));
        assert_eq!(sniff(b"%PDF-1.7\n"), Some(PDF));
        assert_eq!(sniff(b"\0\0\0\x18ftypheic\0\0\0\0"), Some(HEIC));
        assert_eq!(sniff(b"\0\0\0\x18ftypmp42\0\0\0\0"), None);
        assert_eq!(sniff(b"GIF89a"), None);
        assert_eq!(sniff(b"<html><script>"), None);
        assert_eq!(sniff(b""), None);
    }

    #[test]
    fn png_dimensions() {
        let mut b = b"\x89PNG\r\n\x1a\n\0\0\0\rIHDR".to_vec();
        b.extend_from_slice(&1200u32.to_be_bytes());
        b.extend_from_slice(&800u32.to_be_bytes());
        assert_eq!(dimensions(PNG, &b), Some((1200, 800)));
    }

    #[test]
    fn jpeg_dimensions_skip_segments() {
        // SOI, APP0 (len 16), SOF0 with 640x480
        let mut b = vec![0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10];
        b.extend_from_slice(&[0u8; 14]);
        b.extend_from_slice(&[0xFF, 0xC0, 0x00, 0x11, 0x08, 0x01, 0xE0, 0x02, 0x80, 0x03]);
        b.extend_from_slice(&[0u8; 12]);
        assert_eq!(dimensions(JPEG, &b), Some((640, 480)));
        assert_eq!(dimensions(JPEG, &[0xFF, 0xD8, 0x00]), None);
    }

    #[test]
    fn active_pdfs_are_flagged() {
        assert!(pdf_active_content(b"%PDF-1.4 1 0 obj << /Launch << /F (cmd.exe) >> >>"));
        assert!(!pdf_active_content(b"%PDF-1.4 << /BaseFont /JSans >> << /OpenAction [3 0 R /Fit] >>"));
        assert!(pdf_active_content(b"%PDF-1.4 << /S /JavaScript /JS (app.alert(1)) >>"));
        assert!(!pdf_active_content(b"%PDF-1.4 1 0 obj << /Type /Catalog /Pages 2 0 R >>"));
    }
}
