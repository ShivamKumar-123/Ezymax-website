import ContactPage from '@/home-nexola/pages/ContactPage';
import { BRAND_NAME } from '@/lib/brand';

export const metadata = {
  title: `Contact ${BRAND_NAME} | Support, Partners & Media`,
  description: `Contact ${BRAND_NAME} support by live chat or email, 24/7 AI assistant and human specialists. Partnership, API and media enquiries also welcome.`,
};

/** Contact: built on the homepage design system (src/home-nexola). */
export default function Page() {
  return <ContactPage />;
}
