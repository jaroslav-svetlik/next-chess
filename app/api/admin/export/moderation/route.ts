import { NextResponse } from "next/server";

import {
  canAccessAdmin,
  getAdminModerationExportData,
  normalizeAdminPeriodDays
} from "@/lib/admin";
import { getSession } from "@/lib/session";

function normalizeExportType(value: string | null) {
  return value === "outcomes" ? "outcomes" : "flagged_accounts";
}

function escapeCsv(value: string | number | null | undefined) {
  const normalized = value === null || value === undefined ? "" : String(value);
  if (normalized.includes(",") || normalized.includes("\"") || normalized.includes("\n")) {
    return `"${normalized.replaceAll("\"", "\"\"")}"`;
  }

  return normalized;
}

function toCsv(rows: Record<string, string | number>[]) {
  if (!rows.length) {
    return "";
  }

  const headers = Object.keys(rows[0]);
  const lines = [
    headers.join(","),
    ...rows.map((row) => headers.map((header) => escapeCsv(row[header])).join(","))
  ];

  return `${lines.join("\n")}\n`;
}

export async function GET(request: Request) {
  const session = await getSession();

  if (!session?.user?.email || !canAccessAdmin(session.user.email)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const periodDays = normalizeAdminPeriodDays(searchParams.get("period"));
  const exportType = normalizeExportType(searchParams.get("type"));
  const data = await getAdminModerationExportData(exportType, periodDays);
  const csv = toCsv(data.rows);
  const filename = `moderation-${exportType}-${periodDays}d.csv`;

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename=\"${filename}\"`,
      "Cache-Control": "no-store"
    }
  });
}
