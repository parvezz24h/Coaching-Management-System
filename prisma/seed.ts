import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { createOrReactivateAdmin } from "../src/lib/admins";
import { DEFAULT_CLASS_LEVELS, DEFAULT_GRADING_SCALE } from "../src/lib/constants";

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });

const DEFAULT_SUBJECTS = [
  ["Bangla", "BAN"],
  ["English", "ENG"],
  ["Mathematics", "MATH"],
  ["Higher Mathematics", "HMATH"],
  ["Physics", "PHY"],
  ["Chemistry", "CHEM"],
  ["Biology", "BIO"],
  ["ICT", "ICT"],
  ["General Science", "GSCI"],
  ["Accounting", "ACC"],
] as const;

async function seedAdmin() {
  const name = process.env.ADMIN_NAME || "Administrator";
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) throw new Error("Set ADMIN_EMAIL and ADMIN_PASSWORD in .env");
  if (password.length < 8) throw new Error("ADMIN_PASSWORD must be at least 8 characters");

  const { status } = await createOrReactivateAdmin(db, { name, email, password });
  console.log(status === "exists" ? `Admin ${email} already exists — leaving password unchanged.` : `Admin ${email} ${status}.`);
}

async function main() {
  await seedAdmin();

  await db.centerSettings.upsert({
    where: { id: "default" },
    create: { id: "default", gradingScale: DEFAULT_GRADING_SCALE },
    update: {},
  });

  for (const [i, name] of DEFAULT_CLASS_LEVELS.entries()) {
    await db.classLevel.upsert({ where: { name }, create: { name, sortOrder: i + 1 }, update: {} });
  }

  for (const [name, code] of DEFAULT_SUBJECTS) {
    await db.subject.upsert({ where: { code }, create: { name, code }, update: {} });
  }

  const year = new Date().getFullYear();
  if ((await db.academicYear.count()) === 0) {
    await db.academicYear.create({
      data: {
        name: String(year),
        startDate: new Date(`${year}-01-01T00:00:00.000Z`),
        endDate: new Date(`${year}-12-31T00:00:00.000Z`),
        isCurrent: true,
      },
    });
  }
  console.log("Seed complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
