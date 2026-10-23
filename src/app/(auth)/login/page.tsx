import { LogoMark } from "@/components/icons";
import { isSupabaseConfigured } from "@/lib/env";
import type { Metadata } from "next";
import Link from "next/link";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const { next, error } = await searchParams;

  return (
    <main className="relative grid min-h-dvh place-items-center overflow-hidden px-4">
      <div className="pointer-events-none absolute -top-40 left-1/2 h-[480px] w-[720px] -translate-x-1/2 rounded-full bg-accent/20 blur-[120px]" />
      <div className="relative w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <LogoMark className="size-11" />
          <h1 className="mt-5 text-xl font-semibold tracking-tight">Sign in to Creative Cut</h1>
          <p className="mt-1 text-sm text-muted">Your agency&apos;s AI-powered CRM</p>
        </div>
        <div className="card p-6">
          {isSupabaseConfigured ? (
            <LoginForm next={next} initialError={error ? "That sign-in link is invalid or expired." : undefined} />
          ) : (
            <div className="space-y-4 text-sm">
              <p className="text-muted">
                Supabase isn&apos;t configured yet, so the CRM is running in <span className="text-fg">demo mode</span> with sample data.
                Add your project URL and anon key to <code className="rounded bg-white/5 px-1 py-0.5 text-xs">.env.local</code> to enable sign-in.
              </p>
              <a href="/dashboard" className="flex h-9 items-center justify-center rounded-lg bg-accent text-sm font-medium text-white hover:bg-accent-strong">
                Explore the demo
              </a>
            </div>
          )}
        </div>
        {isSupabaseConfigured && (
          <p className="mt-4 text-center text-xs text-muted">
            New here?{" "}
            <Link href="/signup" className="text-fg hover:underline">
              Create an account
            </Link>
          </p>
        )}
      </div>
    </main>
  );
}
