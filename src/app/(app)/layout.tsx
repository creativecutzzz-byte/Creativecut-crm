import { signOut } from "@/app/actions/auth";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { getViewer } from "@/lib/data";
import { redirect } from "next/navigation";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const viewer = await getViewer();
  if (viewer.mode === "live" && !viewer.userId) redirect("/login");

  return (
    <div className="min-h-dvh">
      <Sidebar orgName={viewer.orgName} />
      <div className="lg:pl-64">
        <Topbar
          orgName={viewer.orgName}
          userName={viewer.fullName}
          email={viewer.email}
          mode={viewer.mode}
          signOut={viewer.mode === "live" ? signOut : undefined}
        />
        <main className="mx-auto w-full max-w-[1400px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          {viewer.mode === "live" && !viewer.orgId ? <NoOrganization /> : children}
        </main>
      </div>
    </div>
  );
}

function NoOrganization() {
  return (
    <div className="card mx-auto max-w-lg p-8 text-center">
      <h2 className="text-lg font-semibold">You&apos;re not part of a workspace yet</h2>
      <p className="mt-2 text-sm text-muted">
        Ask an admin to invite your email from the Team page, or create the agency workspace by calling
        <code className="mx-1 rounded bg-white/5 px-1 py-0.5 text-xs">create_organization</code> in Supabase.
      </p>
    </div>
  );
}
