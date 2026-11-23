//! Email over SMTP (the same relay settings as the gateway: `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`,
//! `SMTP_PASSWORD`, `SMTP_FROM`). Port 465 = implicit TLS, any other port STARTTLS; no `SMTP_USER` = an
//! IP-allowlisted relay such as smtp-relay.gmail.com:587 (production). Without `SMTP_HOST` emails are only
//! logged (`DEV email`). Emails are queued in `email_outbox` and sent by a background loop (`workers.rs`).
//!
//! A second relay can be named in `SUPPORT_SMTP_BACKUP_HOST` / `_PORT` / `_USER` / `_PASSWORD`, and is tried
//! only when the first one refuses the message. Ezymex needs it because the house relay has twice stopped
//! taking outbound mail for days at a time while the service had nowhere else to go, and a client waiting on
//! a withdrawal notice should not wait on someone else's outage. The sender stays `SMTP_FROM` on both, so the
//! backup has to be a relay that is allowed to send as that address.

use crate::config::Config;
use lettre::message::{Mailbox, MultiPart, SinglePart, header::ContentType};
use lettre::transport::smtp::authentication::Credentials;
use lettre::transport::smtp::extension::ClientId;
use lettre::{AsyncSmtpTransport, AsyncTransport, Message, Tokio1Executor};

type Relay = AsyncSmtpTransport<Tokio1Executor>;

/// One relay, built the way lettre wants it: 465 is implicit TLS, anything else STARTTLS, and credentials
/// only when there is a user (an IP-allowlisted relay has none).
fn relay(host: &str, port: u16, user: &str, password: &str, hello: ClientId) -> anyhow::Result<Relay> {
    let builder = if port == 465 { Relay::relay(host)? } else { Relay::starttls_relay(host)? };
    let mut builder = builder.port(port).hello_name(hello).timeout(Some(std::time::Duration::from_secs(20)));
    if !user.is_empty() {
        builder = builder.credentials(Credentials::new(user.to_string(), password.to_string()));
    }
    Ok(builder.build())
}

#[derive(Clone)]
pub struct Mailer {
    transport: Relay,
    /// Tried only after `transport` has refused the message.
    backup: Option<Relay>,
    backup_host: String,
    from: Mailbox,
}

impl Mailer {
    pub fn new(cfg: &Config) -> anyhow::Result<Self> {
        let from: Mailbox = cfg.smtp_from.parse()?;
        let hello = ClientId::Domain(from.email.domain().to_string());
        let transport = relay(&cfg.smtp_host, cfg.smtp_port, &cfg.smtp_user, &cfg.smtp_password, hello.clone())?;
        let backup = if cfg.smtp_backup_host.is_empty() {
            None
        } else {
            Some(relay(&cfg.smtp_backup_host, cfg.smtp_backup_port, &cfg.smtp_backup_user, &cfg.smtp_backup_password, hello)?)
        };
        Ok(Self { transport, backup, backup_host: cfg.smtp_backup_host.clone(), from })
    }

    /// True when a second relay stands behind the first.
    pub fn has_backup(&self) -> bool {
        self.backup.is_some()
    }

    /// Sends, and returns the relay's answer ("250 2.0.0 Ok: queued as …") for the log. The backup relay is
    /// tried when the first refuses; its answer is marked so the outbox row says which relay carried the mail.
    /// When both refuse, the first relay's error is the one returned, because that is the one to go and fix.
    pub async fn send(&self, to: &str, subject: &str, text: &str, html: &str) -> anyhow::Result<String> {
        let build = || -> anyhow::Result<Message> {
            Ok(Message::builder()
                .from(self.from.clone())
                .to(to.parse()?)
                .subject(subject)
                .multipart(
                    MultiPart::alternative()
                        .singlepart(SinglePart::builder().header(ContentType::TEXT_PLAIN).body(text.to_string()))
                        .singlepart(SinglePart::builder().header(ContentType::TEXT_HTML).body(html.to_string())),
                )?)
        };
        let answer = |r: lettre::transport::smtp::response::Response| -> String {
            format!("{} {}", r.code(), r.message().next().unwrap_or("")).trim().chars().take(200).collect()
        };
        let first = match self.transport.send(build()?).await {
            Ok(r) => return Ok(answer(r)),
            Err(e) => e,
        };
        let Some(backup) = &self.backup else { return Err(first.into()) };
        match backup.send(build()?).await {
            Ok(r) => {
                tracing::warn!(error = %first, host = %self.backup_host, "the first relay refused: sent through the backup");
                Ok(format!("via backup {}: {}", self.backup_host, answer(r)).chars().take(200).collect())
            }
            Err(second) => {
                tracing::error!(error = %second, host = %self.backup_host, "the backup relay refused as well");
                Err(first.into())
            }
        }
    }
}

/// One notification as an email: the title, the paragraphs, facts and a note when the producer sent them, the
/// button, and why the client got it - in the shared frame (crates/mailframe). Returns (text, html).
pub struct Mail<'a> {
    pub title: &'a str,
    pub tag: &'a str,
    pub body: &'a str,
    pub facts: &'a [(String, String)],
    pub note: Option<&'a str>,
    pub button: Option<(&'a str, &'a str)>,
    pub footer_note: &'a str,
    /// The Client Area's origin: the logo, hero and ground images live under its /assets/email.
    pub app_url: &'a str,
}

pub fn render(m: &Mail) -> (String, String) {
    let (title, body, button, footer_note) = (m.title, m.body, m.button, m.footer_note);
    let paras: Vec<&str> = body.split("\n\n").map(str::trim).filter(|p| !p.is_empty()).collect();
    let mut text = format!("{title}\n\n{}\n", paras.join("\n\n"));
    for (k, v) in m.facts {
        text.push_str(&format!("{k}: {v}\n"));
    }
    if let Some(n) = m.note {
        text.push_str(&format!("\n{n}\n"));
    }
    if let Some((label, url)) = button {
        text.push_str(&format!("\n{label}: {url}\n"));
    }
    text.push_str(&format!("\n{footer_note}\n\nEzymex · ezymex.com\n"));
    let assets = format!("{}/assets/email", m.app_url.trim_end_matches('/'));
    let (logo, hero, bg) = (format!("{assets}/logo.png"), format!("{assets}/hero.png"), format!("{assets}/ground.jpg"));
    let html = mailframe::html(&mailframe::Frame {
        lang: "en",
        rtl: false,
        preheader: paras.first().copied().unwrap_or(""),
        logo_src: &logo,
        tag: m.tag,
        title,
        hero_src: Some(&hero),
        body_html: &mailframe::paragraphs_html(body),
        facts: m.facts,
        note: m.note,
        button,
        footer_html: &mailframe::escape(footer_note),
        site_url: "https://ezymex.com",
        brand: "Ezymex",
        year: chrono::Utc::now().format("%Y").to_string().parse().unwrap_or(2026),
        bg_src: Some(&bg),
    });
    return (text, html);
}

