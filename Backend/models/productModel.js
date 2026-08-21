import mongoose from "mongoose";

const productSchema = new mongoose.Schema(
  {
    seller: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    name: { type: String, required: true, trim: true },
    category: { type: String, required: true, trim: true },
    condition: { type: String, enum: ["New", "Used"], required: true },
    location: { type: String, required: true, trim: true },
    brand: { type: String, trim: true, default: "" },
    price: { type: Number, required: true, min: 0 },
    oldPrice: { type: Number, default: 0, min: 0 },
    stock: { type: Number, required: true, min: 0, default: 0 },
    sku: { type: String, trim: true, default: "" },
    description: { type: String, default: "" },
    image: { type: String, default: "" },
    featured: { type: Boolean, default: false },
  },
  { timestamps: true, collection: "products" },
);

export default mongoose.model("Product", productSchema);
