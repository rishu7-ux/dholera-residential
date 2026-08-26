import mongoose, { Schema, models } from "mongoose";

const EnquirySchema = new Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },

    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },

    phone: {
      type: String,
      required: true,
      trim: true,
    },

    property: {
      type: String,
      trim: true,
      default: "Dholera Property",
    },

    message: {
      type: String,
      trim: true,
      default: "",
    },

    source: {
      type: String,
      default: "website",
    },

    status: {
      type: String,
      default: "new",
    },
  },
  {
    timestamps: true,
  }
);

const Enquiry =
  models.Enquiry || mongoose.model("Enquiry", EnquirySchema);

export default Enquiry;