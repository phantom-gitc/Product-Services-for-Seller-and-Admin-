const mongoose = require("mongoose");

const variantSchema = new mongoose.Schema({
  name: String,
  sku: String,
  price: Number,
  stock: { type: Number, default: 0 },
  attributes: mongoose.Schema.Types.Mixed,
});

const productSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      index: "text",
    },
    description: {
      type: String,
      index: "text",
    },
    category: {
      type: String,
      enum: ["electronics", "fashion", "home", "books", "sports", "other"],
      default: "other",
      index: true,
    },
    price: {
      amount: {
        type: Number,
        required: true,
        index: true,
      },
      currency: {
        type: String,
        enum: ["USD", "INR"],
        default: "INR",
      },
    },
    seller: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true,
      ref: "User",
    },
    images: [
      {
        url: String,
        thumbnailUrl: String,
        id: String,
      },
    ],
    variants: [variantSchema],
    status: {
      type: String,
      enum: ["active", "archived", "draft"],
      default: "active",
      index: true,
    },
    stock: {
      type: Number,
      default: 0,
    },
    rating: {
      average: { type: Number, default: 0 },
      count: { type: Number, default: 0 },
    },
    tags: [String],
    seoSlug: {
      type: String,
      unique: true,
      sparse: true,
    },
  },
  {
    timestamps: true,
  }
);

// Text index for search
productSchema.index({ title: "text", description: "text" });

// Compound index for common queries
productSchema.index({ seller: 1, status: 1 });
productSchema.index({ category: 1, price: 1, status: 1 });

module.exports = mongoose.model("Product", productSchema); 