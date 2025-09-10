import cors from "cors";
import express from "express";
import dotenv from "dotenv";
dotenv.config();
import multer from "multer";
import path from "path";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";
import Stripe from "stripe";
import fetch from "node-fetch";
import nodemailer from "nodemailer";

// ------------------------------
// Fix __dirname in ES modules
// ------------------------------
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5000;

// ------------------------------
// ✅ CORS (Frontend + Local Dev) - fully debugged
// ------------------------------
const ALLOWED_ORIGINS = [
  "http://localhost:5173",
  "http://localhost:3000",
  "https://pyxelane-frontend.onrender.com",
  "https://pyxelport-frontend.onrender.com",
];

// 🔎 Log all requests for debugging
app.use((req, res, next) => {
  console.log("📡 Request:", req.method, req.url, "Origin:", req.headers.origin);
  next();
});

// ✅ CORS middleware
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true); // Postman, curl, etc.
      if (ALLOWED_ORIGINS.includes(origin)) return callback(null, true);
      console.warn("❌ Blocked CORS origin:", origin);
      return callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
    methods: ["GET", "HEAD", "PUT", "PATCH", "POST", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
    preflightContinue: false,
    optionsSuccessStatus: 204,
  })
);

// ✅ Explicitly handle OPTIONS preflight for all routes
app.options("*", cors());

// ------------------------------
// Middleware
// ------------------------------
app.use(express.json());

// ------------------------------
// Supabase client
// ------------------------------
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
const supabase = createClient(process.env.SUPABASE_URL, supabaseKey);
const PRODUCTS_BUCKET = "products-files";

// ------------------------------
// Stripe client
// ------------------------------
if (!process.env.STRIPE_SECRET_KEY) {
  console.error("❌ STRIPE_SECRET_KEY is missing!");
}
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// ------------------------------
// Multer setup
// ------------------------------
const storage = multer.memoryStorage();
const upload = multer({ storage });

// ------------------------------
// Helper: Safe filename
// ------------------------------
function safeFileName(originalName) {
  const timestamp = Date.now();
  const ext = path.extname(originalName);
  const base = path
    .basename(originalName, ext)
    .replace(/[^a-zA-Z0-9-_]/g, "_");
  return `${timestamp}-${base}${ext}`;
}

// ------------------------------
// Upload Profile Picture
// ------------------------------
app.post(
  "/api/upload-profile-picture",
  upload.single("profilePicture"),
  async (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ error: "No file uploaded" });
      const fileName = safeFileName(req.file.originalname);

      const { error: uploadError } = await supabase.storage
        .from("profile-pictures")
        .upload(fileName, req.file.buffer, {
          contentType: req.file.mimetype,
          upsert: false,
        });

      if (uploadError) return res.status(500).json({ error: uploadError.message });

      const { data: publicData } = supabase.storage
        .from("profile-pictures")
        .getPublicUrl(fileName);

      return res.json({ imageUrl: publicData.publicUrl });
    } catch (err) {
      console.error("Upload error:", err);
      return res.status(500).json({ error: "File upload failed", details: err.message });
    }
  }
);

// ------------------------------
// Stripe Checkout
// ------------------------------
app.post("/api/create-checkout-session", async (req, res) => {
  try {
    const { items, email, cartItems, cart } = req.body;
    const incoming = items || cartItems || cart;
    if (!incoming || incoming.length === 0)
      return res.status(400).json({ error: "Cart is empty" });

    const ids = incoming.map((it) => it.id).filter(Boolean);
    let priceById = {};
    if (ids.length) {
      const { data: rows, error: dbErr } = await supabase
        .from("products")
        .select("id, price")
        .in("id", ids);
      if (!dbErr) {
        for (const r of rows || []) priceById[r.id] = Number(r.price);
      }
    }

    const toCents = (val) => Math.round(Number(val) * 100);

    const line_items = incoming.map((item, idx) => {
      const productName = item.name || item.title || `Item ${idx + 1}`;
      const qty = item.quantity && item.quantity > 0 ? item.quantity : 1;
      const priceDollars =
        item.id && priceById[item.id] != null
          ? priceById[item.id]
          : Number(item.price);
      const cents = toCents(priceDollars);
      const productImages = item.image_url ? [item.image_url] : [];

      if (!Number.isFinite(cents) || cents <= 0) {
        throw new Error(`Invalid price for item "${productName}"`);
      }

      return {
        price_data: {
          currency: "usd",
          product_data: { name: productName, images: productImages },
          unit_amount: cents,
        },
        quantity: qty,
      };
    });

    const frontendUrl =
      process.env.FRONTEND_URL || "https://pyxelane-frontend.onrender.com";

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      customer_email: email || undefined,
      line_items,
      mode: "payment",
      success_url: `${frontendUrl}/thank-you/${
        incoming[0].id
      }?session_id={CHECKOUT_SESSION_ID}&email=${encodeURIComponent(email || "")}`,
      cancel_url: `${frontendUrl}/cart`,
    });

    return res.json({ url: session.url, id: session.id });
  } catch (error) {
    console.error("Stripe error:", error);
    return res.status(500).json({
      error: error.message || "Internal server error",
      stack: error.stack, // ✅ show stacktrace for debugging
    });
  }
});

// ------------------------------
// Start Server
// ------------------------------
app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));
