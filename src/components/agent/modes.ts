import { ShieldCheck, Zap } from "lucide-react";
import type { Mode } from "@/lib/agent/types";

export const MODE_TEXT: Record<Mode, { title: string; desc: string; icon: typeof Zap }> = {
  AUTO: { title: "Auto", desc: "Finds leads and sends eligible emails on schedule when live sending is enabled.", icon: Zap },
  REVIEW: { title: "Review & Approve", desc: "Prepares drafts and waits for your approval.", icon: ShieldCheck },
};
