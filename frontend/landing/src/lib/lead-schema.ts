import { z } from "zod";

export const leadTypes = ["demo", "contact", "newsletter", "cv", "partner"] as const;
export type LeadType = (typeof leadTypes)[number];

export const leadSchema = z.object({
  type: z.enum(leadTypes),
  name: z.string().trim().min(2).max(120).optional(),
  email: z.string().trim().email().max(200),
  company: z.string().trim().max(160).optional(),
  phone: z.string().trim().max(40).optional(),
  brokerageType: z.string().trim().max(80).optional(),
  topic: z.string().trim().max(80).optional(),
  role: z.string().trim().max(120).optional(),
  partnerType: z.string().trim().max(80).optional(),
  website: z.string().trim().max(200).optional(),
  cvLink: z.string().trim().max(300).optional(),
  message: z.string().trim().max(3000).optional(),
  source: z.string().trim().max(120).optional(),
  /** Honeypot. Must stay empty. */
  _hp: z.string().max(0).optional(),
});

export type LeadPayload = z.infer<typeof leadSchema>;
