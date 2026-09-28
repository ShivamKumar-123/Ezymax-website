//! Transactional email over SMTP: verification / sign-in / reset codes and the welcome email.
//! Port 465 uses implicit TLS, any other port STARTTLS. Without SMTP_USER no login is sent
//! (IP-authenticated relay such as smtp-relay.gmail.com). Sending runs in the background so request
//! latency (and therefore timing) does not depend on the mail server.
//!
//! Every email has a plain-text and an HTML part. The Kalks logo is embedded inline (cid:), so it shows
//! without remote images and without the web apps being publicly reachable.

use lettre::message::{header::ContentType, Attachment, Mailbox, MultiPart, SinglePart};
use lettre::transport::smtp::authentication::Credentials;
use lettre::transport::smtp::extension::ClientId;
use lettre::{AsyncSmtpTransport, AsyncTransport, Message, Tokio1Executor};

use crate::identity::Purpose;

const LOGO_PNG: &[u8] = include_bytes!("../assets/email-logo.png");
const LOGO_CID: &str = "kalks-logo";

// Brand palette (matches the apps' dark theme).
const BG: &str = "#0b0b0e";
const CARD: &str = "#141418";
const LINE: &str = "#26262e";
const FG: &str = "#f5f5f7";
const FG2: &str = "#c7c7cf";
const FG3: &str = "#8e8e98";
const EMBER: &str = "#ff5a1f";
const GOLD: &str = "#e9b949";

#[derive(Clone)]
pub struct Mailer {
    transport: AsyncSmtpTransport<Tokio1Executor>,
    from: Mailbox,
    links: Links,
}

/// Public URLs used in email buttons and the footer.
#[derive(Clone)]
pub struct Links {
    pub site: String,
    pub app: String,
    pub trade: String,
    pub support_email: String,
}

pub struct SmtpSettings<'a> {
    pub host: &'a str,
    pub port: u16,
    pub user: &'a str,
    pub password: &'a str,
    pub from: &'a str,
}

impl Mailer {
    pub fn new(s: SmtpSettings, links: Links) -> anyhow::Result<Self> {
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
        Ok(Self { transport: builder.build(), from, links })
    }

    /// Checks the SMTP connection (used once at startup so a bad setup shows up in the log immediately).
    pub async fn test_connection(&self) -> anyhow::Result<bool> {
        Ok(self.transport.test_connection().await?)
    }

    /// `detail` names the change being confirmed (step-up codes only).
    pub async fn send_code(&self, to: &str, purpose: Purpose, code: &str, ttl_minutes: i64, detail: Option<&str>) -> anyhow::Result<()> {
        let confirm_lead;
        let (subject, title, lead) = match purpose {
            Purpose::VerifyEmail => (
                "Your Kalks verification code",
                "Verify your email",
                "Enter this code to confirm your email address and finish creating your Kalks account.",
            ),
            Purpose::Login => (
                "Your Kalks sign-in code",
                "Confirm it's you",
                "We noticed a sign-in to your Kalks account from a new device. Enter this code to continue.",
            ),
            Purpose::ResetPassword => (
                "Reset your Kalks password",
                "Reset your password",
                "Enter this code to set a new password for your Kalks account.",
            ),
            Purpose::Confirm => {
                confirm_lead = format!(
                    "You asked to {} in the Kalks Client Area. Enter this code to confirm it.",
                    detail.unwrap_or("make a change to your account")
                );
                ("Confirm a change on your Kalks account", "Confirm this change on your Kalks account", confirm_lead.as_str())
            }
        };
        let lead_html = html_escape(lead);
        let warn = if purpose == Purpose::Confirm {
            "If you didn't ask for this change, don't share the code: someone may have access to your signed-in session. Change your Client Area password and contact support. Kalks will never ask you for this code by phone, chat or email."
        } else {
            "If you didn't request this code, you can ignore this email. Your account stays safe, but we recommend changing your password. Kalks will never ask you for this code by phone, chat or email."
        };
        let spaced: String = code.chars().map(|c| c.to_string()).collect::<Vec<_>>().join(" ");
        let text = format!(
            "{title}\n\n{lead}\n\nYour code: {code}\n\nIt expires in {ttl_minutes} minutes. {warn}\n\n{footer}",
            footer = self.text_footer()
        );
        let body = format!(
            r#"<h1 style="margin:0 0 10px;font-size:22px;line-height:1.3;font-weight:700;color:{FG}">{title}</h1>
<p style="margin:0 0 22px;font-size:15px;line-height:1.6;color:{FG2}">{lead_html}</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="background:{BG};border:1px solid {LINE};border-radius:12px;padding:20px 12px">
<div style="font-size:11px;letter-spacing:2px;text-transform:uppercase;color:{FG3};margin-bottom:8px">Your code</div>
<div style="font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:34px;font-weight:700;letter-spacing:6px;color:{EMBER}">{spaced}</div>
<div style="font-size:12px;color:{FG3};margin-top:10px">Expires in {ttl_minutes} minutes</div>
</td></tr></table>
<p style="margin:22px 0 0;font-size:13px;line-height:1.6;color:{FG3}">{warn}</p>"#
        );
        self.send(to, subject, &format!("{title}: {code}"), &text, &body).await
    }

