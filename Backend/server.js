import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import nodemailer from "nodemailer";
import dotenv from "dotenv";
import userModel from "./models/userModel.js";

dotenv.config();

const URI = process.env.MONGODB_URI || "mongodb+srv://mustafashahzad1947:admin123@batch18.dxy4t5s.mongodb.net/";
const PORT = process.env.PORT || 4000;
const JWT_SECRET = process.env.JWT_SECRET || "jwt_sign_sasta_leja_bhai";
const SMTP_EMAIL = process.env.SMTP_EMAIL || "haji08307@gmail.com";
const SMTP_APP_PASS = process.env.SMTP_APP_PASS || "exnv hxbz lpxm quif";

mongoose
  .connect(URI)
  .then(() => console.log("MongoDB connected"))
  .catch((err) => console.error("MongoDB connection error:", err));

const app = express();
app.use(express.json());
app.use(cors());

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: SMTP_EMAIL,
    pass: SMTP_APP_PASS,
  },
});

function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function generateToken(userId, role) {
  return jwt.sign({ userId, role }, JWT_SECRET, { expiresIn: "7d" });
}

app.get("/", (req, res) => {
  res.json({ message: "Server is successfully running...", status: true });
});

app.post("/api/signup", async (req, res) => {
  try {
    const { fullName, email, password, role } = req.body;

    if (!fullName || !email || !password || !role) {
      return res.status(400).json({
        success: false,
        message: "All fields are required",
      });
    }

    if (!["buyer", "seller"].includes(role)) {
      return res.status(400).json({
        success: false,
        message: "Role must be either buyer or seller",
      });
    }

    const existingUser = await userModel.findOne({ email });
    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: "User already exists with this email",
      });
    }

    const verificationCode = generateOTP();
    const verificationCodeExpires = new Date(Date.now() + 10 * 60 * 1000);

    const user = await userModel.create({
      fullName,
      email,
      password,
      role,
      verificationCode,
      verificationCodeExpires,
    });

    const token = generateToken(user._id, user.role);

    const mailOptions = {
      from: SMTP_EMAIL,
      to: email,
      subject: "Verify Your Email - Sasta Leja",
      html: `
        <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: #f8fafc; border-radius: 12px;">
          <div style="background: linear-gradient(135deg, #6366f1, #8b5cf6); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 28px;">Sasta Leja</h1>
            <p style="color: rgba(255,255,255,0.9); margin-top: 8px;">Verify Your Email Address</p>
          </div>
          <div style="background: white; padding: 40px; border-radius: 0 0 12px 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
            <p style="color: #334155; font-size: 16px; line-height: 1.6;">Hi <strong>${fullName}</strong>,</p>
            <p style="color: #475569; font-size: 15px; line-height: 1.6;">Thanks for signing up! Use the OTP below to verify your email address. This OTP will expire in <strong>10 minutes</strong>.</p>
            <div style="background: #f1f5f9; border: 2px dashed #6366f1; border-radius: 8px; padding: 20px; text-align: center; margin: 25px 0;">
              <p style="color: #64748b; font-size: 13px; margin: 0 0 10px 0; text-transform: uppercase; letter-spacing: 1px;">Your Verification Code</p>
              <p style="font-size: 36px; font-weight: bold; color: #6366f1; letter-spacing: 8px; margin: 0;">${verificationCode}</p>
            </div>
            <p style="color: #94a3b8; font-size: 13px; line-height: 1.5;">If you did not create an account, please ignore this email.</p>
          </div>
          <p style="text-align: center; color: #94a3b8; font-size: 12px; margin-top: 20px;">&copy; 2026 Sasta Leja. All rights reserved.</p>
        </div>
      `,
    };

    await transporter.sendMail(mailOptions);

    res.status(201).json({
      success: true,
      message: "Account created! Please verify your email with the OTP sent.",
      data: { token, email, verificationCodeExpires },
    });
  } catch (error) {
    console.error("Signup error:", error);
    res.status(500).json({
      success: false,
      message: "Server error during signup",
    });
  }
});

