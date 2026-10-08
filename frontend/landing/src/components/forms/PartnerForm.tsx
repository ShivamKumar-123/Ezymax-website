"use client";

import { LeadForm, type FieldDef } from "./LeadForm";

const fields: FieldDef[] = [
  { name: "name", label: "Full name", required: true, placeholder: "Your name", half: true },
  { name: "email", label: "Work email", type: "email", required: true, placeholder: "you@company.com", half: true },
  { name: "company", label: "Company", required: true, placeholder: "Company name", half: true },
  { name: "website", label: "Website", type: "url", placeholder: "https://", half: true },
  {
    name: "partnerType",
    label: "Partner program",
    type: "select",
    required: true,
    placeholder: "Choose one",
    options: ["Referral partner", "Technology partner", "Reseller partner"],
  },
  { name: "message", label: "Tell us about your business", type: "textarea", placeholder: "Region, clients, what you offer..." },
];

export function PartnerForm() {
  return (
    <LeadForm
      type="partner"
      fields={fields}
      submitLabel="Become a Partner"
      successTitle="Application received"
      successBody="Thanks. Our partnerships team will review and reply within 24 hours."
    />
  );
}
