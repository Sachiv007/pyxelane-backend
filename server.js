import express from "express";
import cors from "cors";
import multer from "multer";
import path from "path";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import Stripe from "stripe";
import fetch from "node-fetch";
import nodemailer from "nodemailer";
import crypto from "crypto";

dotenv.config();

// Fix __dirname in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5000;

// ===============================
// Middleware
// ===============================
app.use(cors({ origin: "*", credentials: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// ===============================
// Supabase client
// ===============================
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
const supabase = createClient(process.env.SUPABASE_URL, supabaseKey);
const PRODUCTS_BUCKET = "products-files";

// ===============================
// Stripe client
// ===============================
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// ===============================
// Multer setup
// ===============================
const storage = multer.memoryStorage();
const upload = multer({ storage });

// ===============================
// Helper: Safe filename
// ===============================
function safeFileName(originalName) {
  const timestamp = Date.now();
  const ext = path.extname(originalName);
  const base = path.basename(originalName, ext);
  const safeBase = base.replace(/[^a-zA-Z0-9-_]/g, "_");
  return `${timestamp}-${safeBase}${ext}`;
}

// ===============================
// Email Transporter
// ===============================
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "mail.privateemail.com",
  port: Number(process.env.SMTP_PORT) || 465,
  secure: true, // SSL/TLS
  auth: {
    user: process.env.SMTP_USER || "info@pyxelane.com",
    pass: process.env.SMTP_PASS,
  },
});

// ===============================
// Root / Health Check
// ===============================
app.get("/", (req, res) => {
  res.send("✅ Pyxelane Backend is running!");
});

// ===============================
// Upload Profile Picture
// ===============================
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

      if (uploadError)
        return res.status(500).json({ error: uploadError.message });

      const { data: publicData } = supabase.storage
        .from("profile-pictures")
        .getPublicUrl(fileName);

      return res.json({ imageUrl: publicData.publicUrl });
    } catch (err) {
      console.error("Upload error:", err);
      return res.status(500).json({ error: "File upload failed" });
    }
  }
);

// ===============================
// Stripe Checkout
// ===============================
app.post("/api/create-checkout-session", async (req, res) => {
  try {
    const { cartItems, cart, email } = req.body;
    const items = cartItems || cart;

    if (!items || items.length === 0)
      return res.status(400).json({ error: "Cart is empty" });

    const ids = items.map((it) => it.id).filter(Boolean);
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

    const toCents = (val) => {
      const n = Number(val);
      if (!isFinite(n) || n <= 0) return 0;
      return Math.round(n * 100);
    };

    const line_items = items.map((item, idx) => {
      const productName = item.name || item.title || `Item ${idx + 1}`;
      const qty = item.quantity && item.quantity > 0 ? item.quantity : 1;

      const priceDollars =
        item.id && priceById[item.id] != null
          ? priceById[item.id]
          : Number(item.price);

      const cents = toCents(priceDollars);
      const productImages = item.image_url ? [item.image_url] : [];

      if (!cents) {
        throw new Error(
          `Invalid price for item "${productName}". Got ${priceDollars}`
        );
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

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      customer_email: email || undefined,
      line_items,
      mode: "payment",
      success_url: `${
        process.env.FRONTEND_URL || "http://localhost:5173"
      }/thank-you/${items[0].id}?session_id={CHECKOUT_SESSION_ID}&email=${encodeURIComponent(
        email || ""
      )}`,
      cancel_url: `${
        process.env.FRONTEND_URL || "http://localhost:5173"
      }/cart`,
    });

    return res.json({ url: session.url, id: session.id });
  } catch (error) {
    console.error("Stripe error:", error);
    return res.status(500).json({ error: error.message });
  }
});

// ===============================
// Download Product
// ===============================
app.get("/api/download-product/:productId", async (req, res) => {
  try {
    const { productId } = req.params;

    const { data: product, error: dbError } = await supabase
      .from("products")
      .select("file_path, title")
      .eq("id", productId)
      .maybeSingle();

    if (dbError || !product?.file_path)
      return res.status(404).send("Product not found.");

    const { data: signedUrlData, error } = await supabase.storage
      .from(PRODUCTS_BUCKET)
      .createSignedUrl(product.file_path, 60 * 60);

    if (error || !signedUrlData?.signedUrl)
      return res.status(500).send("Failed to generate download link.");

    const fileResponse = await fetch(signedUrlData.signedUrl);
    const fileBuffer = await fileResponse.buffer();

    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${
        product.title || productId
      }${path.extname(product.file_path)}"`
    );
    res.setHeader("Content-Type", "application/octet-stream");
    return res.send(fileBuffer);
  } catch (err) {
    console.error("Download error:", err);
    return res.status(500).send("Failed to download product.");
  }
});