app.post("/api/verify-email", async (req, res) => {
  try {
    const { email, verificationCode } = req.body;

    if (!email || !verificationCode) {
      return res.status(400).json({
        success: false,
        message: "Email and verification code are required",
      });
    }

    const user = await userModel.findOne({ email });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    if (user.emailVerified) {
      return res.status(400).json({
        success: false,
        message: "Email is already verified",
      });
    }

    if (user.verificationCode !== verificationCode) {
      return res.status(400).json({
        success: false,
        message: "Invalid verification code",
      });
    }

    if (new Date() > user.verificationCodeExpires) {
      return res.status(400).json({
        success: false,
        message: "Verification code has expired",
      });
    }

    user.emailVerified = true;
    user.verificationCode = undefined;
    user.verificationCodeExpires = undefined;
    await user.save();

    const token = generateToken(user._id, user.role);

    res.status(200).json({
      success: true,
      message: "Email verified successfully! You can now login.",
      data: { token, email: user.email, role: user.role },
    });
  } catch (error) {
    console.error("Verification error:", error);
    res.status(500).json({
      success: false,
      message: "Server error during verification",
    });
  }
});

app.post("/api/resend-otp", async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Email is required",
      });
    }

    const user = await userModel.findOne({ email });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    if (user.emailVerified) {
      return res.status(400).json({
        success: false,
        message: "Email is already verified",
      });
    }

    const verificationCode = generateOTP();
    const verificationCodeExpires = new Date(Date.now() + 10 * 60 * 1000);

    user.verificationCode = verificationCode;
    user.verificationCodeExpires = verificationCodeExpires;
    await user.save();

    const mailOptions = {
      from: SMTP_EMAIL,
      to: email,
      subject: "New Verification Code - Sasta Leja",
      html: `
        <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: #f8fafc; border-radius: 12px;">
          <div style="background: linear-gradient(135deg, #6366f1, #8b5cf6); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 28px;">Sasta Leja</h1>
            <p style="color: rgba(255,255,255,0.9); margin-top: 8px;">New Verification Code</p>
          </div>
          <div style="background: white; padding: 40px; border-radius: 0 0 12px 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
            <p style="color: #334155; font-size: 16px; line-height: 1.6;">Hi <strong>${user.fullName}</strong>,</p>
            <p style="color: #475569; font-size: 15px; line-height: 1.6;">Here is your new verification code. This OTP will expire in <strong>10 minutes</strong>.</p>
            <div style="background: #f1f5f9; border: 2px dashed #6366f1; border-radius: 8px; padding: 20px; text-align: center; margin: 25px 0;">
              <p style="color: #64748b; font-size: 13px; margin: 0 0 10px 0; text-transform: uppercase; letter-spacing: 1px;">Your Verification Code</p>
              <p style="font-size: 36px; font-weight: bold; color: #6366f1; letter-spacing: 8px; margin: 0;">${verificationCode}</p>
            </div>
          </div>
          <p style="text-align: center; color: #94a3b8; font-size: 12px; margin-top: 20px;">&copy; 2026 Sasta Leja. All rights reserved.</p>
        </div>
      `,
    };

    await transporter.sendMail(mailOptions);

    res.status(200).json({
      success: true,
      message: "New OTP sent successfully",
    });
  } catch (error) {
    console.error("Resend OTP error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while resending OTP",
    });
  }
});

app.post("/api/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required",
      });
    }

    const user = await userModel.findOne({ email }).select("+password");
    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    const isPasswordCorrect = await user.isPasswordCorrect(password);
    if (!isPasswordCorrect) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    if (!user.emailVerified) {
      return res.status(403).json({
        success: false,
        message: "Please verify your email before logging in",
        data: { email: user.email },
      });
    }

    const token = generateToken(user._id, user.role);

    res.status(200).json({
      success: true,
      message: "Login successful",
      data: {
        token,
        user: {
          id: user._id,
          fullName: user.fullName,
          email: user.email,
          role: user.role,
        },
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({
      success: false,
      message: "Server error during login",
    });
  }
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
