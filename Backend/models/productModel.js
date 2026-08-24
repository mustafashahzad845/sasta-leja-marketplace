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
    description: { type: String, default: "" },
    image: { type: String, default: "" },
    featured: { type: Boolean, default: false },
    draft: { type: Boolean, default: false },
  },
  { timestamps: true, collection: "products" },
);

export default mongoose.model("Product", productSchema);
