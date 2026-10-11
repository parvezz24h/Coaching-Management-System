import { headers } from "next/headers";
import type { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { toCsv } from "@/lib/csv";
import { buildReport, reportKey } from "@/lib/reports";

export async function GET(request: NextRequest) {
  // Route handlers must check the session themselves; the proxy is only a cookie check.
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return new Response("Unauthorized", { status: 401 });

  const sp = Object.fromEntries(request.nextUrl.searchParams);
  const key = reportKey(sp);
  const report = await buildReport(key, sp);
  const stamp = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Dhaka" }).format(new Date());
  return new Response(toCsv(report), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${key}-report-${stamp}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
