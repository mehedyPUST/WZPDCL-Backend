import { Router, Response } from 'express';
import { getDB } from '../db';
import { protect, authorize, AuthRequest } from '../middleware/auth';
import { ObjectId } from 'mongodb';

const router = Router();

// সব আনক্লেইমড মিটার দেখার জন্য (Consumer)
router.get('/available', protect, authorize('consumer'), async (_req: AuthRequest, res: Response) => {
    const db = getDB();
    const meters = await db.collection('meters').find({ claimedBy: null }).toArray();
    res.json(meters);
});

// মিটার ক্লেইম করা (Consumer)
router.post('/claim', protect, authorize('consumer'), async (req: AuthRequest, res: Response) => {
    const db = getDB();
    const { meterNumber } = req.body;
    const userId = req.user!.userId;

    const meter = await db.collection('meters').findOne({ meterNumber, claimedBy: null });
    if (!meter) {
        res.status(400).json({ message: 'Meter not available or already claimed' });
        return;
    }

    await db.collection('meters').updateOne(
        { _id: meter._id },
        { $set: { claimedBy: new ObjectId(userId), claimedAt: new Date() } }
    );
    res.json({ message: 'Meter claimed successfully' });
});

// আমার ক্লেইম করা মিটারগুলো (Consumer)
router.get('/my', protect, authorize('consumer'), async (req: AuthRequest, res: Response) => {
    const db = getDB();
    const meters = await db.collection('meters').find({ claimedBy: new ObjectId(req.user!.userId) }).toArray();
    res.json(meters);
});

export default router;