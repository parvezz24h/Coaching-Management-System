import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Marksheet } from "@/components/marksheet";
import { PageHeader } from "@/components/page-header";
import { PrintButton } from "@/components/print-button";
import { getExamResults } from "@/lib/exams";
import { requireAdmin } from "@/lib/session";

export const metadata: Metadata = { title: "All marksheets" };

export default async function AllMarksheetsPage({ params }: PageProps<"/results/[examId]/marksheets">) {
  await requireAdmin();
  const { examId } = await params;
  const data = await getExamResults(examId);
  if (!data) notFound();
  const { exam, specs, scale, settings, rows } = data;
  const center = { name: settings?.name ?? "Coaching Center", address: settings?.address ?? null, phone: settings?.phone ?? null };
  const examInfo = { name: exam.name, scope: exam.batch?.name ?? exam.classLevel?.name ?? "", year: exam.academicYear.name, startDate: exam.startDate };

  return (
    <>
      <div className="print:hidden">
        <PageHeader
          title="All marksheets"
          description={`${exam.name} · ${rows.length} students · one page each when printed`}
          actions={
            <>
              <Link href={`/results?exam=${exam.id}`} className={buttonVariants({ variant: "ghost" })}>
                <ArrowLeft /> Results
              </Link>
              <PrintButton label="Print all" />
            </>
          }
        />
      </div>
      <div className="grid gap-6 print:block">
        {rows.map((r) => (
          <Marksheet
            key={r.student.id}
            center={center}
            exam={examInfo}
            student={r.student}
            specs={specs}
            result={r.result}
            rank={r.rank}
            candidates={rows.length}
            scale={scale}
            draft={exam.status === "DRAFT"}
          />
        ))}
      </div>
    </>
  );
}
