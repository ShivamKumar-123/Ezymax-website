//! Input validation. Each check returns a human message for the offending field.

use chrono::{Datelike, NaiveDate};

pub type Check<T> = Result<T, &'static str>;

pub fn email(raw: &str) -> Check<String> {
    let e = raw.trim().to_lowercase();
    if e.is_empty() {
        return Err("Enter your email address.");
    }
    if e.len() > 254 {
        return Err("Email address is too long.");
    }
    let Some((local, domain)) = e.split_once('@') else {
        return Err("Enter a valid email address.");
    };
    let ok_local = !local.is_empty() && local.len() <= 64 && !local.starts_with('.') && !local.ends_with('.') && !local.contains("..");
    let ok_domain = domain.contains('.')
        && !domain.starts_with('.')
        && !domain.ends_with('.')
        && !domain.contains("..")
        && domain.chars().all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '.')
        && domain.rsplit('.').next().is_some_and(|tld| tld.len() >= 2);
    let ok_chars = local.chars().all(|c| c.is_ascii_alphanumeric() || "!#$%&'*+-/=?^_`{|}~.".contains(c));
    if ok_local && ok_domain && ok_chars { Ok(e) } else { Err("Enter a valid email address.") }
}

/// 8–128 chars with an uppercase letter, a lowercase letter, a digit and a symbol.
pub fn password(pw: &str) -> Check<()> {
    let n = pw.chars().count();
    if n < 8 {
        return Err("Use at least 8 characters.");
    }
    if n > 128 {
        return Err("Use at most 128 characters.");
    }
    if !pw.chars().any(|c| c.is_uppercase()) {
        return Err("Add an uppercase letter.");
    }
    if !pw.chars().any(|c| c.is_lowercase()) {
        return Err("Add a lowercase letter.");
    }
    if !pw.chars().any(|c| c.is_ascii_digit()) {
        return Err("Add a number.");
    }
    if pw.chars().all(|c| c.is_alphanumeric()) {
        return Err("Add a symbol such as ! # @ or %.");
    }
    Ok(())
}

pub fn name(raw: &str, what: &'static str) -> Check<String> {
    let v = raw.split_whitespace().collect::<Vec<_>>().join(" ");
    if v.is_empty() {
        return Err(what);
    }
    if v.chars().count() > 60 {
        return Err("Name is too long.");
    }
    if !v.chars().all(|c| c.is_alphabetic() || c == ' ' || c == '-' || c == '\'' || c == '.') {
        return Err("Use letters only.");
    }
    Ok(v)
}

/// Dial code like `+91`.
pub fn dial(raw: &str) -> Check<String> {
    let v = raw.trim();
    let digits = v.strip_prefix('+').unwrap_or("");
    if (1..=4).contains(&digits.len()) && digits.chars().all(|c| c.is_ascii_digit()) {
        Ok(v.to_string())
    } else {
        Err("Choose a country dial code.")
    }
}

/// National number: 6–14 digits after stripping spaces, dashes and brackets.
pub fn phone(raw: &str) -> Check<String> {
    let digits: String = raw.chars().filter(|c| !matches!(c, ' ' | '-' | '(' | ')')).collect();
    if digits.is_empty() {
        return Err("Enter your phone number.");
    }
    if !digits.chars().all(|c| c.is_ascii_digit()) || !(6..=14).contains(&digits.len()) {
        return Err("Enter a valid phone number.");
    }
    Ok(digits)
}

/// ISO 3166-1 alpha-2, lower-case.
pub fn country(raw: &str) -> Check<String> {
    let v = raw.trim().to_lowercase();
    if v.len() == 2 && v.chars().all(|c| c.is_ascii_lowercase()) { Ok(v) } else { Err("Choose your country of residence.") }
}

pub fn age_on(dob: NaiveDate, today: NaiveDate) -> i32 {
    let mut age = today.year() - dob.year();
    if (today.month(), today.day()) < (dob.month(), dob.day()) {
        age -= 1;
    }
    age
}

