"use client";

import { LeadForm, type FieldDef } from "./LeadForm";

const fields: FieldDef[] = [
  { name: "name", label: "Full name", required: true, placeholder: "Your name", half: true },
  { name: "email", label: "Work email", type: "email", required: true, placeholder: "you@company.com", half: true },
  { name: "company", label: "Company", placeholder: "Brokerage or project name", half: true },
  { name: "phone", label: "Phone / WhatsApp", type: "tel", placeholder: "+971 ...", half: true },
  {
    name: "topic",
    label: "Topic",
    type: "select",
    required: true,
    placeholder: "Choose one",
    options: ["Sales enquiry", "Technical support", "Partnerships", "Careers", "Other"],
  },
  { name: "message", label: "Message", type: "textarea", required: true, placeholder: "How can we help?" },
];

export function ContactForm() {
  return (
    <LeadForm
      type="contact"
      fields={fields}
      submitLabel="Send Message"
      successTitle="Message sent"
      successBody="Thanks for reaching out. Our team will reply within 24 hours."
    />
  );
}
