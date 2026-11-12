import { NextResponse } from "next/server";
import mongoose from "mongoose";

import { validateMongoTestTarget } from "@/lib/mongodb-test-target";
import { authorizePreviewMongoDiagnostic, previewMongoDiagnosticBody } from "@/lib/noida-preview-mongodb-diagnostic";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const privateHeaders = {
  "Cache-Control": "private, no-store, max-age=0",
  "X-Content-Type-Options": "nosniff",
};

// POST is a bounded, authenticated Preview-only check of the actual CRM URI.
// It creates no models, indexes, collections, or application records.
export async function POST(request: Request) {
  let target;
  try {
    target = authorizePreviewMongoDiagnostic(
      { url: request.url, authorization: request.headers.get("authorization"), hasBody: request.body !== null },
      process.env,
    );
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404, headers: privateHeaders });
  }

  let connection: mongoose.Connection | undefined;
  try {
    connection = mongoose.createConnection(target.uri, {
      autoIndex: false,
      serverSelectionTimeoutMS: 5_000,
    });
    await connection.asPromise();
    const db = connection.db;
    if (!db || db.databaseName !== target.database) throw new Error("Database identity mismatch");
    const result = await db.admin().command({ ping: 1 });
    if (result.ok !== 1) throw new Error("MongoDB ping failed");

    return NextResponse.json(
      previewMongoDiagnosticBody(target, { ping: "PASS", connectedDatabase: db.databaseName }),
      { headers: privateHeaders },
    );
  } catch {
    return NextResponse.json(
      previewMongoDiagnosticBody(target, { ping: "FAIL", connectedDatabase: null }),
      { status: 503, headers: privateHeaders },
    );
  } finally {
    await connection?.close().catch(() => undefined);
  }
}

export async function GET() {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ success: false, message: "Not found" }, { status: 404 });
  }

  let connection: mongoose.Connection | undefined;
  try {
    const { uri } = validateMongoTestTarget(
      process.env.MONGODB_TEST_URI,
      process.env.MONGODB_URI,
    );
    connection = await mongoose
      .createConnection(uri, { serverSelectionTimeoutMS: 15_000 })
      .asPromise();

    if (!connection.db) throw new Error("MongoDB database handle is unavailable");
    await connection.db.admin().command({ ping: 1 });

    return NextResponse.json({
      success: true,
      message: "MongoDB TEST connection is healthy",
    });
  } catch {
    console.error("MongoDB TEST connection check failed");
    return NextResponse.json(
      {
        success: false,
        message: "MongoDB TEST connection failed",
      },
      { status: 500 }
    );
  } finally {
    await connection?.close().catch(() => undefined);
  }
}
