// Pure helpers of the AI Trader conversation (no React Native: tested in scripts/ai-lib.test.mts).
import type { AiMessage } from "./thread";

/**
 * The conversation without a failed exchange: the error bubble `errorId` and the client's message it answered (when
 * it is the one right before it). Asking again then shows the message once, not repeated under the error.
 */
export function withoutFailed(messages: AiMessage[], errorId: string | undefined): AiMessage[] {
  if (!errorId) return messages;
  const i = messages.findIndex((m) => m.id === errorId && m.kind === "error");
  if (i < 0) return messages;
  const err = messages[i] as Extract<AiMessage, { kind: "error" }>;
  const prev = messages[i - 1];
  const from = prev?.kind === "user" && prev.text === err.prompt ? i - 1 : i;
  return [...messages.slice(0, from), ...messages.slice(i + 1)];
}

type DeploymentRow = { id: number; versionId: number; login: number; status: string };

/** The deployment of this version that runs (or is paused) on this account: the one an earlier Deploy started. */
export function runningDeployment(items: DeploymentRow[], versionId: number, login: number): number | null {
  return items.find((d) => d.versionId === versionId && d.login === login && (d.status === "running" || d.status === "paused"))?.id ?? null;
}
