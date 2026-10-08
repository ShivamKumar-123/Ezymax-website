"use client";

import { useState, type FormEvent } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";
import { cn } from "@/lib/cn";
import type { LeadType } from "@/lib/lead-schema";
import { Button } from "@/components/ui/Button";
import { Input, Label, Select, Textarea } from "@/components/ui/Field";

export type FieldDef = {
  name: string;
  label: string;
  type?: "text" | "email" | "tel" | "url" | "textarea" | "select";
  placeholder?: string;
  required?: boolean;
  options?: string[];
  half?: boolean;
};

type LeadFormProps = {
  type: LeadType;
  fields: FieldDef[];
  submitLabel: string;
  successTitle: string;
  successBody: string;
  source?: string;
  className?: string;
  compact?: boolean;
};

type Status = "idle" | "submitting" | "success" | "error";

export function LeadForm({ type, fields, submitLabel, successTitle, successBody, source, className, compact }: LeadFormProps) {
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus("submitting");
    setError(null);
    const data = Object.fromEntries(new FormData(e.currentTarget).entries());
    try {
      const res = await fetch("/api/lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, type, source }),
      });
      if (!res.ok) throw new Error(`Request failed (${res.status})`);
      setStatus("success");
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "Something went wrong");
    }
  }

  if (status === "success") {
    return (
      <div className={cn("flex flex-col items-start gap-3 rounded-card border border-orange-500/30 bg-orange-500/10 p-6", className)} role="status">
        <CheckCircle2 className="size-7 text-orange-400" />
        <h3 className="font-display text-xl font-semibold text-ink">{successTitle}</h3>
        <p className="text-sm leading-relaxed text-muted">{successBody}</p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className={cn("grid gap-4", !compact && "sm:grid-cols-2", className)} noValidate={false}>
      {/* Honeypot */}
      <div className="absolute -left-[9999px] top-0 h-0 w-0 overflow-hidden" aria-hidden>
        <label>
          Leave this field empty
          <input type="text" name="_hp" tabIndex={-1} autoComplete="off" />
        </label>
      </div>
      {fields.map((f) => {
        const id = `${type}-${f.name}`;
        const wrapper = cn(!compact && !f.half && "sm:col-span-2");
        return (
          <div key={f.name} className={wrapper}>
            <Label htmlFor={id}>
              {f.label}
              {f.required ? <span className="text-orange-400"> *</span> : null}
            </Label>
            {f.type === "textarea" ? (
              <Textarea id={id} name={f.name} placeholder={f.placeholder} required={f.required} />
            ) : f.type === "select" ? (
              <Select id={id} name={f.name} required={f.required} defaultValue="">
                <option value="" disabled>
                  {f.placeholder ?? "Select"}
                </option>
                {f.options?.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </Select>
            ) : (
              <Input id={id} name={f.name} type={f.type ?? "text"} placeholder={f.placeholder} required={f.required} />
            )}
          </div>
        );
      })}
      <div className={cn("flex flex-col gap-3", !compact && "sm:col-span-2")}>
        <Button type="submit" size="lg" disabled={status === "submitting"} className="w-full sm:w-auto">
          {status === "submitting" ? (
            <span className="inline-flex items-center gap-2">
              <Loader2 className="size-4 animate-spin" /> Sending
            </span>
          ) : (
            submitLabel
          )}
        </Button>
        {status === "error" ? (
          <p className="text-sm text-orange-300" role="alert">
            {error}. Please try again.
          </p>
        ) : null}
        <p className="text-xs text-dim">We reply within 24 hours. No spam, ever.</p>
      </div>
    </form>
  );
}
