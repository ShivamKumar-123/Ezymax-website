"use client";

import { Modal } from "@/components/ui/Modal";
import { useDemo } from "./demo-context";
import { LeadForm, type FieldDef } from "./LeadForm";

const fields: FieldDef[] = [
  { name: "name", label: "Full name", required: true, placeholder: "Your name", half: true },
  { name: "email", label: "Work email", type: "email", required: true, placeholder: "you@company.com", half: true },
  { name: "company", label: "Company", placeholder: "Brokerage or project name", half: true },
  { name: "phone", label: "Phone / WhatsApp", type: "tel", placeholder: "+971 ...", half: true },
  {
    name: "brokerageType",
    label: "What are you building?",
    type: "select",
    required: true,
    placeholder: "Choose one",
    options: ["CFD White Label", "Prop Firm", "Forex & Options", "Crypto Brokerage", "Custom Platform", "Single module (CRM, bridge, etc.)", "Not sure yet"],
  },
  { name: "message", label: "Tell us about your plans", type: "textarea", placeholder: "Target markets, timeline, current provider..." },
];

export function DemoModal() {
  const { isOpen, close, source } = useDemo();
  return (
    <Modal
      open={isOpen}
      onClose={close}
      title="Book a Free Demo"
      description="Tell us about your brokerage and we will send a tailored setup plan and quote within 24 hours."
    >
      <LeadForm
        type="demo"
        source={source}
        fields={fields}
        submitLabel="Request My Demo"
        successTitle="Request received"
        successBody="Thanks. A SetupZero specialist will reach out within 24 hours with a tailored setup plan."
      />
    </Modal>
  );
}
