import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import apiRouter from './routes/api.js';
import authRouter from './routes/auth.js';
import workspaceRouter from './routes/workspace.js';
import { initCronJobs } from './jobs/cron.js';
import { connectDB } from './config/db.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// CORS setup
// In production, set FRONTEND_URL to your deployed frontend URL.
// We also allow Vercel preview domains so deploy previews can call the API.
const allowedOrigins = [
  'http://localhost:5173', // Vite default port
  'http://localhost:3000',
  process.env.FRONTEND_URL
].filter(Boolean) as string[];

app.use(cors({
  origin: (origin, callback) => {
    // allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    const isLocal = origin.startsWith('http://localhost:') || origin.startsWith('http://127.0.0.1:');
    const isVercel = /^https:\/\/.+\.vercel\.app$/.test(origin);
    if (allowedOrigins.length === 0 || allowedOrigins.indexOf(origin) !== -1 || isLocal || isVercel) {
      return callback(null, true);
    }
    return callback(new Error('The CORS policy for this site does not allow access from the specified Origin.'), false);
  },
  credentials: true
}));

app.use(express.json());

// API Routes
app.use('/api/auth', authRouter);
app.use('/api/workspaces', workspaceRouter);
app.use('/api', apiRouter);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// Start Server
app.listen(PORT, async () => {
  console.log(`Server running on port ${PORT}`);
  await connectDB();
  initCronJobs();
});
