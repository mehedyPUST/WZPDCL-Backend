import { Router, Response } from 'express';
import { getDB } from '../db';
import { protect, AuthRequest } from '../middleware/auth';
import { ObjectId } from 'mongodb';

const router = Router();

// PUT /api/users/profile
router.put('/profile', protect, async (req: AuthRequest, res: Response) => {
  try {
    const db = getDB();
    const { name, mobile, address, dob, nid } = req.body;
    const userId = req.user!.userId;

    await db.collection('users').updateOne(  // ✅ তোমার collection নাম ('user' বা 'users')
      { _id: new ObjectId(userId) },
      { $set: { name, mobile, address, dob, nid } }
    );

    res.json({ message: 'Profile updated successfully' });
  } catch (err) {
    console.error('Profile update error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

export default router;