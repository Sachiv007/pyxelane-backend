import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "../supabaseClient";
import "./EditProduct.css"; // 👈 new CSS file

export default function EditProduct() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    name: "",
    price: "",
    description: "",
    preview_url: "",
    file_url: "",
  });

  const [previewFile, setPreviewFile] = useState(null);
  const [productFile, setProductFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [uiError, setUiError] = useState("");

  const MIN_PRICE = 0.6;

  useEffect(() => {
    (async () => {
      setUiError("");
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .eq("id", id)
        .single();

      if (error) {
        console.error("Fetch product error:", error);
        setUiError(error.message || "Failed to load product.");
        return;
      }

      setFormData({
        name: data.title || "",
        price: data.price ?? "",
        description: data.description || "",
        preview_url: data.preview_url || "",
        file_url: data.file_url || "",
      });
    })();
  }, [id]);

  const handleChange = (e) =>
    setFormData((p) => ({ ...p, [e.target.name]: e.target.value }));

  const handlePreviewChange = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!f.type.startsWith("image/")) {
      setUiError("Please select a valid image file for the preview.");
      return;
    }
    setUiError("");
    setPreviewFile(f);
  };

  const handleProductFileChange = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setUiError("");
    setProductFile(f);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setUiError("");
    setLoading(true);

    try {
      const numericPrice = parseFloat(String(formData.price));
      if (!Number.isFinite(numericPrice)) {
        throw new Error("Price must be a number.");
      }
      if (numericPrice !== 0 && numericPrice < MIN_PRICE) {
        throw new Error(`Minimum price for paid products is $${MIN_PRICE.toFixed(2)}.`);
      }

      let previewUrl = formData.preview_url;
      let productUrl = formData.file_url;

      if (previewFile) {
        const ext = previewFile.name.split(".").pop() || "jpg";
        const previewPath = `previews/${id}.${ext}`;

        const { error: upErr } = await supabase.storage
          .from("products-images")
          .upload(previewPath, previewFile, {
            upsert: true,
            cacheControl: "3600",
            contentType: previewFile.type || "image/*",
          });
        if (upErr) throw new Error(`Preview upload failed: ${upErr.message}`);

        const { data: pub } = supabase.storage
          .from("products-images")
          .getPublicUrl(previewPath);
        previewUrl = pub?.publicUrl || previewUrl;
      }

      if (productFile) {
        const productPath = `files/${Date.now()}-${productFile.name}`;
        const { error: upErr } = await supabase.storage
          .from("products-files")
          .upload(productPath, productFile, {
            upsert: true,
            cacheControl: "3600",
            contentType: productFile.type || "application/octet-stream",
          });
        if (upErr) throw new Error(`Product file upload failed: ${upErr.message}`);

        const { data: pub } = supabase.storage
          .from("products-files")
          .getPublicUrl(productPath);
        productUrl = pub?.publicUrl || productUrl;
      }

      const { error: updErr } = await supabase
        .from("products")
        .update({
          title: formData.name,
          price: parseFloat(String(formData.price)),
          description: formData.description,
          preview_url: previewUrl,
          file_url: productUrl,
        })
        .eq("id", id);

      if (updErr) throw new Error(`Save failed: ${updErr.message}`);

      navigate("/user/products");
    } catch (err) {
      console.error(err);
      setUiError(err.message || "Something went wrong while saving.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="edit-container">
      <h2>Edit Product</h2>

      {uiError && <div className="error-box">{uiError}</div>}

      <form onSubmit={handleSubmit} className="form">
        <div>
          <label>Product Name</label>
          <input
            type="text"
            name="name"
            value={formData.name}
            onChange={handleChange}
            required
          />
        </div>

        <div>
          <label>Price (0.60 or higher, 0 for free)</label>
          <input
            type="number"
            name="price"
            value={formData.price}
            onChange={handleChange}
            step="0.01"
            min="0"
            required
          />
        </div>

        <div>
          <label>Description</label>
          <textarea
            name="description"
            value={formData.description}
            onChange={handleChange}
          />
        </div>

        <div>
          <label>Product Preview</label>
          <input type="file" accept="image/*" onChange={handlePreviewChange} />
          {formData.preview_url && (
            <div className="product-card">
              <img
                src={formData.preview_url}
                alt="Preview"
                className="product-card-img"
              />
              <h3>{formData.name || "Untitled"}</h3>
              <p>${formData.price || "0.00"}</p>
            </div>
          )}
        </div>

        <div>
          <label>Product File (ZIP, PDF, WAV, MP3, MIDI)</label>
          <input
            type="file"
            accept=".zip,.pdf,.wav,.mp3,.mid,.midi"
            onChange={handleProductFileChange}
          />
          {formData.file_url && (
            <p>
              Current file:{" "}
              <a
                href={formData.file_url}
                target="_blank"
                rel="noopener noreferrer"
              >
                Download
              </a>
            </p>
          )}
        </div>

        <button type="submit" disabled={loading}>
          {loading ? "Saving..." : "Save Changes"}
        </button>
      </form>
    </div>
  );
}

