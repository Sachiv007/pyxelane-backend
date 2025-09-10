import { useParams } from "react-router-dom";
import { useEffect, useState } from "react";
import { useCart } from "../contexts/CartContext";
import { supabase } from "../supabaseClient";
import "./ProductDetails.css";

export default function ProductDetails() {
  const { id } = useParams();
  const { addToCart } = useCart();
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProduct = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .eq("id", id)
        .single();

      if (error) {
        console.error("Error fetching product:", error.message);
      } else {
        setProduct(data);
      }
      setLoading(false);
    };

    fetchProduct();
  }, [id]);

  if (loading) return <p>Loading...</p>;
  if (!product) return <p>Product not found.</p>;

  const handleAddToCart = () => {
    addToCart({
      id: product.id,
      name: product.title || product.name,
      price: product.price,
      image_url: product.preview_url || product.file_url || "",
    });
    alert("Added to cart!");
  };

  return (
    <div className="product-details">
      <img
        src={product.preview_url || product.file_url}
        alt={product.title || product.name}
        className="product-image"
      />
      <div className="product-info">
        <h2>{product.title || product.name}</h2>
        <p>{product.description}</p>
        <p className="product-price">${(product.price / 100).toFixed(2)}</p>

        <div className="product-buttons">
          <button onClick={handleAddToCart} className="add-cart-btn">
            Add to Cart
          </button>
          {/* Buy Now button removed for now */}
        </div>
      </div>
    </div>
  );
}
