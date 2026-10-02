//! A minimal ZIP writer (stored entries, no compression) for the account history download (B10). PDF and XLSX
//! are already compressed, so storing costs little and needs no extra dependency. Entries carry a CRC-32
//! (IEEE 802.3) and a DOS timestamp; the archive opens in every unzip tool and in Windows / macOS Finder.

use chrono::{DateTime, Datelike, Timelike, Utc};

/// CRC-32 (IEEE, reflected, polynomial 0xEDB88320), as ZIP requires.
pub fn crc32(data: &[u8]) -> u32 {
    static TABLE: std::sync::OnceLock<[u32; 256]> = std::sync::OnceLock::new();
    let t = TABLE.get_or_init(|| {
        let mut t = [0u32; 256];
        for (i, v) in t.iter_mut().enumerate() {
            let mut c = i as u32;
            for _ in 0..8 {
                c = if c & 1 != 0 { 0xEDB8_8320 ^ (c >> 1) } else { c >> 1 };
            }
            *v = c;
        }
        t
    });
    let mut c = 0xFFFF_FFFFu32;
    for b in data {
        c = t[((c ^ *b as u32) & 0xFF) as usize] ^ (c >> 8);
    }
    c ^ 0xFFFF_FFFF
}

fn dos_time(t: DateTime<Utc>) -> (u16, u16) {
    let time = ((t.hour() as u16) << 11) | ((t.minute() as u16) << 5) | ((t.second() as u16) / 2);
    let year = (t.year().clamp(1980, 2107) - 1980) as u16;
    let date = (year << 9) | ((t.month() as u16) << 5) | t.day() as u16;
    (time, date)
}

/// Builds a ZIP archive of `(name, bytes)` entries (names are UTF-8; flag bit 11 set).
pub fn store(entries: &[(&str, &[u8])], at: DateTime<Utc>) -> Vec<u8> {
    let (time, date) = dos_time(at);
    let mut out = Vec::new();
    let mut central = Vec::new();
    for (name, data) in entries {
        let crc = crc32(data);
        let offset = out.len() as u32;
        let size = data.len() as u32;
        let n = name.as_bytes();
        // local file header
        out.extend_from_slice(&0x0403_4b50u32.to_le_bytes());
        out.extend_from_slice(&20u16.to_le_bytes()); // version needed
        out.extend_from_slice(&0x0800u16.to_le_bytes()); // UTF-8 names
        out.extend_from_slice(&0u16.to_le_bytes()); // stored
        out.extend_from_slice(&time.to_le_bytes());
        out.extend_from_slice(&date.to_le_bytes());
        out.extend_from_slice(&crc.to_le_bytes());
        out.extend_from_slice(&size.to_le_bytes());
        out.extend_from_slice(&size.to_le_bytes());
        out.extend_from_slice(&(n.len() as u16).to_le_bytes());
        out.extend_from_slice(&0u16.to_le_bytes());
        out.extend_from_slice(n);
        out.extend_from_slice(data);
        // central directory entry
        central.extend_from_slice(&0x0201_4b50u32.to_le_bytes());
        central.extend_from_slice(&20u16.to_le_bytes()); // version made by
        central.extend_from_slice(&20u16.to_le_bytes());
        central.extend_from_slice(&0x0800u16.to_le_bytes());
        central.extend_from_slice(&0u16.to_le_bytes());
        central.extend_from_slice(&time.to_le_bytes());
        central.extend_from_slice(&date.to_le_bytes());
        central.extend_from_slice(&crc.to_le_bytes());
        central.extend_from_slice(&size.to_le_bytes());
        central.extend_from_slice(&size.to_le_bytes());
        central.extend_from_slice(&(n.len() as u16).to_le_bytes());
        central.extend_from_slice(&[0u8; 8]); // extra len, comment len, disk, internal attrs
        central.extend_from_slice(&0u32.to_le_bytes()); // external attrs
        central.extend_from_slice(&offset.to_le_bytes());
        central.extend_from_slice(n);
    }
    let cd_offset = out.len() as u32;
    let cd_size = central.len() as u32;
    out.extend_from_slice(&central);
    out.extend_from_slice(&0x0605_4b50u32.to_le_bytes());
    out.extend_from_slice(&[0u8; 4]); // disk numbers
    out.extend_from_slice(&(entries.len() as u16).to_le_bytes());
    out.extend_from_slice(&(entries.len() as u16).to_le_bytes());
    out.extend_from_slice(&cd_size.to_le_bytes());
    out.extend_from_slice(&cd_offset.to_le_bytes());
    out.extend_from_slice(&0u16.to_le_bytes());
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn crc32_known_values() {
        assert_eq!(crc32(b""), 0);
        assert_eq!(crc32(b"123456789"), 0xCBF4_3926);
        assert_eq!(crc32(b"The quick brown fox jumps over the lazy dog"), 0x414F_A339);
    }

    #[test]
    fn archive_layout() {
        let at = chrono::DateTime::parse_from_rfc3339("2026-10-02T12:34:56Z").unwrap().with_timezone(&Utc);
        let z = store(&[("a.txt", b"hello"), ("dir/b.csv", b"x,y\n1,2\n")], at);
        assert_eq!(&z[..4], &[0x50, 0x4b, 0x03, 0x04]);
        // end of central directory: 2 entries, offsets consistent
        let eocd = z.len() - 22;
        assert_eq!(&z[eocd..eocd + 4], &[0x50, 0x4b, 0x05, 0x06]);
        assert_eq!(u16::from_le_bytes([z[eocd + 10], z[eocd + 11]]), 2);
        let cd_size = u32::from_le_bytes(z[eocd + 12..eocd + 16].try_into().unwrap()) as usize;
        let cd_off = u32::from_le_bytes(z[eocd + 16..eocd + 20].try_into().unwrap()) as usize;
        assert_eq!(cd_off + cd_size, eocd);
        assert_eq!(&z[cd_off..cd_off + 4], &[0x50, 0x4b, 0x01, 0x02]);
        // the stored bytes are where the local header says
        assert_eq!(&z[30 + 5..30 + 5 + 5], b"hello");
        // with `unzip` on the machine, the archive tests clean
        let path = std::env::temp_dir().join(format!("kalks-zip-test-{}.zip", std::process::id()));
        std::fs::write(&path, &z).unwrap();
        if let Ok(o) = std::process::Command::new("unzip").arg("-t").arg(&path).output() {
            assert!(o.status.success(), "{}", String::from_utf8_lossy(&o.stdout));
        }
        let _ = std::fs::remove_file(path);
    }
}
