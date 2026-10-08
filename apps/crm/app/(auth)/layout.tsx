import { IS_DEMO } from "@ezymex/mock/mode";
import { AuthSection } from "@/components/ui/auth-section";
import { FeaturesProvider } from "@/components/tenant-config";
import { tenantConfig } from "@/lib/tenant-config";

// The broker's flags reach the sign-in pages too: closed sign-ups hide "Create an account", and "Continue with Google"
// follows google_login (the gateway refuses both anyway; demo builds have no gateway).
export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const cfg = IS_DEMO ? null : await tenantConfig();
  return (
    <FeaturesProvider value={cfg ? { modules: cfg.modules, flags: cfg.flags } : null}>
      <AuthSection>{children}</AuthSection>
    </FeaturesProvider>
  );
}
