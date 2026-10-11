"use client";

import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field } from "@/components/form-field";
import { applyActionErrors } from "@/components/form-utils";
import { type Option, SelectField } from "@/components/select-field";
import { type StudentInput, studentSchema } from "@/lib/validations/student";
import { createStudent, updateStudent } from "./actions";

const GENDERS: Option[] = [
  { value: "MALE", label: "Male" },
  { value: "FEMALE", label: "Female" },
  { value: "OTHER", label: "Other" },
];
const STATUSES: Option[] = [
  { value: "ACTIVE", label: "Active" },
  { value: "INACTIVE", label: "Inactive" },
  { value: "LEFT", label: "Left" },
];

export function StudentForm({
  studentId,
  defaultValues,
  classLevels,
}: {
  studentId?: string;
  defaultValues: StudentInput;
  classLevels: Option[];
}) {
  const router = useRouter();
  const form = useForm<StudentInput>({ resolver: zodResolver(studentSchema), defaultValues });
  const { errors, isSubmitting } = form.formState;
  const reg = form.register;

  async function onSubmit(values: StudentInput) {
    const result = studentId ? await updateStudent(studentId, values) : await createStudent(values);
    if (!result.ok) return applyActionErrors(result, form.setError);
    toast.success(result.message);
    router.push(`/students/${result.data!.id}`);
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-6" noValidate>
      <Card>
        <CardHeader>
          <CardTitle>Student information</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field label="Full name" htmlFor="name" error={errors.name?.message} required className="sm:col-span-2">
            <Input id="name" {...reg("name")} aria-invalid={!!errors.name} />
          </Field>
          <Field label="Gender" htmlFor="gender" error={errors.gender?.message}>
            <Controller
              control={form.control}
              name="gender"
              render={({ field }) => (
                <SelectField
                  id="gender"
                  value={field.value}
                  onChange={field.onChange}
                  options={GENDERS}
                  noneLabel="Not specified"
                  placeholder="Not specified"
                />
              )}
            />
          </Field>
          <Field label="Date of birth" htmlFor="dateOfBirth" error={errors.dateOfBirth?.message}>
            <Input id="dateOfBirth" type="date" {...reg("dateOfBirth")} />
          </Field>
          <Field label="Phone" htmlFor="phone" error={errors.phone?.message}>
            <Input id="phone" type="tel" {...reg("phone")} aria-invalid={!!errors.phone} />
          </Field>
          <Field label="Email" htmlFor="email" error={errors.email?.message}>
            <Input id="email" type="email" {...reg("email")} aria-invalid={!!errors.email} />
          </Field>
          <Field label="School / college" htmlFor="schoolName" error={errors.schoolName?.message}>
            <Input id="schoolName" {...reg("schoolName")} />
          </Field>
          <Field label="Class" htmlFor="classLevelId" error={errors.classLevelId?.message}>
            <Controller
              control={form.control}
              name="classLevelId"
              render={({ field }) => (
                <SelectField
                  id="classLevelId"
                  value={field.value}
                  onChange={field.onChange}
                  options={classLevels}
                  noneLabel="Not set"
                  placeholder="Select class"
                />
              )}
            />
          </Field>
          <Field label="Address" htmlFor="address" error={errors.address?.message} className="sm:col-span-2">
            <Textarea id="address" rows={2} {...reg("address")} />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Guardian</CardTitle>
          <CardDescription>The main contact for fees and attendance.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field label="Guardian name" htmlFor="guardianName" error={errors.guardianName?.message} required>
            <Input id="guardianName" {...reg("guardianName")} aria-invalid={!!errors.guardianName} />
          </Field>
          <Field label="Guardian phone" htmlFor="guardianPhone" error={errors.guardianPhone?.message} required>
            <Input id="guardianPhone" type="tel" {...reg("guardianPhone")} aria-invalid={!!errors.guardianPhone} />
          </Field>
          <Field label="Relation" htmlFor="guardianRelation" error={errors.guardianRelation?.message}>
            <Input id="guardianRelation" placeholder="Father, Mother…" {...reg("guardianRelation")} />
          </Field>
          <Field label="Occupation" htmlFor="guardianOccupation" error={errors.guardianOccupation?.message}>
            <Input id="guardianOccupation" {...reg("guardianOccupation")} />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Admission</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Admission date"
            htmlFor="admissionDate"
            error={errors.admissionDate?.message}
            hint={studentId ? undefined : "The student ID is numbered by admission year."}
            required
          >
            <Input id="admissionDate" type="date" {...reg("admissionDate")} aria-invalid={!!errors.admissionDate} />
          </Field>
          <Field label="Status" htmlFor="status" error={errors.status?.message}>
            <Controller
              control={form.control}
              name="status"
              render={({ field }) => (
                <SelectField id="status" value={field.value} onChange={field.onChange} options={STATUSES} />
              )}
            />
          </Field>
          <Field label="Notes" htmlFor="notes" error={errors.notes?.message} className="sm:col-span-2">
            <Textarea id="notes" rows={3} {...reg("notes")} />
          </Field>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={() => router.back()} disabled={isSubmitting}>
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="animate-spin" />}
          {studentId ? "Save changes" : "Register student"}
        </Button>
      </div>
    </form>
  );
}
