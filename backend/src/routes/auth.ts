import { Router, Request, Response } from 'express';
import bcrypt from 'bcrypt';
import { UserModel, WorkspaceModel } from '../models/index.js';
import { generateToken, AuthRequest, authenticateToken } from '../middleware/auth.js';

const router = Router();

router.post('/register', async (req: Request, res: Response) => {
  try {
    const { email, password, name, workspaceName } = req.body;

    if (!email || !password || !name || !workspaceName) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    const existingUser = await UserModel.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ error: 'Email already exists' });
    }

    const password_hash = await bcrypt.hash(password, 10);
    const user = await UserModel.create({ email, password_hash, name });

    const workspace = await WorkspaceModel.create({
      name: workspaceName,
      user_id: user._id
    });

    const token = generateToken(user._id.toString(), user.email);

    res.status(201).json({
      token,
      user: { id: user._id, email: user.email, name: user.name },
      workspace: { id: workspace._id, name: workspace.name }
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    const user = await UserModel.findOne({ email });
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const isValid = await bcrypt.compare(password, user.password_hash);
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const workspace = await WorkspaceModel.findOne({ user_id: user._id });
    const token = generateToken(user._id.toString(), user.email);

    res.json({
      token,
      user: { id: user._id, email: user.email, name: user.name },
      workspace: workspace ? { id: workspace._id, name: workspace.name } : null
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/me', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const user = await UserModel.findById(req.user?.id).select('-password_hash');
    const workspaces = await WorkspaceModel.find({ user_id: req.user?.id });
    res.json({ user, workspaces });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
