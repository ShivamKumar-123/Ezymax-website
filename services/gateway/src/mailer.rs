//! Transactional email over SMTP (sign-in and verification codes).
//! Port 465 uses implicit TLS, any other port STARTTLS. Without SMTP_USER no login is sent
//! (IP-authenticated relay such as smtp-relay.gmail.com). Sending runs in the background so request
//! latency (and therefore timing) does not depend on the mail server.

use lettre::message::{header::ContentType, Mailbox, MultiPart, SinglePart};
use lettre::transport::smtp::authentication::Credentials;
use lettre::transport::smtp::extension::ClientId;
use lettre::{AsyncSmtpTransport, AsyncTransport, Message, Tokio1Executor};

use crate::identity::Purpose;

#[derive(Clone)]
pub struct Mailer {
    transport: AsyncSmtpTransport<Tokio1Executor>,
    from: Mailbox,
}

pub struct SmtpSettings<'a> {
    pub host: &'a str,
    pub port: u16,
    pub user: &'a str,
    pub password: &'a str,
    pub from: &'a str,
}

impl Mailer {
    pub fn new(s: SmtpSettings) -> anyhow::Result<Self> {
        let builder = if s.port == 465 {
            AsyncSmtpTransport::<Tokio1Executor>::relay(s.host)?
        } else {
            AsyncSmtpTransport::<Tokio1Executor>::starttls_relay(s.host)?
        };
        let from: Mailbox = s.from.parse()?;
        // Greet the relay with our sending domain (Google's IP relay expects a domain of the Workspace).
        let hello = ClientId::Domain(from.email.domain().to_string());
        let mut builder = builder.port(s.port).hello_name(hello).timeout(Some(std::time::Duration::from_secs(20)));
        // No user = relay trusted by the server's IP (e.g. Google Workspace SMTP relay); no password is stored.
        if !s.user.is_empty() {
            builder = builder.credentials(Credentials::new(s.user.to_string(), s.password.to_string()));
        }
        let transport = builder.build();
        Ok(Self { transport, from })
    }

    /// Checks the SMTP login (used once at startup so a bad password shows up in the log immediately).
    pub async fn test_connection(&self) -> anyhow::Result<bool> {
        Ok(self.transport.test_connection().await?)
    }

    pub async fn send_code(&self, to: &str, purpose: Purpose, code: &str, ttl_minutes: i64) -> anyhow::Result<()> {
        let (subject, lead) = match purpose {
            Purpose::VerifyEmail => ("Verify your email for Kalks", "Use this code to verify your email address and finish creating your Kalks account."),
            Purpose::Login => ("Your Kalks sign-in code", "Use this code to confirm a sign-in to your Kalks account from a new device."),
            Purpose::ResetPassword => ("Reset your Kalks password", "Use this code to reset the password of your Kalks account."),
        };
        let text = format!(
            "{lead}\n\n{code}\n\nThe code expires in {ttl_minutes} minutes. If you didn't request it, ignore this email and consider changing your password.\n\nKalks"
        );
        let html = format!(
            r#"<!doctype html><html><body style="margin:0;background:#0b0b0e;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#f5f5f7">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0b0b0e;padding:32px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#141418;border:1px solid #26262e;border-radius:14px">
<tr><td style="padding:28px 28px 8px;font-size:20px;font-weight:700;letter-spacing:.3px">Kalks</td></tr>
<tr><td style="padding:8px 28px 0;font-size:15px;line-height:1.55;color:#c7c7cf">{lead}</td></tr>
<tr><td style="padding:22px 28px"><div style="font-family:ui-monospace,Menlo,Consolas,monospace;font-size:32px;font-weight:700;letter-spacing:8px;color:#ff5a1f;background:#0b0b0e;border:1px solid #26262e;border-radius:10px;padding:16px 0;text-align:center">{code}</div></td></tr>
<tr><td style="padding:0 28px 26px;font-size:13px;line-height:1.55;color:#8e8e98">The code expires in {ttl_minutes} minutes. If you didn't request it, ignore this email and consider changing your password. Kalks will never ask you for this code by phone or chat.</td></tr>
</table></td></tr></table></body></html>"#
        );
        let msg = Message::builder()
            .from(self.from.clone())
            .to(to.parse()?)
            .subject(subject)
            .multipart(
                MultiPart::alternative()
                    .singlepart(SinglePart::builder().header(ContentType::TEXT_PLAIN).body(text))
                    .singlepart(SinglePart::builder().header(ContentType::TEXT_HTML).body(html)),
            )?;
        self.transport.send(msg).await?;
        Ok(())
    }
}
