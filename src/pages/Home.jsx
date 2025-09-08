import React, { useEffect, useState, useRef } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../supabaseClient";
import "./Home.css";

export default function Home({ searchTerm = "" }) {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const lastFetchTimeRef = useRef(0);

  const fetchProducts = async () => {
    const now = Date.now();
    // Only fetch if last fetch > 5 seconds ago
    if (now - lastFetchTimeRef.current < 5000) return;

    setLoading(true);
    const { data, error } = await supabase
      .from("products")
      .select("*")
      .order("id", { ascending: false });

    if (error) {
      console.error("Error fetching products:", error);
    } else {
      const productsWithUrls = data.map((product) => {
        const { data: publicUrlData } = supabase.storage
          .from("products")
          .getPublicUrl(product.file_path);
        return {
          ...product,
          file_url: publicUrlData.publicUrl,
        };
      });

      // Only update state if products actually changed
      setProducts((prev) => {
        const prevIds = prev.map((p) => p.id).join(",");
        const newIds = productsWithUrls.map((p) => p.id).join(",");
        return prevIds === newIds ? prev : productsWithUrls;
      });

      lastFetchTimeRef.current = now;
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchProducts(); // initial fetch

    const handleVisibilityChange = () => {
      if (!document.hidden) {
        fetchProducts();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  const safeSearch = (searchTerm || "").toLowerCase();
  const filteredProducts = products.filter(
    (p) =>
      p.title?.toLowerCase().includes(safeSearch) ||
      p.description?.toLowerCase().includes(safeSearch)
  );

  if (loading) return <p>Loading products...</p>;

  return (
    <div className="home-container">
      <h1>Welcome to Sapphire Lane</h1>
      <p>Start selling your digital content easily.</p>

      <h2>Latest Products</h2>
      <div className="products-grid four-columns">
        {filteredProducts.length > 0 ? (
          filteredProducts.map((product) => (
            <div key={product.id} className="product-card">
              <Link to={`/product/${product.id}`}>
                {product.preview_url && <img src={product.preview_url} alt={product.title} />}
                <h3>{product.title}</h3>
                <p>${product.price}</p>
              </Link>
            </div>
          ))
        ) : (
          <p>No products found.</p>
        )}
      </div>
    </div>
  );
}
