import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

// Load .env.local for local dev; silently no-ops in CI where DATABASE_URL is
// already set as an environment variable.
config({ path: ".env.local" });

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
