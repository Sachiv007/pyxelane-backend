import { useNavigate } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import { useCart } from "../contexts/CartContext";
import "./Checkout.css";

export default function Checkout() {
  const navigate = useNavigate();
  const { cartItems } = useCart();

  const [resolvedItems, setResolvedItems] = useState([]);
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  const toDollars = (val) => {
    const n = Number(val);
    if (!isFinite(n) || n <= 0) return 0;
    if (Number.isInteger(n) && n >= 100) return Math.round(n) / 100;
    return n;
  };

  useEffect(() => {
    if (cartItems && cartItems.length) {
      const normalized = cartItems.map((ci, idx) => ({
        id: ci.id || ci.productId || `item-${idx}`,
        name: ci.title || ci.name || "Untitled",
        image_url: ci.image_url || ci.preview_url || "",
        price: toDollars(ci.price),
        quantity: ci.quantity && ci.quantity > 0 ? ci.quantity : 1
      }));
      setResolvedItems(normalized);
    } else {
      setResolvedItems([]);
    }
  }, [cartItems]);

  const canPay = useMemo(
    () => resolvedItems.length > 0 && resolvedItems.every(i => i.price > 0 && i.quantity > 0),
    [resolvedItems]
  );

  const handlePayment = async () => {
    if (!email) {
      alert("Please enter your email");
      return;
    }
    if (!canPay) {
      alert("Your cart is empty.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("https://pyxelane-backend.onrender.com/api/create-checkout-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, items: resolvedItems })
      });

      const data = await res.json();

      if (data?.url) {
        window.location.href = data.url;
      } else {
        alert(`Something went wrong: ${data?.error || "Unknown error"}`);
        navigate("/");
      }
    } catch (e) {
      console.error("Payment error:", e);
      alert("Failed to start payment.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="checkout-container">
      <h2>Checkout</h2>

      {resolvedItems.length ? (
        <ul className="checkout-list">
          {resolvedItems.map((i) => (
            <li key={i.id}>
              {i.name} — ${i.price.toFixed(2)} × {i.quantity}
            </li>
          ))}
        </ul>
      ) : (
        <p className="empty-cart">Your cart is empty.</p>
      )}

      <label>Email Address</label>
      <input
        type="email"
        placeholder="Enter your email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="checkout-email"
      />

      <button
        onClick={handlePayment}
        disabled={loading || !canPay}
        className="checkout-pay-button"
      >
        {loading ? "Redirecting..." : "Pay with Stripe"}
      </button>
    </div>
  );
}
