import { execSync } from "node:child_process";
import { Client } from "pg";
import type { TestProject } from "vitest/node";

/** Create the test database if needed and bring it up to the latest migration. */
export default async function setup(project: TestProject) {
  const url = project.config.env?.DATABASE_URL as string | undefined;
  if (!url) throw new Error("No DATABASE_URL / TEST_DATABASE_URL for integration tests");
  const target = new URL(url);
  const dbName = decodeURIComponent(target.pathname.slice(1));
  if (!dbName.endsWith("_test") && !process.env.ALLOW_NON_TEST_DB) {
    throw new Error(`Refusing to run integration tests against "${dbName}" (name must end in _test)`);
  }

  const admin = new URL(url);
  admin.pathname = "/postgres";
  admin.search = "";
  const client = new Client({ connectionString: admin.toString() });
  await client.connect();
  const exists = await client.query("SELECT 1 FROM pg_database WHERE datname = $1", [dbName]);
  if (exists.rowCount === 0) await client.query(`CREATE DATABASE "${dbName.replace(/"/g, '""')}"`);
  await client.end();

  execSync("pnpm -s prisma migrate deploy", { env: { ...process.env, DATABASE_URL: url }, stdio: "pipe" });
}
