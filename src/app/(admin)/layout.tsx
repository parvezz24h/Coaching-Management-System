import { Suspense } from "react";
import { SidebarNav, SidebarNavView } from "@/components/app-sidebar";
import { MobileNav } from "@/components/mobile-nav";
import { PageSkeleton } from "@/components/page-skeleton";
import { HeaderPanelSlot, HeaderSlots, HeaderTitle, PageTitleProvider } from "@/components/page-title";
import { Skeleton } from "@/components/ui/skeleton";
import { UserMenu } from "@/components/user-menu";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/session";

// The shell (sidebar frame, header) is static. Everything that reads the
// session or the database streams in behind a Suspense boundary.

async function getCenterName() {
  const settings = await db.centerSettings.findUnique({ where: { id: "default" }, select: { name: true } });
  return settings?.name ?? "Coaching Center";
}

async function Sidebar() {
  return <SidebarNav centerName={await getCenterName()} />;
}

async function HeaderContent() {
  const [session, centerName] = await Promise.all([requireAdmin(), getCenterName()]);
  return (
    <>
      <MobileNav centerName={centerName} name={session.user.name} email={session.user.email} />
      <HeaderTitle className="flex-1" />
      <HeaderSlots />
      <div className="hidden lg:block">
        <UserMenu name={session.user.name} email={session.user.email} />
      </div>
    </>
  );
}

/** Blocks page content until the session is verified. */
async function AuthGate({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  return children;
}

export default function AdminLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-svh">
      <aside className="sticky top-0 hidden h-svh w-60 shrink-0 border-r bg-sidebar lg:block print:hidden">
        <Suspense fallback={<SidebarNavView centerName="" pathname="" />}>
          <Sidebar />
        </Suspense>
      </aside>
      <PageTitleProvider>
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-30 border-b bg-background/85 backdrop-blur supports-backdrop-filter:bg-background/70 print:hidden">
            <div className="flex h-14 items-center gap-2 px-4 lg:px-6">
              <Suspense
                fallback={
                  <>
                    <Skeleton className="h-5 w-40" />
                    <div className="flex-1" />
                    <Skeleton className="h-8 w-32" />
                  </>
                }
              >
                <HeaderContent />
              </Suspense>
            </div>
            <HeaderPanelSlot />
          </header>
          <main className="flex-1 px-4 py-6 lg:px-8">
            <Suspense fallback={<PageSkeleton />}>
              <AuthGate>{children}</AuthGate>
            </Suspense>
          </main>
        </div>
      </PageTitleProvider>
    </div>
  );
}
