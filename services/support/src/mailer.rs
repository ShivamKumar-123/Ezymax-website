//! Email over SMTP (the same relay settings as the gateway: `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`,
//! `SMTP_PASSWORD`, `SMTP_FROM`). Port 465 = implicit TLS, any other port STARTTLS; no `SMTP_USER` = an
//! IP-allowlisted relay such as smtp-relay.gmail.com:587 (production). Without `SMTP_HOST` emails are only
//! logged (`DEV email`). Emails are queued in `email_outbox` and sent by a background loop (`workers.rs`).

use crate::config::Config;
use lettre::message::{Mailbox, MultiPart, SinglePart, header::ContentType};
use lettre::transport::smtp::authentication::Credentials;
use lettre::transport::smtp::extension::ClientId;
use lettre::{AsyncSmtpTransport, AsyncTransport, Message, Tokio1Executor};

#[derive(Clone)]
pub struct Mailer {
    transport: AsyncSmtpTransport<Tokio1Executor>,
    from: Mailbox,
}

impl Mailer {
    pub fn new(cfg: &Config) -> anyhow::Result<Self> {
        let builder = if cfg.smtp_port == 465 {
            AsyncSmtpTransport::<Tokio1Executor>::relay(&cfg.smtp_host)?
        } else {
            AsyncSmtpTransport::<Tokio1Executor>::starttls_relay(&cfg.smtp_host)?
        };
        let from: Mailbox = cfg.smtp_from.parse()?;
        let hello = ClientId::Domain(from.email.domain().to_string());
        let mut builder = builder.port(cfg.smtp_port).hello_name(hello).timeout(Some(std::time::Duration::from_secs(20)));
        if !cfg.smtp_user.is_empty() {
            builder = builder.credentials(Credentials::new(cfg.smtp_user.clone(), cfg.smtp_password.clone()));
        }
        Ok(Self { transport: builder.build(), from })
    }

    /// Sends, and returns the relay's answer ("250 2.0.0 Ok: queued as …") for the log.
    pub async fn send(&self, to: &str, subject: &str, text: &str, html: &str) -> anyhow::Result<String> {
        let msg = Message::builder()
            .from(self.from.clone())
            .to(to.parse()?)
            .subject(subject)
            .multipart(
                MultiPart::alternative()
                    .singlepart(SinglePart::builder().header(ContentType::TEXT_PLAIN).body(text.to_string()))
                    .singlepart(SinglePart::builder().header(ContentType::TEXT_HTML).body(html.to_string())),
            )?;
        let r = self.transport.send(msg).await?;
        Ok(format!("{} {}", r.code(), r.message().next().unwrap_or("")).trim().chars().take(200).collect())
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