    /// Sent once, right after a client verifies their email address.
    pub async fn send_welcome(&self, to: &str, first_name: &str) -> anyhow::Result<()> {
        let name = html_escape(first_name);
        let Links { app, trade, .. } = &self.links;
        let text = format!(
            "Welcome to Kalks, {first_name}!\n\nYour account is ready. Here's how to get started:\n\n1. Verify your identity: {app}/profile/verification\n2. Fund your wallet (USDT): {app}/wallet/deposit\n3. Open a trading account: {app}/accounts/new\n4. Start trading in Kalks Trader: {trade}\n\nNeed help? Reply to this email or write to {support}.\n\n{footer}",
            support = self.links.support_email,
            footer = self.text_footer()
        );
        let step = |n: &str, title: &str, desc: &str| {
            format!(
                r#"<tr><td style="padding:0 0 14px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
<td width="36" valign="top"><div style="width:28px;height:28px;border-radius:14px;background:{BG};border:1px solid {LINE};color:{GOLD};font-size:13px;font-weight:700;line-height:28px;text-align:center">{n}</div></td>
<td valign="top" style="padding-left:6px"><div style="font-size:15px;font-weight:600;color:{FG}">{title}</div><div style="font-size:13px;line-height:1.55;color:{FG3};margin-top:2px">{desc}</div></td>
</tr></table></td></tr>"#
            )
        };
        let steps = [
            step("1", "Verify your identity", "A quick ID check unlocks withdrawals and higher limits."),
            step("2", "Fund your wallet", "Deposit USDT (TRC20) to your Kalks wallet in minutes."),
            step("3", "Open a trading account", "Choose Standard, Pro, ECN or Cent, with leverage up to your group's limit."),
            step("4", "Trade in Kalks Trader", "Live charts, one-click trading, 35 indicators and the AI Trader."),
        ]
        .concat();
        let body = format!(
            r#"<h1 style="margin:0 0 10px;font-size:24px;line-height:1.3;font-weight:700;color:{FG}">Welcome to Kalks, {name}</h1>
<p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:{FG2}">Your account is ready. You now have access to forex, metals, indices, energies, crypto and stock CFDs, all from one wallet and one Client Area. Here's how to get started:</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">{steps}</table>
<table role="presentation" cellpadding="0" cellspacing="0" style="margin:10px 0 6px"><tr>
<td style="border-radius:10px;background:{EMBER}"><a href="{app}/accounts/new" style="display:inline-block;padding:13px 22px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:10px">Open trading account</a></td>
<td width="10"></td>
<td style="border-radius:10px;border:1px solid {LINE};background:{BG}"><a href="{trade}" style="display:inline-block;padding:12px 20px;font-size:15px;font-weight:600;color:{FG};text-decoration:none;border-radius:10px">Launch Kalks Trader</a></td>
</tr></table>
<p style="margin:22px 0 0;font-size:13px;line-height:1.6;color:{FG3}">Questions? Just reply to this email. Our support team is here to help.</p>"#
        );
        self.send(to, "Welcome to Kalks", "Your account is ready. Here's how to get started.", &text, &body).await
    }

    async fn send(&self, to: &str, subject: &str, preheader: &str, text: &str, body_html: &str) -> anyhow::Result<()> {
        let html = self.layout(preheader, body_html);
        let logo = Attachment::new_inline(LOGO_CID.to_string()).body(LOGO_PNG.to_vec(), "image/png".parse()?);
        let reply_to: Mailbox = format!("Kalks Support <{}>", self.links.support_email).parse()?;
        let msg = Message::builder()
            .from(self.from.clone())
            .reply_to(reply_to)
            .to(to.parse()?)
            .subject(subject)
            .multipart(
                MultiPart::alternative()
                    .singlepart(SinglePart::builder().header(ContentType::TEXT_PLAIN).body(text.to_string()))
                    .multipart(
                        MultiPart::related()
                            .singlepart(SinglePart::builder().header(ContentType::TEXT_HTML).body(html))
                            .singlepart(logo),
                    ),
            )?;
        self.transport.send(msg).await?;
        Ok(())
    }

    fn layout(&self, preheader: &str, body: &str) -> String {
        let Links { site, support_email, .. } = &self.links;
        let site_host = site.trim_start_matches("https://").trim_start_matches("http://");
        let preheader = html_escape(preheader);
        format!(
            r#"<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="dark light"><title>Kalks</title></head>
<body style="margin:0;padding:0;background:{BG};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:{FG}">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:{BG}">{preheader}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:{BG}"><tr><td align="center" style="padding:32px 14px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px">
<tr><td style="padding:0 4px 18px"><img src="cid:{LOGO_CID}" width="120" height="40" alt="Kalks" style="display:block;border:0;outline:none;width:120px;height:40px"></td></tr>
<tr><td style="background:{CARD};border:1px solid {LINE};border-radius:16px;overflow:hidden">
<div style="height:3px;background:{EMBER};background-image:linear-gradient(90deg,{EMBER},{GOLD})"></div>
<div style="padding:30px 28px 28px">{body}</div>
</td></tr>
<tr><td style="padding:20px 6px 0;font-size:12px;line-height:1.6;color:{FG3}">
<a href="{site}" style="color:{FG2};text-decoration:none">{site_host}</a> · <a href="mailto:{support_email}" style="color:{FG2};text-decoration:none">{support_email}</a><br>
You received this email because of activity on your Kalks account.<br><br>
<span style="color:#6b6b75">Risk warning: CFDs are complex instruments and come with a high risk of losing money rapidly due to leverage. Only trade with money you can afford to lose.</span>
</td></tr>
</table></td></tr></table></body></html>"#
        )
    }

    fn text_footer(&self) -> String {
        format!(
            "Kalks · {} · {}\nRisk warning: CFDs are complex instruments and come with a high risk of losing money rapidly due to leverage.",
            self.links.site, self.links.support_email
        )
    }
}

fn html_escape(s: &str) -> String {
    s.replace('&', "&amp;").replace('<', "&lt;").replace('>', "&gt;").replace('"', "&quot;").replace('\'', "&#39;")
}
