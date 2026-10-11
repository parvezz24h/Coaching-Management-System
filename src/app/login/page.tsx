import type { Metadata } from "next";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { GraduationCap } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Admin login" };

async function CenterName() {
  const settings = await db.centerSettings.findUnique({ where: { id: "default" }, select: { name: true } });
  return settings?.name ?? "Coaching Management";
}

/** Sends already-signed-in admins to the dashboard (after a real session check). */
async function RedirectIfSignedIn() {
  if (await getSession()) redirect("/dashboard");
  return null;
}

export default function LoginPage() {
  return (
    <main className="flex min-h-svh items-center justify-center bg-muted/40 p-4">
      <Suspense>
        <RedirectIfSignedIn />
      </Suspense>
      <Card className="w-full max-w-sm">
        <CardHeader className="items-center text-center">
          <div className="mx-auto mb-2 flex size-11 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <GraduationCap className="size-6" />
          </div>
          <CardTitle className="text-xl">
            <Suspense fallback="Coaching Management">
              <CenterName />
            </Suspense>
          </CardTitle>
          <CardDescription>Sign in to the admin panel</CardDescription>
        </CardHeader>
        <CardContent>
          <LoginForm />
        </CardContent>
      </Card>
    </main>
  );
}
