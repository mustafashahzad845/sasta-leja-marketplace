import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import nodemailer from "nodemailer";
import dotenv from "dotenv";
import { setServers } from "node:dns/promises";
import { v2 as cloudinary } from "cloudinary";
import multer from "multer";
import userModel from "./models/userModel.js";
import otpModel from "./models/otpModel.js";
import productModel from "./models/productModel.js";

dotenv.config();

// Fix: force Node's DNS resolver to use public DNS servers.
// This machine's default resolver is 127.0.0.1 (a local DNS/VPN proxy) which
// refuses SRV lookups, breaking mongodb+srv connections with
// "querySrv ECONNREFUSED". Public DNS resolves the Atlas SRV records correctly.
setServers(["8.8.8.8", "8.8.4.4"]);

const URI = process.env.MONGODB_URI ;
const PORT = process.env.PORT || 4000;
const JWT_SECRET = process.env.JWT_SECRET;
const SMTP_EMAIL = process.env.SMTP_EMAIL ;
const SMTP_APP_PASS = process.env.SMTP_APP_PASS
const CLOUDINARY_CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME || process.env.CLOUDE_NAME;
const CLOUDINARY_API_KEY = process.env.CLOUDINARY_API_KEY;
const CLOUDINARY_API_SECRET = process.env.CLOUDINARY_API_SECRET;

cloudinary.config({
  cloud_name: CLOUDINARY_CLOUD_NAME,
  api_key: CLOUDINARY_API_KEY,
  api_secret: CLOUDINARY_API_SECRET,
});

const productImageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith("image/")) {
      return cb(new Error("Only image files are allowed"));
    }
    cb(null, true);
  },
});

function uploadProductImage(req, res, next) {
  productImageUpload.single("image")(req, res, (err) => {
    if (err) {
      return res.status(400).json({
        success: false,
        message: "Image upload failed: " + err.message,
      });
    }
    next();
  });
}

mongoose
  .connect(URI)
  .then(() => console.log("MongoDB connected to database:", mongoose.connection.db.databaseName))
  .catch((err) => console.error("MongoDB connection error:", err));

const app = express();
app.use(express.json());

// CORS: the frontend runs from a different origin than this API and sends
// credentials (cookies) on login. The wildcard "*" origin is rejected by the
// browser whenever credentials are used, so we echo an explicit allowlisted
// origin instead. Extra production origins can be set via CORS_ORIGINS
// (comma separated).
const configuredOrigins = (process.env.CORS_ORIGINS || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const localDevOrigin = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;

function isAllowedOrigin(origin) {
  // No Origin header: same-origin, curl, Postman or server-to-server calls.
  if (!origin) return true;
  if (configuredOrigins.includes(origin)) return true;
  if (process.env.NODE_ENV === "production") return false;
  // Local dev only: pages opened from disk send "null", localhost any port.
  if (origin === "null") return true;
  return localDevOrigin.test(origin);
}

app.use(
  cors({
    origin(origin, callback) {
      callback(null, isAllowedOrigin(origin));
    },
    credentials: true,
  })
);

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

function authRequired(req, res, next) {
  const header = req.headers.authorization || "";
  const bearerToken = header.startsWith("Bearer ") ? header.slice(7) : null;
  const cookieToken = parseCookie(req.headers.cookie || "").token;

  const token = bearerToken || cookieToken;
  if (!token) {
    return res.status(401).json({ success: false, message: "Not authenticated" });
  }
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.userId = decoded.userId;
    req.role = decoded.role;
    next();
  } catch {
    return res.status(401).json({ success: false, message: "Invalid or expired token" });
  }
}

