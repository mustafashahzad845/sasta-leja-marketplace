import dotenv from "dotenv";
import jwt from "jsonwebtoken";
import { v2 as cloudinary } from "cloudinary";
dotenv.config();

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || process.env.CLOUDE_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const BASE = "http://localhost:4000/api";
const sellerId = "507f1f77bcf86cd799439011"; // valid-format ObjectId, test-only seller
const token = jwt.sign({ userId: sellerId, role: "seller" }, process.env.JWT_SECRET, { expiresIn: "1h" });

// 1x1 transparent PNG
const png = Buffer.from(
  "89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c489" +
  "0000000d49444154789c626001000000ffff03000006000557bfabd40000000049454e44ae426082",
  "hex"
);

// ---- 1. Upload image to Cloudinary ----
const fd = new FormData();
fd.append("image", new Blob([png], { type: "image/png" }), "test-1x1.png");
const uploadRes = await fetch(BASE + "/products/upload", {
  method: "POST",
  headers: { Authorization: "Bearer " + token },
  body: fd,
});
const uploadData = await uploadRes.json();
console.log("UPLOAD      ->", uploadRes.status, "success:", !!uploadData.success);
console.log("  imageUrl  ->", uploadData.data ? (uploadData.data.imageUrl || "").slice(0, 40) + "..." : "NONE");
console.log("  publicId  ->", uploadData.data ? uploadData.data.publicId : "NONE");

let publicId = uploadData.data && uploadData.data.publicId;
let productId = null;

if (uploadData.success && uploadData.data.imageUrl) {
  // ---- 2. Create product using the Cloudinary URL ----
  const createRes = await fetch(BASE + "/products", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
    body: JSON.stringify({
      name: "Cloudinary E2E Test",
      category: "Electronics",
      condition: "New",
      location: "Karachi",
      price: 500,
      oldPrice: 800,
      stock: 10,
      description: "Live end-to-end test of image->cloudinary + product->db",
      image: uploadData.data.imageUrl,
    }),
  });
  const createData = await createRes.json();
  console.log("CREATE      ->", createRes.status, "success:", !!createData.success);
  productId = createData.data && createData.data._id;
  if (createData.data) {
    console.log("  saved condition:", createData.data.condition, "| location:", createData.data.location);
    console.log("  saved image:", (createData.data.image || "").slice(0, 40) + "...");
  }

  // ---- 3. Verify in public marketplace list ----
  const listRes = await fetch(BASE + "/products");
  const listData = await listRes.json();
  const found = (listData.data || []).some(
    (p) => p._id === productId && p.condition === "New" && p.location === "Karachi"
  );
  console.log("LIST-OK     ->", found);

  // ---- 4. Verify detail endpoint ----
  const detRes = await fetch(BASE + "/products/" + productId);
  const detData = await detRes.json();
  console.log("DETAIL      ->", detRes.status, "name:", detData.data && detData.data.name);
}

// ---- 5. Cleanup: delete product + destroy Cloudinary image ----
if (productId) {
  const del = await fetch(BASE + "/products/" + productId, {
    method: "DELETE",
    headers: { Authorization: "Bearer " + token },
  });
  console.log("CLEANUP-DEL ->", del.status);
}
if (publicId) {
  try {
    const destroy = await cloudinary.uploader.destroy(publicId);
    console.log("CLEANUP-CDN ->", JSON.stringify(destroy));
  } catch (e) {
    console.log("CLEANUP-CDN-ERR ->", e.message);
  }
}
