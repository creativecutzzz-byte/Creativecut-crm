import { senderIdentity } from "../config";

// Code (not the model) wraps the body: greeting, body, plain-text signature and
// an opt-out line, so they can never be forgotten or reworded.

export const OPT_OUT_LINE = "If this is not relevant, reply \"no\" and I will not email again.";

export function composeBody(input: { firstName: string | null; body: string; senderName: string | null; stepNo: number }) {
  const id = senderIdentity();
  const greeting = input.firstName ? `Hi ${input.firstName.split(" ")[0]},` : "Hi,";
  const signature = [input.senderName, id.company, id.postalAddress].filter(Boolean).join("\n");
  return [greeting, input.body.trim(), signature, OPT_OUT_LINE].filter(Boolean).join("\n\n");
}