// ===============================
// Send Receipt Email
// ===============================
app.post("/api/send-receipt", async (req, res) => {
  try {
    const { buyerEmail, productId } = req.body;

    if (!buyerEmail || !productId)
      return res.status(400).json({ error: "Missing email or productId" });

    const { data: product, error: productError } = await supabase
      .from("products")
      .select("file_path, title, price")
      .eq("id", productId)
      .maybeSingle();

    if (productError || !product?.file_path)
      return res.status(404).json({ error: "Product not found" });

    const { data: signedUrlData, error: signedError } = await supabase.storage
      .from(PRODUCTS_BUCKET)
      .createSignedUrl(product.file_path, 60 * 60 * 24);

    if (signedError || !signedUrlData?.signedUrl)
      return res
        .status(500)
        .json({ error: "Failed to generate download link" });

    const mailOptions = {
      from: process.env.EMAIL_FROM || `"Pyxelane" <info@pyxelane.com>`,
      to: buyerEmail,
      subject: "Your Purchase Receipt & Download Link",
      html: `
        <h2>Thank you for your purchase!</h2>
        <p>You bought <strong>${product.title}</strong> for $${product.price}.</p>
        <p>Click below to download your product:</p>
        <a href="${signedUrlData.signedUrl}"
           style="display:inline-block;padding:10px 20px;margin:10px 0;
                  background-color:#16a34a;color:#fff;text-decoration:none;
                  border-radius:8px;font-weight:bold;">
          Download Product
        </a>
        <p>This link will expire in 24 hours.</p>
      `,
    };

    await transporter.sendMail(mailOptions);

    return res.json({ success: true, message: "Email sent" });
  } catch (err) {
    console.error("Email send error:", err);
    return res.status(500).json({ error: "Failed to send receipt email" });
  }
});

// ===============================
// Request Password Reset (Custom)
// ===============================
app.post("/api/request-password-reset", async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: "Email required" });

    // Find user
    const { data: user, error: userError } = await supabase
      .from("users")
      .select("id")
      .eq("email", email)
      .maybeSingle();

    if (userError || !user)
      return res.status(404).json({ error: "User not found" });

    // Create reset token
    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60); // 1 hour

    await supabase.from("password_reset_tokens").insert({
      user_id: user.id,
      token,
      expires_at: expiresAt.toISOString(),
    });

    const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${token}`;

    await transporter.sendMail({
      from: `"Pyxelane" <${process.env.SMTP_USER}>`,
      to: email,
      subject: "Password Reset Request",
      html: `
        <h2>Password Reset</h2>
        <p>Click below to reset your password:</p>
        <a href="${resetUrl}"
           style="display:inline-block;padding:10px 20px;background:#2563eb;
                  color:#fff;text-decoration:none;border-radius:6px;font-weight:bold;">
          Reset Password
        </a>
        <p>This link will expire in 1 hour.</p>
        <p>If you don’t see this email, please check your <strong>Spam or Promotions</strong> folder.</p>
      `,
    });

    return res.json({ success: true, message: "Password reset email sent" });
  } catch (err) {
    console.error("Password reset error:", err);
    return res.status(500).json({ error: "Failed to send reset email" });
  }
});

// ===============================
// Reset Password (Custom)
// ===============================
app.post("/api/reset-password", async (req, res) => {
  try {
    const { token, newPassword } = req.body;
    if (!token || !newPassword)
      return res.status(400).json({ error: "Missing data" });

    const { data: resetData, error: resetError } = await supabase
      .from("password_reset_tokens")
      .select("user_id, expires_at")
      .eq("token", token)
      .maybeSingle();

    if (resetError || !resetData)
      return res.status(400).json({ error: "Invalid token" });

    if (new Date(resetData.expires_at) < new Date())
      return res.status(400).json({ error: "Token expired" });

    // Update password via Supabase Admin
    const { error: updateError } = await supabase.auth.admin.updateUserById(
      resetData.user_id,
      { password: newPassword }
    );

    if (updateError)
      return res.status(500).json({ error: "Failed to update password" });

    return res.json({ success: true, message: "Password updated successfully" });
  } catch (err) {
    console.error("Reset password error:", err);
    return res.status(500).json({ error: "Failed to reset password" });
  }
});

// ===============================
// Start Server
// ===============================
app.listen(PORT, () => {
  console.log(
    `✅ Server running on port ${PORT} | Supabase key used: ${
      process.env.SUPABASE_SERVICE_ROLE_KEY ? "SERVICE_ROLE" : "ANON"
    }`
  );
});
