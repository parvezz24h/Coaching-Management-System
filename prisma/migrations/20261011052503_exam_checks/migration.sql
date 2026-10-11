-- Exam integrity checks (not expressible in the Prisma schema).
ALTER TABLE "ExamSubject" ADD CONSTRAINT "ExamSubject_marks_check"
  CHECK ("fullMarks" > 0 AND "passMarks" >= 0 AND "passMarks" <= "fullMarks");

ALTER TABLE "Mark" ADD CONSTRAINT "Mark_obtained_check"
  CHECK (("isAbsent" AND "obtained" IS NULL) OR (NOT "isAbsent" AND "obtained" IS NOT NULL AND "obtained" >= 0));

ALTER TABLE "Exam" ADD CONSTRAINT "Exam_scope_check"
  CHECK ("classLevelId" IS NOT NULL OR "batchId" IS NOT NULL);
