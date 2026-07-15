// src/routes/auth.ts
import { Router, Request, Response } from 'express';
import { getDB } from '../db';
import { generateToken, hashPassword, comparePassword } from '../auth';
import { protect, AuthRequest } from '../middleware/auth';
import { ObjectId } from 'mongodb';

const router = Router();

// POST /api/auth/register
router.post('/register', async (req: Request, res: Response) => {
    try {
        const { name, email, password, image } = req.body;
        const db = getDB();
        const users = db.collection('users');

        const existing = await users.findOne({ email });
        if (existing) {
            res.status(400).json({ message: 'User already exists' });
            return;
        }

        const hashed = await hashPassword(password);
        const result = await users.insertOne({
            name,
            email,
            password: hashed,
            image: image || '',
            role: 'consumer',   // ✅ default role
            createdAt: new Date(),
        });

        const token = generateToken(result.insertedId.toString(), 'consumer');
        res.status(201).json({
            token,
            user: { id: result.insertedId, name, email, role: 'consumer', image: image || '' },
        });
    } catch (err) {
        res.status(500).json({ message: 'Server error' });
    }
});

// POST /api/auth/login
router.post('/login', async (req: Request, res: Response) => {
    try {
        const { email, password } = req.body;
        const db = getDB();
        const users = db.collection('users');
        const user = await users.findOne({ email });
        if (!user) {
            res.status(400).json({ message: 'Invalid credentials' });
            return;
        }
        const isMatch = await comparePassword(password, user.password);
        if (!isMatch) {
            res.status(400).json({ message: 'Invalid credentials' });
            return;
        }

        // ✅ user.role সরাসরি ডাটাবেজ থেকে আসছে (admin, xen, billing ইত্যাদি)
        const token = generateToken(user._id.toString(), user.role);

        res.json({
            token,
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                role: user.role,        // ✅ ডাটাবেজের আসল রোল
                image: user.image || '',
            },
        });
    } catch (err) {
        res.status(500).json({ message: 'Server error' });
    }
});

// POST /api/auth/google (Google login/register)
router.post('/google', async (req: Request, res: Response) => {
    try {
        const { googleId, email, name, image } = req.body;
        const db = getDB();
        const users = db.collection('users');
        let user = await users.findOne({ email });
        if (!user) {
            const result = await users.insertOne({
                name,
                email,
                googleId,
                image: image || '',
                role: 'consumer',      // ✅ default role
                createdAt: new Date(),
            });
            const token = generateToken(result.insertedId.toString(), 'consumer');
            res.status(201).json({
                token,
                user: { id: result.insertedId, name, email, role: 'consumer', image: image || '' },
            });
            return;
        }

        // বিদ্যমান ইউজার
        const token = generateToken(user._id.toString(), user.role);
        res.json({
            token,
            user: { id: user._id, name: user.name, email: user.email, role: user.role, image: user.image || '' },
        });
    } catch (err) {
        res.status(500).json({ message: 'Server error' });
    }
});

// GET /api/auth/me (protected)
router.get('/me', protect, async (req: AuthRequest, res: Response) => {
    try {
        const db = getDB();
        const users = db.collection('users');
        const user = await users.findOne(
            { _id: new ObjectId(req.user!.userId) },
            { projection: { password: 0 } }
        );
        if (!user) {
            res.status(404).json({ message: 'User not found' });
            return;
        }
        res.json(user);
    } catch (err) {
        res.status(500).json({ message: 'Server error' });
    }
});

// PUT /api/auth/change-password (protected)
router.put('/change-password', protect, async (req: AuthRequest, res: Response) => {
    try {
        const { currentPassword, newPassword } = req.body;
        const db = getDB();
        const users = db.collection('users');
        const user = await users.findOne({ _id: new ObjectId(req.user!.userId) });
        if (!user) {
            res.status(404).json({ message: 'User not found' });
            return;
        }
        const isMatch = await comparePassword(currentPassword, user.password);
        if (!isMatch) {
            res.status(400).json({ message: 'Current password is incorrect' });
            return;
        }
        const hashed = await hashPassword(newPassword);
        await users.updateOne(
            { _id: new ObjectId(req.user!.userId) },
            { $set: { password: hashed } }
        );
        res.json({ message: 'Password changed successfully' });
    } catch (err) {
        res.status(500).json({ message: 'Server error' });
    }
});

export default router;