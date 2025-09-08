import React, { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import { Link } from "react-router-dom";
import "./Products.css";

export default function Products() {
  const [products, setProducts] = useState([]);
  const [deleting, setDeleting] = useState({});

  const fetchProducts = async () => {
    const { data, error } = await supabase.from("products").select("*");
    if (error) console.error(error);
    else setProducts(data || []);
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  const getStoragePathFromPublicUrl = (url, bucket) => {
    try {
      if (!url) return null;
      const u = new URL(url);
      const marker = `/object/public/${bucket}/`;
      const i = u.pathname.indexOf(marker);
      if (i === -1) return null;
      return decodeURIComponent(u.pathname.slice(i + marker.length));
    } catch {
      return null;
    }
  };

  const handleDelete = async (product) => {
    const ok = window.confirm(
      `Delete "${product.title || product.name}" permanently? This cannot be undone.`
    );
    if (!ok) return;

    setDeleting((m) => ({ ...m, [product.id]: true }));

    try {
      const previewPath =
        product.preview_path ||
        getStoragePathFromPublicUrl(product.preview_url, "products-images");

      if (previewPath) {
        await supabase.storage.from("products-images").remove([previewPath]);
      }

      const productPath =
        product.file_path ||
        getStoragePathFromPublicUrl(product.file_url, "products-files");

      if (productPath) {
        await supabase.storage.from("products-files").remove([productPath]);
      }

      await supabase.from("products").delete().eq("id", product.id);

      setProducts((list) => list.filter((p) => p.id !== product.id));
    } catch (err) {
      console.error("Delete error:", err);
      alert("Failed to delete product. Check console for details.");
    } finally {
      setDeleting((m) => {
        const copy = { ...m };
        delete copy[product.id];
        return copy;
      });
    }
  };

  return (
    <div className="products-container">
      <h1>My Products</h1>

      <div style={{ marginBottom: "20px" }}>
        <Link to="/user/upload-product" className="upload-btn">
          + Upload New Product
        </Link>
      </div>

      <div className="products-grid four-columns">
        {products.length > 0 ? (
          products.map((product) => {
            const isDeleting = !!deleting[product.id];
            return (
              <div key={product.id} className="product-card">
                <Link to={`/product/${product.id}`}>
                  {product.preview_url && (
                    <img
                      src={product.preview_url}
                      alt={product.title || product.name}
                    />
                  )}
                  <h3>{product.title || product.name}</h3>
                  <p>${Number(product.price).toFixed(2)}</p>
                </Link>

                {product.description && (
                  <p className="product-description">{product.description}</p>
                )}

                <Link to={`/user/edit-product/${product.id}`} className="edit-btn">
                  Edit
                </Link>
                <br />
                <button
                  className="delete-btn"
                  onClick={() => handleDelete(product)}
                  disabled={isDeleting}
                >
                  {isDeleting ? "Deleting..." : "Delete"}
                </button>
              </div>
            );
          })
        ) : (
          <p>No products uploaded yet.</p>
        )}
      </div>
    </div>
  );
}
