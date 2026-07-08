/**
 * Seed script — reads JSON fixtures and upserts into table storage.
 * Supports both Azure Table Storage (via Managed Identity) and Azurite (local dev).
 *
 * Usage:
 *   npx tsx scripts/seed-data.ts
 *
 * Prerequisites:
 *   - Azure: set AZURE_STORAGE_ACCOUNT_NAME and authenticate with az login
 *   - Local: Azurite must be running: azurite-table --silent --location .azurite
 */
import { TableClient, TableServiceClient } from "@azure/data-tables";
import { DefaultAzureCredential } from "@azure/identity";
import fs from "node:fs/promises";
import path from "node:path";

const STORAGE_ACCOUNT = process.env.AZURE_STORAGE_ACCOUNT_NAME;

const AZURITE_CONN_STRING =
  "DefaultEndpointsProtocol=http;AccountName=devstoreaccount1;" +
  "AccountKey=Eby8vdM02xNOcqFlqUwJPLlmEtlCDXJ1OUzFT50uSRZ6IFsuFq2UVErCz4I6tq/K1SZFPTOtr/KBHBeksoGMGw==;" +
  "TableEndpoint=http://127.0.0.1:10002/devstoreaccount1";

const FIXTURES_DIR = path.join(import.meta.dirname, "..", "fixtures");

interface TimelineEntry {
  stage: string;
  status: string;
  actor?: string;
  comment?: string;
  timestamp: string;
}

interface AccessRequest {
  id: string;
  employeeName: string;
  employeeEmail: string;
  system: string;
  role: string;
  justification: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  timeline: TimelineEntry[];
}

function getServiceClient(): TableServiceClient {
  if (STORAGE_ACCOUNT) {
    // Try connection string first (for shared key access during seeding)
    const connString = process.env.AZURE_STORAGE_CONNECTION_STRING;
    if (connString) {
      return TableServiceClient.fromConnectionString(connString);
    }
    // Fall back to MI
    return new TableServiceClient(
      `https://${STORAGE_ACCOUNT}.table.core.windows.net`,
      new DefaultAzureCredential(),
    );
  }
  return TableServiceClient.fromConnectionString(AZURITE_CONN_STRING, { allowInsecureConnection: true });
}

function getTableClient(tableName: string): TableClient {
  if (STORAGE_ACCOUNT) {
    // Try connection string first
    const connString = process.env.AZURE_STORAGE_CONNECTION_STRING;
    if (connString) {
      return TableClient.fromConnectionString(connString, tableName);
    }
    // Fall back to MI
    return new TableClient(
      `https://${STORAGE_ACCOUNT}.table.core.windows.net`,
      tableName,
      new DefaultAzureCredential(),
    );
  }
  return TableClient.fromConnectionString(AZURITE_CONN_STRING, tableName, { allowInsecureConnection: true });
}

async function seed() {
  const serviceClient = getServiceClient();

  // ─── Seed AccessRequests table ────────────────────────────────────
  const requestsTableName = "AccessRequests";
  await serviceClient.createTable(requestsTableName).catch(() => {});
  const requestsClient = getTableClient(requestsTableName);

  const requestsData = await fs.readFile(
    path.join(FIXTURES_DIR, "access-requests.json"),
    "utf-8",
  );
  const requests: AccessRequest[] = JSON.parse(requestsData);

  for (const req of requests) {
    await requestsClient.upsertEntity({
      partitionKey: "requests",
      rowKey: req.id,
      employeeName: req.employeeName,
      employeeEmail: req.employeeEmail,
      system: req.system,
      role: req.role,
      justification: req.justification,
      status: req.status,
      createdAt: req.createdAt,
      updatedAt: req.updatedAt,
      timeline: JSON.stringify(req.timeline),
    });
    console.log(`  ✓ upserted request ${req.id} (${req.employeeName})`);
  }

  // ─── Seed Counters table ──────────────────────────────────────────
  const countersTableName = "Counters";
  await serviceClient.createTable(countersTableName).catch(() => {});
  const countersClient = getTableClient(countersTableName);

  const countersData = await fs.readFile(
    path.join(FIXTURES_DIR, "counters.json"),
    "utf-8",
  );
  const counters: { id: string; value: number }[] = JSON.parse(countersData);

  for (const counter of counters) {
    await countersClient.upsertEntity({
      partitionKey: "counters",
      rowKey: counter.id,
      value: counter.value,
    });
    console.log(`  ✓ upserted counter ${counter.id} = ${counter.value}`);
  }

  console.log("\n✓ Seed complete.");
}

seed().catch((e) => {
  console.error(e);
  process.exit(1);
});
