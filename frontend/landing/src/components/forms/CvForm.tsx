"use client";

import { LeadForm, type FieldDef } from "./LeadForm";

export function CvForm({ roles }: { roles: string[] }) {
  const fields: FieldDef[] = [
    { name: "name", label: "Full name", required: true, placeholder: "Your name", half: true },
    { name: "email", label: "Email", type: "email", required: true, placeholder: "you@email.com", half: true },
    { name: "role", label: "Role", type: "select", required: true, placeholder: "Choose a role", options: [...roles, "Other / general application"], half: true },
    { name: "cvLink", label: "CV or portfolio link", type: "url", required: true, placeholder: "https://", half: true },
    { name: "message", label: "A few lines about you", type: "textarea", placeholder: "Experience, location, notice period..." },
  ];
  return (
    <LeadForm
      type="cv"
      fields={fields}
      submitLabel="Send Your CV"
      successTitle="Application received"
      successBody="Thanks for applying. If there is a match we will be in touch within two weeks."
    />
  );
}