function parseCookie(cookieHeader) {
  const result = {};
  if (!cookieHeader) return result;
  cookieHeader.split(";").forEach((part) => {
    const [key, ...rest] = part.trim().split("=");
    if (key) {
      result[key] = decodeURIComponent(rest.join("="));
    }
  });
  return result;
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

    const otp = await otpModel.create({
      email,
      code: generateOTP(),
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    });

    const verificationCode = otp.code;

    const user = await userModel.create({
      fullName,
      email,
      password,
      role,
    });

    const token = generateToken(user._id, user.role);

    res.cookie("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    const mailOptions = {
      from: SMTP_EMAIL,
      to: email,
      subject: "Verify Your Email - Sasta Leja",
      html: `
        <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: #fffbf5; border-radius: 12px;">
          <div style="background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
            <h1 style="color: #f97316; margin: 0; font-size: 28px; font-weight: 800;">Sasta Leja</h1>
            <p style="color: rgba(255,255,255,0.85); margin-top: 8px; font-weight: 500;">Verify Your Email Address</p>
          </div>
          <div style="background: #ffffff; padding: 40px; border-radius: 0 0 12px 12px; box-shadow: 0 4px 12px rgba(15, 23, 42, 0.06);">
            <p style="color: #0f172a; font-size: 16px; line-height: 1.6;">Hi <strong>${fullName}</strong>,</p>
            <p style="color: #1e293b; font-size: 15px; line-height: 1.6; margin-top: 12px;">Thanks for signing up! Use the OTP below to verify your email address. This OTP will expire in <strong>10 minutes</strong>.</p>
            <div style="background: #fff7ed; border: 2px dashed #f97316; border-radius: 8px; padding: 20px; text-align: center; margin: 25px 0;">
              <p style="color: #64748b; font-size: 13px; margin: 0 0 10px 0; text-transform: uppercase; letter-spacing: 1px; font-weight: 600;">Your Verification Code</p>
              <p style="font-size: 36px; font-weight: 800; color: #f97316; letter-spacing: 8px; margin: 0;">${verificationCode}</p>
            </div>
            <p style="color: #64748b; font-size: 13px; line-height: 1.5;">If you did not create an account, please ignore this email.</p>
          </div>
          <p style="text-align: center; color: #94a3b8; font-size: 12px; margin-top: 20px;">&copy; 2026 Sasta Leja. All rights reserved.</p>
        </div>
      `,
    };

    try {
      await transporter.sendMail(mailOptions);
    } catch (emailError) {
      console.error("Signup email error:", emailError);
    }

    res.status(201).json({
      success: true,
      message: "Account created! Please verify your email with the OTP sent.",
      data: { token, email },
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

    const otp = await otpModel.findOne({
      email,
      code: verificationCode,
      // A password-reset code must never verify the signup flow.
      purpose: { $ne: "password-reset" },
    });
    if (!otp) {
      return res.status(400).json({
        success: false,
        message: "Invalid verification code",
      });
    }

    if (new Date() > otp.expiresAt) {
      return res.status(400).json({
        success: false,
        message: "Verification code has expired",
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

    user.emailVerified = true;
    await user.save();
    await otpModel.deleteOne({ _id: otp._id });

    res.status(200).json({
      success: true,
      message: "Email verified successfully! You can now login.",
      data: { email: user.email, role: user.role },
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

    await otpModel.deleteMany({ email, purpose: { $ne: "password-reset" } });

    const otp = await otpModel.create({
      email,
      code: generateOTP(),
      purpose: "email-verification",
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    });

    const verificationCode = otp.code;

    const mailOptions = {
      from: SMTP_EMAIL,
      to: email,
      subject: "New Verification Code - Sasta Leja",
      html: `
        <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: #fffbf5; border-radius: 12px;">
          <div style="background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
            <h1 style="color: #f97316; margin: 0; font-size: 28px; font-weight: 800;">Sasta Leja</h1>
            <p style="color: rgba(255,255,255,0.85); margin-top: 8px; font-weight: 500;">New Verification Code</p>
          </div>
          <div style="background: #ffffff; padding: 40px; border-radius: 0 0 12px 12px; box-shadow: 0 4px 12px rgba(15, 23, 42, 0.06);">
            <p style="color: #0f172a; font-size: 16px; line-height: 1.6;">Hi <strong>${user.fullName}</strong>,</p>
            <p style="color: #1e293b; font-size: 15px; line-height: 1.6; margin-top: 12px;">Here is your new verification code. This OTP will expire in <strong>10 minutes</strong>.</p>
            <div style="background: #fff7ed; border: 2px dashed #f97316; border-radius: 8px; padding: 20px; text-align: center; margin: 25px 0;">
              <p style="color: #64748b; font-size: 13px; margin: 0 0 10px 0; text-transform: uppercase; letter-spacing: 1px; font-weight: 600;">Your Verification Code</p>
              <p style="font-size: 36px; font-weight: 800; color: #f97316; letter-spacing: 8px; margin: 0;">${verificationCode}</p>
            </div>
          </div>
          <p style="text-align: center; color: #94a3b8; font-size: 12px; margin-top: 20px;">&copy; 2026 Sasta Leja. All rights reserved.</p>
        </div>
      `,
    };

    try {
      await transporter.sendMail(mailOptions);
    } catch (emailError) {
      console.error("Resend OTP email error:", emailError);
    }

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

    res.cookie("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

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

app.post("/api/logout", (req, res) => {
  res.clearCookie("token");
  res.status(200).json({ success: true, message: "Logged out successfully" });
});

// ===================== PASSWORD RESET =====================

// Step 1: request a reset code. The response is intentionally identical whether
// or not the email exists, so the endpoint cannot be used to enumerate accounts.
app.post("/api/forgot-password", async (req, res) => {
  const genericMessage =
    "If an account exists for that email, a password reset code has been sent.";

  try {
    const rawEmail = req.body ? req.body.email : "";
    const email = typeof rawEmail === "string" ? rawEmail.trim().toLowerCase() : "";

    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Email is required",
      });
    }

    const user = await userModel.findOne({ email });
    if (!user) {
      return res.status(200).json({ success: true, message: genericMessage });
    }

    // Only replace previous reset codes, leaving signup verification intact.
    await otpModel.deleteMany({ email, purpose: "password-reset" });

    const otp = await otpModel.create({
      email,
      code: generateOTP(),
      purpose: "password-reset",
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    });

    const mailOptions = {
      from: SMTP_EMAIL,
      to: email,
      subject: "Reset Your Password - Sasta Leja",
      html: `
        <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: #fffbf5; border-radius: 12px;">
          <div style="background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
            <h1 style="color: #f97316; margin: 0; font-size: 28px; font-weight: 800;">Sasta Leja</h1>
            <p style="color: rgba(255,255,255,0.85); margin-top: 8px; font-weight: 500;">Password Reset Request</p>
          </div>
          <div style="background: #ffffff; padding: 40px; border-radius: 0 0 12px 12px; box-shadow: 0 4px 12px rgba(15, 23, 42, 0.06);">
            <p style="color: #0f172a; font-size: 16px; line-height: 1.6;">Hi <strong>${user.fullName}</strong>,</p>
            <p style="color: #1e293b; font-size: 15px; line-height: 1.6; margin-top: 12px;">We received a request to reset your password. Use the code below to choose a new one. This code will expire in <strong>10 minutes</strong>.</p>
            <div style="background: #fff7ed; border: 2px dashed #f97316; border-radius: 8px; padding: 20px; text-align: center; margin: 25px 0;">
              <p style="color: #64748b; font-size: 13px; margin: 0 0 10px 0; text-transform: uppercase; letter-spacing: 1px; font-weight: 600;">Your Reset Code</p>
              <p style="font-size: 36px; font-weight: 800; color: #f97316; letter-spacing: 8px; margin: 0;">${otp.code}</p>
            </div>
            <p style="color: #64748b; font-size: 13px; line-height: 1.5;">If you did not request a password reset, you can safely ignore this email — your password will not change.</p>
          </div>
          <p style="text-align: center; color: #94a3b8; font-size: 12px; margin-top: 20px;">&copy; 2026 Sasta Leja. All rights reserved.</p>
        </div>
      `,
    };

    try {
      await transporter.sendMail(mailOptions);
    } catch (emailError) {
      console.error("Password reset email error:", emailError);
    }

    res.status(200).json({ success: true, message: genericMessage });
  } catch (error) {
    console.error("Forgot password error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while processing password reset request",
    });
  }
});

// Step 2: verify the reset code and store the new password.
app.post("/api/reset-password", async (req, res) => {
  try {
    const { email, verificationCode, newPassword } = req.body || {};

    if (!email || !verificationCode || !newPassword) {
      return res.status(400).json({
        success: false,
        message: "Email, verification code and new password are required",
      });
    }

    if (String(newPassword).length < 6) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 6 characters",
      });
    }

    const normalizedEmail = String(email).trim().toLowerCase();

    const otp = await otpModel.findOne({
      email: normalizedEmail,
      code: String(verificationCode),
      purpose: "password-reset",
    });
    if (!otp) {
      return res.status(400).json({
        success: false,
        message: "Invalid verification code",
      });
    }

    if (new Date() > otp.expiresAt) {
      return res.status(400).json({
        success: false,
        message: "Verification code has expired",
      });
    }

    const user = await userModel.findOne({ email: normalizedEmail });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Assigning the plain password lets the schema pre-save hook hash it.
    user.password = newPassword;
    await user.save();

    await otpModel.deleteMany({ email: normalizedEmail, purpose: "password-reset" });

    res.status(200).json({
      success: true,
      message: "Password reset successfully. You can now login with your new password.",
    });
  } catch (error) {
    console.error("Reset password error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while resetting password",
    });
  }
});

// ===================== PRODUCT ROUTES (Seller) =====================

app.post("/api/products/upload", authRequired, uploadProductImage, async (req, res) => {
  try {
    if (req.role !== "seller") {
      return res.status(403).json({
        success: false,
        message: "Only sellers can upload images",
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "No image file provided",
      });
    }

    if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_API_KEY || !CLOUDINARY_API_SECRET) {
      return res.status(500).json({
        success: false,
        message: "Cloudinary is not configured on the server",
      });
    }

    const base64 = req.file.buffer.toString("base64");
    const dataUri = `data:${req.file.mimetype};base64,${base64}`;

    const result = await cloudinary.uploader.upload(dataUri, {
      folder: "sasta-leja/products",
      resource_type: "image",
    });

    res.status(200).json({
      success: true,
      message: "Image uploaded successfully",
      data: { imageUrl: result.secure_url, publicId: result.public_id },
    });
  } catch (error) {
    console.error("Image upload error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Server error while uploading image",
    });
  }
});

