import { LogoMark } from "@/components/icons";
import { isSupabaseConfigured } from "@/lib/env";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { SignUpForm } from "./signup-form";

export const metadata: Metadata = { title: "Create account" };

export default function SignUpPage() {
  if (!isSupabaseConfigured) redirect("/login");

  return (
    <main className="relative grid min-h-dvh place-items-center overflow-hidden px-4">
      <div className="pointer-events-none absolute -top-40 left-1/2 h-[480px] w-[720px] -translate-x-1/2 rounded-full bg-accent/20 blur-[120px]" />
      <div className="relative w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <LogoMark className="size-11" />
          <h1 className="mt-5 text-xl font-semibold tracking-tight">Create your account</h1>
          <p className="mt-1 text-sm text-muted">Invited by a teammate? Use the email they invited.</p>
        </div>
        <div className="card p-6">
          <SignUpForm />
        </div>
        <p className="mt-4 text-center text-xs text-muted">
          Already have an account?{" "}
          <Link href="/login" className="text-fg hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </main>
  );
}
