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

export const metadata: Metadata = { title: "Marksheet" };

export default async function MarksheetPage({ params }: PageProps<"/results/[examId]/[studentId]">) {
  await requireAdmin();
  const { examId, studentId } = await params;
  const data = await getExamResults(examId);
  const row = data?.rows.find((r) => r.student.id === studentId);
  if (!data || !row) notFound();
  const { exam, specs, scale, settings, rows } = data;

  return (
    <>
      <div className="print:hidden">
        <PageHeader
          title="Marksheet"
          actions={
            <>
              <Link href={`/results?exam=${exam.id}`} data-header="desktop" className={buttonVariants({ variant: "ghost" })}>
                <ArrowLeft /> Results
              </Link>
              <PrintButton label="Print marksheet" />
            </>
          }
        />
      </div>
      <Marksheet
        center={{ name: settings?.name ?? "Coaching Center", address: settings?.address ?? null, phone: settings?.phone ?? null }}
        exam={{ name: exam.name, scope: exam.batch?.name ?? exam.classLevel?.name ?? "", year: exam.academicYear.name, startDate: exam.startDate }}
        student={row.student}
        specs={specs}
        result={row.result}
        rank={row.rank}
        candidates={rows.length}
        scale={scale}
        draft={exam.status === "DRAFT"}
      />
    </>
  );
}
