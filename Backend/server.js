import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import nodemailer from "nodemailer";
import dotenv from "dotenv";
import dns from "node:dns";
import { v2 as cloudinary } from "cloudinary";
import multer from "multer";
import userModel from "./models/userModel.js";
import otpModel from "./models/otpModel.js";
import productModel from "./models/productModel.js";

dotenv.config();

// Fix: force Node's DNS resolver to use Google/Cloudflare public DNS.
// On some systems the default resolver fails SRV lookups for Atlas with
// "querySrv ECONNREFUSED", which breaks the mongodb+srv connection.
dns.setServers(["8.8.8.8", "1.1.1.1"]);

const URI = process.env.MONGODB_URI ;
const PORT = process.env.PORT || 4000;
const JWT_SECRET = process.env.JWT_SECRET || "jwt_sign_sasta_leja_bhai";
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

function authRequired(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
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

    const otp = await otpModel.findOne({ email, code: verificationCode });
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

    await otpModel.deleteMany({ email });

    const otp = await otpModel.create({
      email,
      code: generateOTP(),
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

    if (!name || !category || !condition || !location || price == null || !image) {
      return res.status(400).json({
        success: false,
        message: "Name, category, condition, location, price and image are required",
      });
    }

    if (!["New", "Used"].includes(condition)) {
      return res.status(400).json({
        success: false,
        message: "Condition must be either New or Used",
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

    const { category } = req.query;
    const query = { seller: req.userId };
    if (category) {
      query.category = category;
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

app.get("/api/products", async (req, res) => {
  try {
    const products = await productModel.find().sort({ createdAt: -1 });
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

    const product = await productModel.findOneAndUpdate(
      { _id: req.params.id, seller: req.userId },
      { name, category, condition, location, brand, price, description, image, featured, draft },
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
