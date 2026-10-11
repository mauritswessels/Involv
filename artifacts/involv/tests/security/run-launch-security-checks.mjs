import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

function fail(message) {
  console.error(`Security checks not started: ${message}`);
  process.exit(1);
}

const environment = process.env.SUPABASE_TEST_ENV;
if (environment !== "staging") {
  fail("set SUPABASE_TEST_ENV=staging to confirm this is a staging-only run.");
}

const projectRef = process.env.SUPABASE_STAGING_PROJECT_REF;
if (!projectRef || !/^[a-z0-9]{20}$/.test(projectRef)) {
  fail("SUPABASE_STAGING_PROJECT_REF must be the 20-character staging project reference.");
}

const connectionString = process.env.SUPABASE_DB_URL;
if (!connectionString) {
  fail("SUPABASE_DB_URL must contain the staging PostgreSQL connection URL.");
}

let databaseUrl;
try {
  databaseUrl = new URL(connectionString);
} catch {
  fail("SUPABASE_DB_URL is not a valid PostgreSQL connection URL.");
}

if (!["postgres:", "postgresql:"].includes(databaseUrl.protocol)) {
  fail("SUPABASE_DB_URL must use the postgres or postgresql protocol.");
}

const hostname = databaseUrl.hostname.toLowerCase();
const username = decodeURIComponent(databaseUrl.username);
const directStagingHost = `db.${projectRef}.supabase.co`;
const isDirectStagingConnection =
  hostname === directStagingHost && username === "postgres";
const isStagingPoolerConnection =
  hostname.endsWith(".pooler.supabase.com") &&
  username === `postgres.${projectRef}`;

if (!isDirectStagingConnection && !isStagingPoolerConnection) {
  fail(
    "the connection host and database user do not match SUPABASE_STAGING_PROJECT_REF; production and unrecognized hosts are refused.",
  );
}

const databaseName = decodeURIComponent(databaseUrl.pathname.replace(/^\/+/, ""));
if (databaseName !== "postgres") {
  fail("the Supabase connection must target the postgres database.");
}

const sslMode = databaseUrl.searchParams.get("sslmode") || "require";
if (!["require", "verify-ca", "verify-full"].includes(sslMode)) {
  fail("the connection must use sslmode=require, verify-ca, or verify-full.");
}

if (!databaseUrl.password) {
  fail("SUPABASE_DB_URL must include its database password.");
}

const scriptPath = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../../supabase/tests/launch_security_checks.sql",
);
const psqlArgs = [
  "--no-psqlrc",
  "--set=ON_ERROR_STOP=1",
  "--set=launch_security_test_environment=staging",
  `--set=launch_security_test_project_ref=${projectRef}`,
  "--host",
  hostname,
  "--port",
  databaseUrl.port || "5432",
  "--username",
  username,
  "--dbname",
  databaseName,
  "--file",
  scriptPath,
];

const psqlEnvironment = {
  PATH: process.env.PATH,
  HOME: process.env.HOME,
  PGPASSWORD: decodeURIComponent(databaseUrl.password),
  PGSSLMODE: sslMode,
  PGCONNECT_TIMEOUT: "10",
};

const sslRootCertificate = databaseUrl.searchParams.get("sslrootcert");
if (sslRootCertificate) {
  psqlEnvironment.PGSSLROOTCERT = sslRootCertificate;
}

console.log(
  `Running role and saved-opportunity ownership checks against staging project ${projectRef}.`,
);
const result = spawnSync("psql", psqlArgs, {
  env: psqlEnvironment,
  stdio: "inherit",
});

if (result.error) {
  fail(`could not start psql (${result.error.message}). Install PostgreSQL client tools.`);
}

process.exit(result.status ?? 1);