import mongoose from "mongoose";

const otpSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, lowercase: true, trim: true },
    code: { type: String, required: true },
    // Distinguishes signup verification codes from password reset codes so a
    // code issued for one flow can never be replayed in the other.
    purpose: {
      type: String,
      enum: ["email-verification", "password-reset"],
      default: "email-verification",
    },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true, collection: "otps" },
);

export default mongoose.model("Otp", otpSchema);
