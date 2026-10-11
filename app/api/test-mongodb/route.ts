import { NextResponse } from "next/server";
import mongoose from "mongoose";

import { validateMongoTestTarget } from "@/lib/mongodb-test-target";

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
