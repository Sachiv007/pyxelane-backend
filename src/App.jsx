import React, { useEffect, useState } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation, useNavigate } from "react-router-dom";
import { supabase } from "./supabaseClient";

import { CartProvider } from "./contexts/CartContext";
import { UserProvider } from "./contexts/UserContext";
import Navbar from "./components/Navbar";

import Home from "./pages/Home";
import Login from "./pages/Login";
import SignUp from "./pages/SignUp";
import VerifyEmail from "./pages/VerifyEmail";
import ResetPassword from "./pages/ResetPassword";
import UserDashboard from "./pages/UserDashboard";
import MyAccount from "./pages/MyAccount";
import Products from "./pages/Products";
import UploadProduct from "./pages/UploadProduct";
import EditProduct from "./pages/EditProduct";
import ProductDetails from "./pages/ProductDetails";
import Checkout from "./pages/Checkout";
import ThankYou from "./pages/ThankYou";
import Cart from "./pages/Cart";
import MyStats from "./pages/MyStats";

function AppWrapper() {
  const navigate = useNavigate();
  const location = useLocation();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    const { data: authListener } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setUser(session?.user ?? null);
        if (event === "PASSWORD_RECOVERY") {
          navigate("/reset-password");
        }
      }
    );

    return () => authListener.subscription.unsubscribe();
  }, [navigate]);

  if (loading) return <p>Loading...</p>;

  const ProtectedRoute = ({ children }) =>
    user ? children : <Navigate to="/login" />;

  const showNavbar = !location.pathname.startsWith("/user");

  return (
    <CartProvider>
      <UserProvider>
        {showNavbar && <Navbar searchTerm={searchTerm} onSearch={setSearchTerm} />}

        <Routes>
          {/* Public Routes */}
          <Route path="/" element={<Home searchTerm={searchTerm} />} />
          <Route path="/login" element={user ? <Navigate to="/user" /> : <Login />} />
          <Route path="/signup" element={<SignUp />} />
          <Route path="/verifyemail" element={<VerifyEmail />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/product/:id" element={<ProductDetails />} />

          {/* ✅ Checkout Routes */}
          <Route path="/checkout" element={<Checkout />} />           {/* Buy Now works with state */}
          <Route path="/checkout/:productId" element={<Checkout />} /> {/* Optional legacy / cart link */}

          <Route path="/thank-you/:productId" element={<ThankYou />} />
          <Route path="/cart" element={<Cart />} />

          {/* Protected User Routes */}
          <Route
            path="/user"
            element={
              <ProtectedRoute>
                <UserDashboard user={user} />
              </ProtectedRoute>
            }
          >
            <Route index element={<MyAccount user={user} />} />
            <Route path="products" element={<Products user={user} />} />
            <Route path="upload-product" element={<UploadProduct user={user} />} />
            <Route path="edit-product/:id" element={<EditProduct user={user} />} />
            <Route path="mystats" element={<MyStats user={user} />} />
          </Route>
        </Routes>
      </UserProvider>
    </CartProvider>
  );
}

export default function App() {
  return (
    <Router>
      <AppWrapper />
    </Router>
  );
}
