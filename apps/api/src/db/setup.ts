import { Client } from "pg";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { loadConfig } from "../config.js";

export function quoteIdentifier(identifier: string): string {
  return `"${identifier.replaceAll('"', '""')}"`;
}

export function getDatabaseName(databaseUrl: string): string {
  const url = new URL(databaseUrl);
  const databaseName = decodeURIComponent(url.pathname.slice(1));
  if (!databaseName) {
    throw new Error("DATABASE_URL must include a database name.");
  }
  return databaseName;
}

export function getMaintenanceUrl(databaseUrl: string): string {
  const url = new URL(databaseUrl);
  url.pathname = "/postgres";
  return url.toString();
}

export async function setup(): Promise<void> {
  const config = loadConfig();
  if (config.STORAGE_MODE === "file") {
    console.log(`File-backed storage is enabled at ${config.DATA_FILE}; no database setup is needed.`);
    return;
  }
  const databaseName = getDatabaseName(config.DATABASE_URL);
  const maintenanceClient = new Client({
    connectionString: getMaintenanceUrl(config.DATABASE_URL),
  });

  await maintenanceClient.connect();
  try {
    const existing = await maintenanceClient.query<{ exists: boolean }>(
      "SELECT EXISTS (SELECT 1 FROM pg_database WHERE datname = $1) AS exists",
      [databaseName],
    );
    if (!existing.rows[0]?.exists) {
      await maintenanceClient.query(
        `CREATE DATABASE ${quoteIdentifier(databaseName)}`,
      );
      console.log(`Created database ${databaseName}.`);
    } else {
      console.log(`Database ${databaseName} already exists.`);
    }
  } finally {
    await maintenanceClient.end();
  }

  const databaseClient = new Client({ connectionString: config.DATABASE_URL });
  await databaseClient.connect();
  try {
    const postgis = await databaseClient.query<{ installed: boolean }>(
      "SELECT EXISTS (SELECT 1 FROM pg_available_extensions WHERE name = 'postgis') AS installed",
    );
    if (!postgis.rows[0]?.installed) {
      throw new Error(
        "PostGIS is not installed on this PostgreSQL server. Install PostGIS for this PostgreSQL version, then rerun npm run db:setup.",
      );
    }
    console.log(
      "PostGIS is available. Run npm run db:migrate, then npm run db:seed.",
    );
  } finally {
    await databaseClient.end();
  }
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  setup().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
}
