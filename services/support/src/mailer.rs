//! Email over SMTP (the same relay settings as the gateway: `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`,
//! `SMTP_PASSWORD`, `SMTP_FROM`). Port 465 = implicit TLS, any other port STARTTLS; no `SMTP_USER` = an
//! IP-allowlisted relay such as smtp-relay.gmail.com:587 (production). Without `SMTP_HOST` emails are only
//! logged (`DEV email`). Emails are queued in `email_outbox` and sent by a background loop (`workers.rs`).

use crate::config::Config;
use crate::util::html_escape;
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

    pub async fn send(&self, to: &str, subject: &str, text: &str, html: &str) -> anyhow::Result<()> {
        let msg = Message::builder()
            .from(self.from.clone())
            .to(to.parse()?)
            .subject(subject)
            .multipart(
                MultiPart::alternative()
                    .singlepart(SinglePart::builder().header(ContentType::TEXT_PLAIN).body(text.to_string()))
                    .singlepart(SinglePart::builder().header(ContentType::TEXT_HTML).body(html.to_string())),
            )?;
        self.transport.send(msg).await?;
        Ok(())
    }
}

/// A simple branded email: title, paragraphs, optional button. Returns (text, html).
pub fn render(title: &str, body: &str, button: Option<(&str, &str)>, footer_note: &str) -> (String, String) {
    let paras: Vec<&str> = body.split("\n\n").map(str::trim).filter(|p| !p.is_empty()).collect();
    let mut text = format!("{title}\n\n{}\n", paras.join("\n\n"));
    if let Some((label, url)) = button {
        text.push_str(&format!("\n{label}: {url}\n"));
    }
    text.push_str(&format!("\n{footer_note}\n\nEzymex · ezymex.com\n"));
    let body_html: String = paras
        .iter()
        .map(|p| format!(r#"<p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:#c7c7cf">{}</p>"#, html_escape(p).replace('\n', "<br>")))
        .collect();
    let button_html = button
        .map(|(label, url)| {
            format!(
                r#"<table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 6px"><tr><td style="background:#ff5a1f;border-radius:10px"><a href="{}" style="display:inline-block;padding:12px 22px;font-size:14px;font-weight:600;color:#ffffff;text-decoration:none">{}</a></td></tr></table>"#,
                html_escape(url),
                html_escape(label)
            )
        })
        .unwrap_or_default();
    let html = format!(
        r#"<!doctype html><html><body style="margin:0;background:#0b0b0e;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0b0b0e;padding:32px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px">
<tr><td style="padding:0 4px 18px;font-size:18px;font-weight:700;letter-spacing:0.5px;color:#f5f5f7">Ezymex</td></tr>
<tr><td style="background:#141418;border:1px solid #26262e;border-radius:16px;padding:28px 26px">
<h1 style="margin:0 0 14px;font-size:21px;line-height:1.3;font-weight:700;color:#f5f5f7">{}</h1>
{body_html}{button_html}
</td></tr>
<tr><td style="padding:18px 6px 0;font-size:12px;line-height:1.6;color:#8e8e98">{}</td></tr>
</table></td></tr></table></body></html>"#,
        html_escape(title),
        html_escape(footer_note)
    );
    (text, html)
}
