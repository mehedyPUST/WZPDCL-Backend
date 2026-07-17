import { Router, Response } from 'express';
import { getDB } from '../db';
import { protect, authorize, AuthRequest } from '../middleware/auth';
import { ObjectId } from 'mongodb';

const router = Router();

// Consumer রেটিং দেবে (শুধুমাত্র resolved complaint-এ)
router.post('/submit', protect, authorize('consumer'), async (req: AuthRequest, res: Response) => {
    const db = getDB();
    const { complaintId, rating, text } = req.body;
    const userId = req.user!.userId;   // string from JWT

    // complaint খুঁজে বের করো এবং নিশ্চিত করো এটা resolved এবং owner
    const complaint = await db.collection('complaints').findOne({
        _id: new ObjectId(complaintId),
        userId: new ObjectId(userId),   // ✅ userId ObjectId-তে রূপান্তর
        status: 'resolved',
    });

    if (!complaint) {
        res.status(400).json({ message: 'Complaint not resolved or not yours' });
        return;
    }

    // আগে থেকেই রিভিউ দেওয়া আছে কিনা চেক করো (একবারই দেওয়া যাবে)
    const existingReview = await db.collection('reviews').findOne({
        complaintId: new ObjectId(complaintId),
        userId: new ObjectId(userId),
    });
    if (existingReview) {
        res.status(400).json({ message: 'You have already submitted a review for this complaint' });
        return;
    }

    const review = {
        userId: new ObjectId(userId),
        complaintId: new ObjectId(complaintId),
        rating: Number(rating),
        text: text || '',
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
        { _id: new ObjectId(req.params.id) },
        { $set: { visible: false } }
    );
    res.json({ message: 'Review hidden' });
});

export default router;