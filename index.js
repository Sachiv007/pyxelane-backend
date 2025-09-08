import express from 'express';
import cors from 'cors';
import multer from 'multer';
import path from 'path';

const app = express();
const PORT = 5000;

// Enable CORS with credentials allowed
app.use(cors({
  origin: 'http://localhost:5173',
  credentials: true,
}));

// Serve uploaded images statically from /uploads
app.use('/uploads', express.static('uploads'));

// Configure multer storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${Date.now()}${ext}`);
  }
});

const upload = multer({ storage });

// Upload endpoint
app.post('/api/upload-profile-picture', upload.single('profilePicture'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }
  const imageUrl = `http://localhost:${PORT}/uploads/${req.file.filename}`;
  res.json({ imageUrl });
});

// Start server
app.listen(PORT, () => {
  console.log(`Backend server running at http://localhost:${PORT}`);
});
