import { Router, Request, Response } from 'express';
import { getDB } from '../db';
import { generateToken, hashPassword, comparePassword } from '../auth';
import { protect, AuthRequest } from '../middleware/auth';
import { ObjectId } from 'mongodb';

const router = Router();

// ---------- Register (email/password) ----------
router.post('/register', async (req: Request, res: Response) => {
    try {
        const { name, email, password } = req.body;
        const db = getDB();
        const users = db.collection('users');

        const existing = await users.findOne({ email });
        if (existing) {
            return res.status(400).json({ message: 'User already exists' });
        }

        const hashed = await hashPassword(password);
        const result = await users.insertOne({
            name,
            email,
            password: hashed,
            role: 'consumer',           // ✅ ডিফল্ট রোল
            createdAt: new Date(),
        });

        const token = generateToken(result.insertedId.toString(), 'consumer');
        res.status(201).json({
            token,
            user: { id: result.insertedId, name, email, role: 'consumer' },
        });
    } catch (err) {
        console.error('Register error:', err);
        res.status(500).json({ message: 'Server error' });
    }
});

// ---------- Login (email/password) ----------
router.post('/login', async (req: Request, res: Response) => {
    try {
        const { email, password } = req.body;
        const db = getDB();
        const users = db.collection('users');
        const user = await users.findOne({ email });
        if (!user) {
            return res.status(400).json({ message: 'Invalid credentials' });
        }

        const isMatch = await comparePassword(password, user.password);
        if (!isMatch) {
            return res.status(400).json({ message: 'Invalid credentials' });
        }

        const token = generateToken(user._id.toString(), user.role);
        res.json({
            token,
            user: { id: user._id, name: user.name, email: user.email, role: user.role },
        });
    } catch (err) {
        console.error('Login error:', err);
        res.status(500).json({ message: 'Server error' });
    }
});

// ---------- Google Auth (Login/Register) ----------
router.post('/google', async (req: Request, res: Response) => {
    try {
        const { googleId, email, name, image } = req.body;
        console.log('📥 /api/auth/google hit:', { googleId, email, name });
        const db = getDB();
        const users = db.collection('users');

        // 1. googleId দিয়ে খোঁজা
        let user = await users.findOne({ googleId });
        if (user) {
            console.log('👤 Existing Google user found:', user.email);
            const token = generateToken(user._id.toString(), user.role);
            return res.json({
                token,
                user: { id: user._id, name: user.name, email: user.email, role: user.role },
            });
        }

        // 2. email দিয়ে খোঁজা (ইমেইল দিয়ে আগে রেজিস্টার করে থাকলে googleId লিংক)
        if (email) {
            user = await users.findOne({ email });
            if (user) {
                console.log('🔗 Linking Google ID to existing email user');
                await users.updateOne(
                    { _id: user._id },
                    { $set: { googleId, image: image || user.image } }
                );
                const token = generateToken(user._id.toString(), user.role);
                return res.json({
                    token,
                    user: { id: user._id, name: user.name, email: user.email, role: user.role },
                });
            }
        }

        // 3. নতুন ইউজার তৈরি (default role: consumer)
        console.log('🆕 Creating new user with Google');
        const result = await users.insertOne({
            name,
            email,
            googleId,
            image: image || '',
            role: 'consumer',       // ✅ ডিফল্ট রোল
            createdAt: new Date(),
        });

        const token = generateToken(result.insertedId.toString(), 'consumer');
        res.status(201).json({
            token,
            user: { id: result.insertedId, name, email, role: 'consumer' },
        });
    } catch (err) {
        console.error('❌ Google auth error:', err);
        res.status(500).json({ message: 'Server error' });
    }
});

export default router;