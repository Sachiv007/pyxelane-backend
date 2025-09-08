import React, { useState } from "react";
import { useCart } from "../contexts/CartContext";
import "./Cart.css";

const Cart = () => {
  const { cartItems, addToCart, removeFromCart, clearCart, updateQuantity } = useCart();
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");

  const increment = (item) => addToCart(item, 1);
  const decrement = (item) => {
    if (item.quantity === 1) removeFromCart(item.productId);
    else updateQuantity(item.productId, item.quantity - 1);
  };

  const totalPrice = cartItems.reduce(
    (total, item) => total + item.price * item.quantity,
    0
  );

  const handleCheckout = async () => {
    if (!email) return alert("Please enter your email before checkout.");
    if (cartItems.length === 0) return;

    const paidItems = cartItems.filter((item) => item.price >= 0.6);
    const freeItems = cartItems.filter((item) => item.price === 0);

    if (paidItems.length === 0 && freeItems.length > 0) {
      alert(`🎉 You can now download ${freeItems.length} free product(s)!`);
      freeItems.forEach((item) => removeFromCart(item.productId));
      return;
    }

    if (paidItems.length > 0) {
      setLoading(true);
      try {
        const response = await fetch("http://localhost:5000/api/create-checkout-session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ cartItems: paidItems, email }),
        });

        const data = await response.json();
        if (response.ok && data.url) {
          if (freeItems.length > 0) {
            alert(`🎉 You will also receive ${freeItems.length} free product(s)!`);
            freeItems.forEach((item) => removeFromCart(item.productId));
          }
          window.location.href = data.url;
        } else alert(data.error || "Failed to create checkout session.");
      } catch (error) {
        console.error("Checkout error:", error);
        alert("Something went wrong with checkout.");
      } finally {
        setLoading(false);
      }
    }
  };

  if (cartItems.length === 0)
    return <p className="p-4 text-center">Your cart is empty.</p>;

  return (
    <div className="cart-container">
      <h2>Your Cart</h2>
      <ul>
        {cartItems.map((item) => (
          <li key={item.productId}>
            <div className="flex items-center gap-4">
              {item.image_url && (
                <img src={item.image_url} alt={item.name} />
              )}
              <div>
                <p className={item.price === 0 ? "free" : ""}>{item.name}</p>
                <p>{item.price === 0 ? "Free" : `$${item.price.toFixed(2)}`}</p>
              </div>
            </div>

            <div className="quantity-controls">
              <button onClick={() => decrement(item)}>-</button>
              <span>{item.quantity}</span>
              <button onClick={() => increment(item)}>+</button>
              <button className="remove-btn" onClick={() => removeFromCart(item.productId)}>Remove</button>
            </div>
          </li>
        ))}
      </ul>

      <label>Email for receipt:</label>
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="you@example.com"
      />

      <div className="cart-footer">
        <p className="total">Total: ${totalPrice.toFixed(2)}</p>
        <div className="flex gap-2">
          <button className="clear-btn" onClick={clearCart}>Clear Cart</button>
          <button
            className="checkout-btn"
            onClick={handleCheckout}
            disabled={loading}
          >
            {loading ? "Processing..." : "Checkout"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Cart;

