import { AuthSection } from "@/components/ui/auth-section";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <AuthSection>{children}</AuthSection>;
}
