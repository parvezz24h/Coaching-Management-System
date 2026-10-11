import type { Metadata } from "next";
import Link from "next/link";
import { BarChart3, Download } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { PrintButton } from "@/components/print-button";
import { UrlFilter } from "@/components/url-filter";
import { UrlInput } from "@/components/url-input";
import { db } from "@/lib/db";
import { formatDate, formatDateTime, formatMoney, parseDateInput, todayISO } from "@/lib/format";
import { buildReport, type ColumnType, dateRange, REPORTS, reportKey } from "@/lib/reports";
import { requireAdmin } from "@/lib/session";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Reports" };

function display(value: string | number | null, type: ColumnType | undefined, symbol: string) {
  if (value == null || value === "") return "—";
  switch (type) {
    case "money":
      return formatMoney(value, symbol);
    case "percent":
      return typeof value === "number" ? `${value}%` : value;
    case "date":
      return typeof value === "string" ? formatDate(parseDateInput(value)) : value;
    default:
      return value;
  }
}

const numeric = (t?: ColumnType) => t === "number" || t === "money" || t === "percent";

export default async function ReportsPage({ searchParams }: PageProps<"/reports">) {
  await requireAdmin();
  const sp = await searchParams;
  const key = reportKey(sp);
  const [report, batches, classes, years, settings] = await Promise.all([
    buildReport(key, sp),
    db.batch.findMany({ where: { status: "ACTIVE" }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.classLevel.findMany({ orderBy: { sortOrder: "asc" }, select: { id: true, name: true } }),
    db.academicYear.findMany({ orderBy: { startDate: "desc" }, select: { id: true, name: true } }),
    db.centerSettings.findUnique({ where: { id: "default" }, select: { name: true, currencySymbol: true } }),
  ]);
  const symbol = settings?.currencySymbol ?? "৳";
  const exportParams = new URLSearchParams(
    Object.entries(sp).filter((e): e is [string, string] => typeof e[1] === "string"),
  );
  exportParams.set("report", key);
  const { from, to } = dateRange(sp);
  const today = todayISO();

  return (
    <>
      <div className="print:hidden">
        <PageHeader
          title="Reports"
          description="Academic and financial reports — print them or export to Excel (CSV)"
          actions={
            <>
              <PrintButton />
              <a href={`/reports/export?${exportParams.toString()}`} className={buttonVariants()}>
                <Download /> Export CSV
              </a>
            </>
          }
        />
        <div className="mb-3 grid sm:hidden">
          <UrlFilter
            param="report"
            wide
            allLabel={REPORTS[0].label}
            options={REPORTS.slice(1).map((r) => ({ value: r.key, label: r.label }))}
          />
        </div>
        <nav className="mb-4 hidden flex-wrap gap-1 border-b sm:flex" aria-label="Reports">
          {REPORTS.map((r) => (
            <Link
              key={r.key}
              href={`/reports?report=${r.key}`}
              aria-current={r.key === key ? "page" : undefined}
              className={cn(
                "-mb-px shrink-0 border-b-2 px-3 py-2 text-sm whitespace-nowrap",
                r.key === key ? "border-primary font-medium" : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {r.label}
            </Link>
          ))}
        </nav>
        <Filters reportKey={key} from={from} to={to} today={today} batches={batches} classes={classes} years={years} />
      </div>

      <div className="mb-1 hidden print:block">
        <p className="text-sm font-semibold">{settings?.name}</p>
        <p className="text-xs text-muted-foreground">Printed {formatDateTime(new Date())}</p>
      </div>
      <h2 className="mb-3 text-lg font-semibold">{report.title}</h2>

      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {report.summary.map((s) => (
          <Card key={s.label} size="sm">
            <CardContent>
              <p className="text-xs text-muted-foreground">{s.label}</p>
              <p className="text-lg font-semibold tabular-nums">{display(s.value, s.type, symbol)}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {report.rows.length === 0 ? (
        <EmptyState icon={BarChart3} title="No data for these filters" />
      ) : (
        <div className="overflow-x-auto rounded-xl border bg-card print:overflow-visible print:rounded-none print:border-0">
          <table className="w-full text-sm print:text-xs">
            <thead className="bg-muted/50 text-xs">
              <tr>
                {report.columns.map((c, ci) => (
                  <th
                    key={c.key}
                    className={cn(
                      "px-3 py-2 font-medium whitespace-nowrap",
                      numeric(c.type) ? "text-right" : "text-left",
                      ci === 0 && "sticky left-0 z-10 bg-muted sm:static sm:bg-transparent",
                    )}
                  >
                    {c.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {report.rows.map((r, i) => (
                <tr key={i} className="border-t">
                  {report.columns.map((c, ci) => (
                    <td
                      key={c.key}
                      className={cn(
                        "px-3 py-1.5 whitespace-nowrap",
                        ci === 0 && "sticky left-0 z-10 bg-card sm:static",
                        numeric(c.type) && "text-right tabular-nums",
                        c.key === "code" && "font-mono text-xs",
                        c.key === "rate" && typeof r.rate === "number" && r.rate < 75 && "font-medium text-destructive",
                      )}
                    >
                      {display(r[c.key], c.type, symbol)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="mt-2 text-xs text-muted-foreground">
        {report.rows.length} row{report.rows.length === 1 ? "" : "s"}
        {report.note && ` · ${report.note}`}
      </p>
    </>
  );
}

function Filters({
  reportKey: key,
  from,
  to,
  today,
  batches,
  classes,
  years,
}: {
  reportKey: string;
  from: string;
  to: string;
  today: string;
  batches: { id: string; name: string }[];
  classes: { id: string; name: string }[];
  years: { id: string; name: string }[];
}) {
  const batchOptions = batches.map((b) => ({ value: b.id, label: b.name }));
  const range = (
    <>
      <UrlInput param="from" type="date" defaultValue={from} max={today} label="From date" />
      <span className="hidden self-center text-sm text-muted-foreground sm:inline">to</span>
      <UrlInput param="to" type="date" defaultValue={to} max={today} label="To date" />
    </>
  );
  return (
    <div className="mb-4 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center">
      {key === "students" && (
        <>
          <UrlFilter param="class" options={classes.map((c) => ({ value: c.id, label: c.name }))} allLabel="All classes" />
          <UrlFilter param="batch" options={batchOptions} allLabel="All batches" />
          <UrlFilter
            param="status"
            options={[
              { value: "ACTIVE", label: "Active" },
              { value: "INACTIVE", label: "Inactive" },
              { value: "LEFT", label: "Left" },
            ]}
            allLabel="All statuses"
          />
        </>
      )}
      {key === "attendance" && (
        <>
          <UrlFilter param="batch" options={batchOptions} allLabel="All batches" />
          {range}
        </>
      )}
      {key === "collection" && range}
      {key === "dues" && (
        <>
          <UrlFilter param="batch" options={batchOptions} allLabel="All batches" />
          <UrlFilter param="overdue" options={[{ value: "1", label: "Overdue only" }]} allLabel="All outstanding" />
        </>
      )}
      {key === "exams" && <UrlFilter param="year" options={years.map((y) => ({ value: y.id, label: y.name }))} allLabel="All years" />}
    </div>
  );
}
