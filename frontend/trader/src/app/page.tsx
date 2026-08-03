import { redirect } from "next/navigation";

/**
 * The trader app no longer carries a marketing landing — that lives in the
 * dedicated landing site (frontend/landing). Root goes straight to sign-in.
 */
export default function Root() {
  redirect("/auth/login");
}