pub fn date_of_birth(raw: &str, today: NaiveDate) -> Check<NaiveDate> {
    let d = NaiveDate::parse_from_str(raw.trim(), "%Y-%m-%d").map_err(|_| "Enter your date of birth.")?;
    let age = age_on(d, today);
    if age < 18 {
        return Err("You must be at least 18 years old to open an account.");
    }
    if age > 120 {
        return Err("Enter a valid date of birth.");
    }
    Ok(d)
}

/// Optional referral code: 3–24 letters/digits, upper-cased.
pub fn referral(raw: Option<&str>) -> Check<Option<String>> {
    match raw.map(str::trim).filter(|v| !v.is_empty()) {
        None => Ok(None),
        Some(v) if (3..=24).contains(&v.len()) && v.chars().all(|c| c.is_ascii_alphanumeric()) => Ok(Some(v.to_uppercase())),
        Some(_) => Err("Referral code looks wrong. Leave it empty if you don't have one."),
    }
}

/// `a•••••@mail.com`
pub fn mask_email(e: &str) -> String {
    match e.split_once('@') {
        Some((l, d)) => format!("{}•••••@{}", l.chars().next().unwrap_or('•'), d),
        None => "•••••".into(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn emails() {
        assert_eq!(email("  Arjun.Mehta@Mail.com ").unwrap(), "arjun.mehta@mail.com");
        assert!(email("a+tag@kalks.co.in").is_ok());
        for bad in ["", "plain", "a@b", "a@.com", "a@b.c", ".a@b.com", "a..b@c.com", "a@b..com", "a b@c.com", "a@b_c.com"] {
            assert!(email(bad).is_err(), "{bad} should be rejected");
        }
    }

    #[test]
    fn passwords() {
        assert!(password("Kalks@2026").is_ok());
        assert_eq!(password("Ka@1"), Err("Use at least 8 characters."));
        assert_eq!(password("kalks@2026"), Err("Add an uppercase letter."));
        assert_eq!(password("KALKS@2026"), Err("Add a lowercase letter."));
        assert_eq!(password("Kalks@abcd"), Err("Add a number."));
        assert_eq!(password("Kalks2026x"), Err("Add a symbol such as ! # @ or %."));
        assert!(password(&format!("Aa1!{}", "x".repeat(130))).is_err());
    }

    #[test]
    fn ages() {
        let today = NaiveDate::from_ymd_opt(2026, 9, 26).unwrap();
        assert!(date_of_birth("2008-09-26", today).is_ok()); // 18 today
        assert!(date_of_birth("2008-09-27", today).is_err()); // 18 tomorrow
        assert!(date_of_birth("1990-02-30", today).is_err());
        assert!(date_of_birth("1890-01-01", today).is_err());
        assert_eq!(age_on(NaiveDate::from_ymd_opt(2000, 2, 29).unwrap(), NaiveDate::from_ymd_opt(2026, 2, 28).unwrap()), 25);
    }

    #[test]
    fn phones_and_codes() {
        assert_eq!(phone("98201 44721").unwrap(), "9820144721");
        assert!(phone("12ab567").is_err());
        assert!(phone("123").is_err());
        assert_eq!(dial("+971").unwrap(), "+971");
        assert!(dial("971").is_err());
        assert_eq!(country("IN").unwrap(), "in");
        assert!(country("IND").is_err());
        assert_eq!(referral(Some(" arjun24 ")).unwrap(), Some("ARJUN24".into()));
        assert_eq!(referral(Some("")).unwrap(), None);
        assert!(referral(Some("no spaces")).is_err());
    }

    #[test]
    fn names_and_masks() {
        assert_eq!(name("  Arjun   K ", "x").unwrap(), "Arjun K");
        assert!(name("Robert'); DROP", "x").is_err());
        assert_eq!(mask_email("arjun@mail.com"), "a•••••@mail.com");
    }
}
