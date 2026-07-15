import { Router, Response } from 'express';
import { getDB } from '../db';
import { protect, authorize, AuthRequest } from '../middleware/auth';

const router = Router();

// Consumer রেটিং দেবে (শুধুমাত্র resolved complaint-এ)
router.post('/submit', protect, authorize('consumer'), async (req: AuthRequest, res: Response) => {
    const db = getDB();
    const { complaintId, rating, text } = req.body;
    const complaint = await db.collection('complaints').findOne({
        _id: new (require('mongodb').ObjectId)(complaintId),
        userId: req.user!.userId,
        status: 'resolved',
    });
    if (!complaint) {
        res.status(400).json({ message: 'Complaint not resolved or not yours' });
        return;
    }
    const review = {
        userId: req.user!.userId,
        complaintId,
        rating,
        text,
        visible: true,
        createdAt: new Date(),
    };
    await db.collection('reviews').insertOne(review);
    res.status(201).json({ message: 'Review submitted' });
});

// Public: সব রিভিউ (visible=true)
router.get('/public', async (_req, res: Response) => {
    const db = getDB();
    const reviews = await db.collection('reviews').find({ visible: true }).toArray();
    res.json(reviews);
});

// Admin: রিভিউ ডিলিট (visible=false)
router.put('/hide/:id', protect, authorize('admin'), async (req: AuthRequest, res: Response) => {
    const db = getDB();
    await db.collection('reviews').updateOne(
        { _id: new (require('mongodb').ObjectId)(req.params.id) },
        { $set: { visible: false } }
    );
    res.json({ message: 'Review hidden' });
});

export default router;