app.post("/api/products", authRequired, async (req, res) => {
  try {
    if (req.role !== "seller") {
      return res.status(403).json({
        success: false,
        message: "Only sellers can add products",
      });
    }

    const { name, category, condition, location, brand, price, description, image, featured, draft } = req.body;

    if (!name || !category || !condition || !location || price == null) {
      return res.status(400).json({
        success: false,
        message: "Name, category, condition, location and price are required",
      });
    }

    if (!["New", "Used"].includes(condition)) {
      return res.status(400).json({
        success: false,
        message: "Condition must be either New or Used",
      });
    }

    if (!draft && !image) {
      return res.status(400).json({
        success: false,
        message: "Image is required to publish a product",
      });
    }

    const product = await productModel.create({
      seller: req.userId,
      name,
      category,
      condition,
      location,
      brand,
      price,
      description,
      image,
      featured: featured || false,
      draft: draft || false,
    });

    res.status(201).json({
      success: true,
      message: "Product added successfully",
      data: product,
    });
  } catch (error) {
    console.error("Add product error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while adding product",
    });
  }
});

app.get("/api/products/my", authRequired, async (req, res) => {
  try {
    if (req.role !== "seller") {
      return res.status(403).json({
        success: false,
        message: "Only sellers can view their products",
      });
    }

    const { category, search } = req.query;
    const query = { seller: req.userId };
    if (category) {
      query.category = caseInsensitive(category);
    }
    if (search) {
      query.$or = searchFilter(search);
    }

    const products = await productModel
      .find(query)
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: products,
    });
  } catch (error) {
    console.error("Get products error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching products",
    });
  }
});

