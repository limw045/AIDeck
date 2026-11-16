"use client";

import { useFormStatus } from "react-dom";
import type { ReactNode } from "react";

export default function SubmitButton({ children, pendingLabel = "Saving…", secondary = false }: { children: ReactNode; pendingLabel?: string; secondary?: boolean }) {
  const { pending } = useFormStatus();
  return <button type="submit" className={secondary ? "secondary" : undefined} disabled={pending} aria-busy={pending}>{pending ? pendingLabel : children}</button>;
}
