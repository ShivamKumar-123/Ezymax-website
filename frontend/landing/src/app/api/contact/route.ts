import { getServerEnv } from "@/env";
import { ApiError, handle } from "@/lib/api";
import { leadSchema } from "@/lib/lead-schema";

/**
 * The one lead endpoint. Every form on the site posts here — contact,
 * newsletter, CV, partner enquiry — distinguished by `type`.
 *
 * It replaces an `/api/lead` route that only `console.log`ed its input, which
 * meant every submission was silently discarded. Do not recreate that route:
 * a second endpoint is a second place for leads to vanish.
 *
 * The *waitlist* deliberately does not come here. It is the invite gate and
 * has to reach the gateway, so it keeps its own route at `/api/waitlist`.
 *
 * Secrets are safe in this file — `route.ts` is never bundled to the browser.
 */

export const POST = handle(async (req) => {
  const { _hp, ...lead } = leadSchema.parse(await req.json());

  // Honeypot: a real person never sees this field, so anything in it is a bot.
  // Report success and store nothing, rather than telling the bot it failed.
  if (_hp) return { received: true };

  const { CONTACT_ENDPOINT } = getServerEnv();

  if (CONTACT_ENDPOINT) {
    const upstream = await fetch(CONTACT_ENDPOINT, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(lead),
    });
    if (!upstream.ok) {
      throw new ApiError(
        502,
        "upstream_error",
        "Failed to deliver the message.",
      );
    }
  } else {
    // No upstream configured yet. Logging at least leaves the submission in
    // the container logs instead of dropping it on the floor -- but this is a
    // stopgap: set CONTACT_ENDPOINT before pointing real traffic at a form.
    console.warn(
      `[api/contact] no CONTACT_ENDPOINT set; lead:${lead.type} logged only`,
      JSON.stringify(lead),
    );
  }

  return { received: true };
});