// Shared helpers for building safe MongoDB query filters
function escapeRegExp(str) {
  return String(str).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function caseInsensitive(value) {
  return { $regex: new RegExp("^" + escapeRegExp(value) + "$", "i") };
}

function searchFilter(search) {
  const searchRegex = new RegExp(escapeRegExp(search), "i");
  return [{ name: searchRegex }, { brand: searchRegex }];
}

// Shared query builder for listing all published products with optional filters:
// ?category=Electronics&condition=New&search=headphones&sort=price_asc&limit=4
function listAllProducts(req) {
  const { category, condition, search, sort, limit } = req.query;

  // Drafts are private to the seller and must never appear on public listings
  const query = { draft: { $ne: true } };
  if (category) query.category = caseInsensitive(category);
  if (condition) query.condition = caseInsensitive(condition);
  if (search) query.$or = searchFilter(search);

  let sortOptions = { createdAt: -1 };
  if (sort === "price_desc") sortOptions = { price: -1 };
  else if (sort === "price_asc") sortOptions = { price: 1 };

  const mongoQuery = productModel.find(query).sort(sortOptions);

  const parsedLimit = Number.parseInt(limit, 10);
  if (!Number.isNaN(parsedLimit) && parsedLimit > 0) {
    mongoQuery.limit(Math.min(parsedLimit, 50));
  }

  return mongoQuery;
}

app.get("/api/products", async (req, res) => {
  try {
    const products = await listAllProducts(req);
    res.status(200).json({
      success: true,
      data: products,
    });
  } catch (error) {
    console.error("List products error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching products",
    });
  }
});

