//! SMTP for scheduled reports, the same setup as the gateway mailer (SMTP_HOST / PORT / USER / PASSWORD;
//! no user = IP-authenticated relay such as smtp-relay.gmail.com, port 465 = implicit TLS, else STARTTLS).

use lettre::message::{Attachment, Mailbox, MultiPart, SinglePart, header::ContentType};
use lettre::transport::smtp::authentication::Credentials;
use lettre::transport::smtp::extension::ClientId;
use lettre::{AsyncSmtpTransport, AsyncTransport, Message, Tokio1Executor};

use crate::config::Config;

pub struct Mailer {
    transport: AsyncSmtpTransport<Tokio1Executor>,
    from: Mailbox,
}

pub struct Mail<'a> {
    pub to: &'a [String],
    pub subject: &'a str,
    pub text: &'a str,
    pub html: &'a str,
    pub attachment: Option<(&'a str, &'a str, Vec<u8>)>,
}

impl Mailer {
    pub fn new(cfg: &Config) -> anyhow::Result<Self> {
        let builder = if cfg.smtp_port == 465 { AsyncSmtpTransport::<Tokio1Executor>::relay(&cfg.smtp_host)? } else { AsyncSmtpTransport::<Tokio1Executor>::starttls_relay(&cfg.smtp_host)? };
        let from: Mailbox = cfg.smtp_from.parse()?;
        let hello = ClientId::Domain(from.email.domain().to_string());
        let mut builder = builder.port(cfg.smtp_port).hello_name(hello).timeout(Some(std::time::Duration::from_secs(30)));
        if !cfg.smtp_user.is_empty() {
            builder = builder.credentials(Credentials::new(cfg.smtp_user.clone(), cfg.smtp_password.clone()));
        }
        Ok(Self { transport: builder.build(), from })
    }

    pub async fn send(&self, m: Mail<'_>) -> anyhow::Result<()> {
        let mut b = Message::builder().from(self.from.clone()).subject(m.subject);
        for to in m.to {
            b = b.to(to.parse()?);
        }
        let body = MultiPart::alternative().singlepart(SinglePart::plain(m.text.to_string())).singlepart(SinglePart::html(m.html.to_string()));
        let msg = match m.attachment {
            Some((name, ctype, bytes)) => b.multipart(MultiPart::mixed().multipart(body).singlepart(Attachment::new(name.to_string()).body(bytes, ContentType::parse(ctype)?)))?,
            None => b.multipart(body)?,
        };
        self.transport.send(msg).await?;
        Ok(())
    }
}
