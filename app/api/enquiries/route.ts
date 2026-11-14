import { NextRequest, NextResponse } from "next/server";
import { getPayload } from "payload";

import config from "../../../payload.config";

/* =========================================================
   POST - SAVE ENQUIRY
========================================================= */

export async function POST(request: NextRequest) {
  try {
    /* =====================================================
       GET FORM DATA
    ===================================================== */

    const body = await request.json();

    const {
      name,
      email,
      phone,
      property,
      message,
      source,
    } = body;

    /* =====================================================
       VALIDATION
    ===================================================== */

    if (!name || !email || !phone) {
      return NextResponse.json(
        {
          success: false,
          message: "Name, email and phone are required",
        },
        {
          status: 400,
        }
      );
    }

    /* =====================================================
       INITIALIZE PAYLOAD
    ===================================================== */

    const payload = await getPayload({
      config,
    });

    /* =====================================================
       CREATE ENQUIRY
       Payload → MongoDB
    ===================================================== */

    const enquiry = await payload.create({
      collection: "enquiries",

      data: {
        name: String(name).trim(),

        email: String(email)
          .trim()
          .toLowerCase(),

        phone: String(phone).trim(),

        property:
          property && String(property).trim()
            ? String(property).trim()
            : "Dholera Property",

        message:
          message && String(message).trim()
            ? String(message).trim()
            : "",

        source:
          source && String(source).trim()
            ? String(source).trim()
            : "website",

        status: "new",
      },
    });

    /* =====================================================
       TERMINAL LOG
    ===================================================== */

    console.log(
      "✅ Payload enquiry saved:",
      enquiry.id
    );

    /* =====================================================
       SUCCESS RESPONSE
    ===================================================== */

    return NextResponse.json(
      {
        success: true,
        message: "Enquiry saved successfully",
        data: enquiry,
      },
      {
        status: 201,
      }
    );
  } catch (error) {
    console.error(
      "❌ Enquiry API Error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message: "Failed to save enquiry",
      },
      {
        status: 500,
      }
    );
  }
}

/* =========================================================
   GET - OPTIONAL
   Useful for testing
========================================================= */

export async function GET() {
  try {
    const payload = await getPayload({
      config,
    });

    const enquiries = await payload.find({
      collection: "enquiries",
      limit: 50,
      sort: "-createdAt",
    });

    return NextResponse.json(
      {
        success: true,
        ...enquiries,
      },
      {
        status: 200,
      }
    );
  } catch (error) {
    console.error(
      "❌ Get enquiries error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message: "Failed to load enquiries",
      },
      {
        status: 500,
      }
    );
  }
}