app.get("/api/get-all-products", async (req, res) => {
  try {
    const products = await listAllProducts(req);
    res.status(200).json({
      success: true,
      data: products,
    });
  } catch (error) {
    console.error("Get all products error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching all products",
    });
  }
});

// Dedicated endpoint to fetch every product from the collection
app.get("/api/products/all", async (req, res) => {
  try {
    const products = await listAllProducts(req);
    res.status(200).json({
      success: true,
      data: products,
    });
  } catch (error) {
    console.error("List all products error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching all products",
    });
  }
});

app.get("/api/me", authRequired, async (req, res) => {
  try {
    const user = await userModel.findById(req.userId).select("-password");
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }
    res.status(200).json({
      success: true,
      data: {
        id: user._id,
        fullName: user.fullName,
        email: user.email,
        role: user.role,
        emailVerified: user.emailVerified,
        createdAt: user.createdAt,
      },
    });
  } catch (error) {
    console.error("Get me error:", error);
    res.status(500).json({ success: false, message: "Server error while fetching user" });
  }
});

app.get("/api/products/:id", async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid product id",
      });
    }

    const product = await productModel
      .findById(req.params.id)
      .populate("seller", "fullName");
    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    res.status(200).json({
      success: true,
      data: product,
    });
  } catch (error) {
    console.error("Get product error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching product",
    });
  }
});

app.delete("/api/products/:id", authRequired, async (req, res) => {
  try {
    if (req.role !== "seller") {
      return res.status(403).json({
        success: false,
        message: "Only sellers can delete products",
      });
    }

    const deleted = await productModel.findOneAndDelete({
      _id: req.params.id,
      seller: req.userId,
    });
    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Product deleted successfully",
    });
  } catch (error) {
    console.error("Delete product error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while deleting product",
    });
  }
});

app.put("/api/products/:id", authRequired, async (req, res) => {
  try {
    if (req.role !== "seller") {
      return res.status(403).json({
        success: false,
        message: "Only sellers can update products",
      });
    }

    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid product id",
      });
    }

    const { name, category, condition, location, brand, price, description, image, featured, draft } = req.body;

    const updateData = {
      name,
      category,
      condition,
      location,
      brand,
      price,
      description,
      featured,
      draft,
    };
    if (image && String(image).trim()) {
      updateData.image = image;
    }

    const product = await productModel.findOneAndUpdate(
      { _id: req.params.id, seller: req.userId },
      { $set: updateData },
      { new: true }
    );

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Product updated successfully",
      data: product,
    });
  } catch (error) {
    console.error("Update product error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while updating product",
    });
  }
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
