import "dotenv/config";
import path from "node:path";
import { defineConfig } from "vitest/config";

// Integration tests run against a separate database: TEST_DATABASE_URL, or the
// dev DATABASE_URL with "_test" appended to the database name.
function testDatabaseUrl() {
  if (process.env.TEST_DATABASE_URL) return process.env.TEST_DATABASE_URL;
  if (!process.env.DATABASE_URL) return "";
  const url = new URL(process.env.DATABASE_URL);
  url.pathname = `${url.pathname}_test`;
  return url.toString();
}

const alias = {
  "@": path.resolve(__dirname, "src"),
  // "server-only" throws outside a React Server Components bundle.
  "server-only": path.resolve(__dirname, "tests/support/empty.ts"),
};

export default defineConfig({
  test: {
    // Global option (ignored per project): integration files share one database.
    fileParallelism: false,
    projects: [
      {
        resolve: { alias },
        test: { name: "unit", include: ["src/**/*.test.ts"], environment: "node" },
      },
      {
        resolve: { alias },
        test: {
          name: "integration",
          include: ["tests/integration/**/*.test.ts"],
          environment: "node",
          globalSetup: ["tests/support/global-setup.ts"],
          setupFiles: ["tests/support/setup.ts"],
          env: { DATABASE_URL: testDatabaseUrl(), BETTER_AUTH_SECRET: "test-secret-test-secret-test-secret", NODE_ENV: "test" },
          testTimeout: 30_000,
          hookTimeout: 60_000,
        },
      },
    ],
  },
});
