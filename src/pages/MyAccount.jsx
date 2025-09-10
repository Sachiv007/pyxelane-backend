import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabaseClient';
import Cropper from 'react-easy-crop';

export default function MyAccount() {
  const [user, setUser] = useState(null);
  const [username, setUsername] = useState("");
  const [newUsername, setNewUsername] = useState("");

  const [image, setImage] = useState(null);
  const [preview, setPreview] = useState(null);
  const [avatarUrl, setAvatarUrl] = useState(null);

  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
  const [showCropper, setShowCropper] = useState(false);

  useEffect(() => {
    async function fetchUser() {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
      setUsername(user?.user_metadata?.username || "");
      setNewUsername(user?.user_metadata?.username || "");

      if (user?.user_metadata?.avatar_path) {
        const { data, error } = await supabase.storage
          .from('avatars')
          .createSignedUrl(user.user_metadata.avatar_path, 60 * 60);

        if (!error) setAvatarUrl(data.signedUrl);
      }
    }
    fetchUser();
  }, []);

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setImage(file);
      setPreview(URL.createObjectURL(file));
      setShowCropper(true);
    }
  };

  const getCroppedImg = useCallback((imageSrc, cropPixels) => {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.src = imageSrc;
      image.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        canvas.width = cropPixels.width;
        canvas.height = cropPixels.height;

        ctx.drawImage(
          image,
          cropPixels.x,
          cropPixels.y,
          cropPixels.width,
          cropPixels.height,
          0,
          0,
          cropPixels.width,
          cropPixels.height
        );

        canvas.toBlob((blob) => {
          if (!blob) return reject(new Error('Canvas is empty'));
          resolve(blob);
        }, 'image/jpeg');
      };
      image.onerror = (err) => reject(err);
    });
  }, []);

  const onCropComplete = useCallback((_, croppedAreaPixels) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  const saveCroppedImage = async () => {
    if (!preview || !croppedAreaPixels) return;
    const croppedBlob = await getCroppedImg(preview, croppedAreaPixels);
    const croppedFile = new File([croppedBlob], "avatar.jpg", { type: "image/jpeg" });

    setImage(croppedFile);
    setPreview(URL.createObjectURL(croppedFile));
    setShowCropper(false);
  };

  const uploadProfilePicture = async () => {
    if (!image || !user) return;
    const { data: existingFiles } = await supabase.storage
      .from('avatars')
      .list(user.id + "/");

    if (existingFiles?.length > 0) {
      const oldFilePaths = existingFiles.map(f => `${user.id}/${f.name}`);
      await supabase.storage.from('avatars').remove(oldFilePaths);
    }

    const filePath = `${user.id}/profile.jpg`;
    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(filePath, image, { upsert: true });
    if (uploadError) return alert('Upload failed: ' + uploadError.message);

    const { error: updateError } = await supabase.auth.updateUser({
      data: { avatar_path: filePath }
    });
    if (updateError) return alert('Failed to update user profile: ' + updateError.message);

    const { data } = await supabase.storage
      .from('avatars')
      .createSignedUrl(filePath, 60 * 60);
    setAvatarUrl(data.signedUrl);
    setPreview(null);
    setImage(null);
    alert('Profile picture uploaded successfully!');
  };

  const updateUsername = async () => {
    if (!newUsername || !user) return;

    const { error } = await supabase.auth.updateUser({
      data: { username: newUsername }
    });

    if (error) {
      alert("Failed to update username: " + error.message);
    } else {
      setUsername(newUsername);
      alert("Username updated successfully!");
    }
  };

  return (
    <div style={styles.container}>
      <h1>My Account</h1>

      <div style={styles.avatarWrapper}>
        {avatarUrl && !preview && <img src={avatarUrl} alt="Profile" style={styles.avatar} />}
        {preview && <img src={preview} alt="Preview" style={styles.avatar} />}
      </div>

      <input type="file" accept="image/*" onChange={handleImageChange} style={styles.fileInput} />
      <button onClick={uploadProfilePicture} disabled={!image} style={styles.button}>
        Upload New Profile Picture
      </button>

      {/* Username section */}
      <div style={{ marginTop: "2rem", width: "100%", maxWidth: 300 }}>
        <label style={{ display: "block", marginBottom: "0.5rem" }}>Username</label>
        <input
          type="text"
          value={newUsername}
          onChange={(e) => setNewUsername(e.target.value)}
          style={styles.input}
        />
        <button onClick={updateUsername} style={styles.button}>
          Save Username
        </button>
      </div>

      {showCropper && (
        <div style={styles.cropperOverlay}>
          <div id="cropper-box" style={styles.cropperContainer}>
            <Cropper
              image={preview}
              crop={crop}
              zoom={zoom}
              aspect={1}
              cropShape="round"
              showGrid={false}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={onCropComplete}
            />

            <div style={styles.controls}>
              <button onClick={() => setShowCropper(false)}>Cancel</button>
              <button onClick={saveCroppedImage}>Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  container: { display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '2rem' },
  avatarWrapper: { width: 100, height: 100, borderRadius: '50%', overflow: 'hidden', marginBottom: '1rem', border: '2px solid #ccc', display: 'flex', justifyContent: 'center', alignItems: 'center' },
  avatar: { width: '100%', height: '100%', objectFit: 'cover' },
  fileInput: { marginBottom: '1rem' },
  input: { width: '100%', padding: '0.5rem', marginBottom: '1rem', border: '1px solid #ccc', borderRadius: 5 },
  button: { padding: '0.5rem 1rem', backgroundColor: '#007bff', color: '#fff', border: 'none', borderRadius: 5, cursor: 'pointer', marginBottom: "1rem" },
  cropperOverlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.7)', display: 'flex', justifyContent: 'center', alignItems: 'center' },
  cropperContainer: { position: 'relative', width: 300, height: 300, background: '#fff', borderRadius: 10, overflow: 'hidden' },
  controls: { position: 'absolute', bottom: 10, left: 0, right: 0, display: 'flex', justifyContent: 'space-around' },
};
