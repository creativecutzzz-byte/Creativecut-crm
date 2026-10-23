import { signOut } from "@/app/actions/auth";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { CreateWorkspaceForm } from "@/components/layout/create-workspace-form";
import { getRequestTime, getTasks, getViewer } from "@/lib/data";
import { redirect } from "next/navigation";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const viewer = await getViewer();
  if (viewer.mode === "live" && !viewer.userId) redirect("/login");
  const now = getRequestTime();
  const dueTasks = viewer.orgId || viewer.mode === "demo"
    ? (await getTasks()).filter((t) => t.status === "open" && t.assignee_id === viewer.userId && t.due_at && new Date(t.due_at).getTime() <= now).length
    : 0;

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
          openTasks={dueTasks}
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
    <div className="card mx-auto max-w-lg p-8">
      <h2 className="text-lg font-semibold">Set up your workspace</h2>
      <p className="mt-2 text-sm text-muted">
        Create your agency&apos;s workspace to start adding leads and clients. If a teammate already invited you, ask them to check the invite used
        this exact email, then reload this page.
      </p>
      <div className="mt-6">
        <CreateWorkspaceForm />
      </div>
    </div>
  );
}
