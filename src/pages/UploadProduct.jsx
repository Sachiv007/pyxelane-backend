import React, { useState } from 'react';
import { supabase } from '../supabaseClient';
import { useNavigate } from 'react-router-dom';
import './EditProduct.css'; // ✅ Reuse the same CSS file

export default function UploadProduct() {
  const [title, setTitle] = useState('');
  const [price, setPrice] = useState('');
  const [description, setDescription] = useState('');
  const [previewFile, setPreviewFile] = useState(null);
  const [productFile, setProductFile] = useState(null);
  const [previewUrlLocal, setPreviewUrlLocal] = useState(null);
  const navigate = useNavigate();

  const MIN_PRICE = 0.6;

  function sanitizeFileName(originalName) {
    return originalName
      .replace(/\s+/g, '_')
      .replace(/[^a-zA-Z0-9._-]/g, '')
      .toLowerCase();
  }

  async function handleSubmit(e) {
    e.preventDefault();

    const numericPrice = parseFloat(price);

    if (numericPrice !== 0 && numericPrice < MIN_PRICE) {
      alert(`Minimum price for paid products is $${MIN_PRICE.toFixed(2)}`);
      return;
    }

    let previewUrl = null;
    let productUrl = null;
    let previewFileName = null;
    let productFileName = null;

    try {
      if (previewFile) {
        previewFileName = `${Date.now()}-${sanitizeFileName(previewFile.name)}`;
        const { error: previewError } = await supabase.storage
          .from('products-images')
          .upload(previewFileName, previewFile);

        if (previewError) throw new Error(`Preview upload failed: ${previewError.message}`);

        const { data: previewPublicData } = supabase.storage
          .from('products-images')
          .getPublicUrl(previewFileName);

        previewUrl = previewPublicData.publicUrl;
      }

      if (productFile) {
        productFileName = `${Date.now()}-${sanitizeFileName(productFile.name)}`;
        const { error: productError } = await supabase.storage
          .from('products-files')
          .upload(productFileName, productFile);

        if (productError) throw new Error(`Product file upload failed: ${productError.message}`);

        const { data: productPublicData } = supabase.storage
          .from('products-files')
          .getPublicUrl(productFileName);

        productUrl = productPublicData.publicUrl;
      }

      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError) throw new Error(userError.message);
      if (!user) throw new Error("You must be logged in to upload a product");

      const { error: insertError } = await supabase.from('products').insert([
        { 
          title,
          price: numericPrice,
          description,
          preview_url: previewUrl,
          file_url: productUrl,
          file_path: productFileName,
          user_id: user.id
        }
      ]);

      if (insertError) throw new Error(`Insert failed: ${insertError.message}`);

      alert("✅ Product uploaded successfully!");
      navigate('/user/products');
    } catch (err) {
      console.error("Upload error:", err.message);
      alert(`❌ ${err.message}`);
    }
  }

  const handlePreviewFileChange = (e) => {
    const file = e.target.files[0];
    setPreviewFile(file);
    if (file) {
      setPreviewUrlLocal(URL.createObjectURL(file));
    } else {
      setPreviewUrlLocal(null);
    }
  };

  return (
    <div className="product-card">
      <h1 className="product-title">Upload Product</h1>
      <form onSubmit={handleSubmit} className="product-form">
        <input
          type="text"
          placeholder="Product Name"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="form-input"
          required
        />

        <textarea
          placeholder="Product Description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="form-textarea"
          rows="4"
        />

        <input
          type="number"
          placeholder="Price (0.60 or higher, 0 for free)"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          step="0.01"
          min="0"
          className="form-input"
          required
        />

        <div className="form-group">
          <label>Product Preview (Image)</label>
          <input
            type="file"
            accept="image/*"
            onChange={handlePreviewFileChange}
            className="form-input"
            required
          />
          {previewUrlLocal && (
            <div className="preview-box">
              <img src={previewUrlLocal} alt="Preview" className="preview-image" />
            </div>
          )}
        </div>

        <div className="form-group">
          <label>Product File (ZIP, PDF, WAV, MP3, MIDI, etc.)</label>
          <input
            type="file"
            accept=".zip,.pdf,.wav,.mp3,.midi"
            onChange={(e) => setProductFile(e.target.files[0])}
            className="form-input"
            required
          />
        </div>

        <button type="submit" className="form-button">
          Upload Product
        </button>
      </form>
    </div>
  );
}
