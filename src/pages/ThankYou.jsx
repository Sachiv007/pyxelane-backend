import { useParams, useLocation } from "react-router-dom";
import { useEffect, useContext } from "react";
import { CartContext } from "../contexts/CartContext";
import { supabase } from "../supabaseClient";

export default function ThankYou() {
  const { productId } = useParams();
  const query = new URLSearchParams(useLocation().search);
  const email = query.get("email");
  const { clearCart } = useContext(CartContext);

  useEffect(() => {
    // ✅ Clear the cart once when the page loads
    clearCart();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (productId && email) {
      // ✅ Insert order into Supabase
      const insertOrder = async () => {
        console.log("🟡 Trying to insert order:", { productId, email });

        const { data, error } = await supabase.from("orders").insert([
          {
            buyer_email: email,
            product_id: productId,
            stripe_session_id: crypto.randomUUID(), // placeholder
          },
        ]);

        if (error) {
          console.error("❌ Supabase insert error:", error);
        } else {
          console.log("✅ Supabase order inserted:", data);

          // ✅ Trigger backend to send receipt email
          try {
            const res = await fetch("http://localhost:5000/api/send-receipt", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                buyerEmail: email,
                productId,
              }),
            });

            if (!res.ok) {
              throw new Error("Failed to send receipt email");
            }

            console.log("📧 Receipt email sent successfully");
          } catch (err) {
            console.error("❌ Email sending failed:", err);
          }
        }
      };

      insertOrder();
    } else {
      console.warn("⚠️ Missing productId or email in URL.");
    }
  }, [productId, email]);

  if (!productId) {
    return (
      <div className="max-w-md mx-auto p-6 bg-white shadow-lg rounded-lg mt-10 text-center">
        <h2 className="text-2xl font-bold mb-4">Thank You!</h2>
        <p>Invalid product. Please contact support if this persists.</p>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto p-6 bg-white shadow-lg rounded-lg mt-10 text-center">
      <h2 className="text-2xl font-bold mb-4">Thank You!</h2>
      <p className="mb-2">
        We’ve sent your receipt and download link to{" "}
        <strong>{email || "your email"}</strong>.
      </p>
      <p className="text-gray-600">
        Please check your inbox. If you don’t see it, check your spam folder or
        contact support.
      </p>
    </div>
  );
}



