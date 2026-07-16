// src/routes/consumers.ts – only collection name changed
import { Router, Response } from 'express';
import { getDB } from '../db';
import { protect, authorize, AuthRequest } from '../middleware/auth';
import { ObjectId } from 'mongodb';

const router = Router();

// Connection Wing: আনরেজিস্টার্ড কনজিউমার যোগ করা (মিটার সহ)
router.post('/add', protect, authorize('connection'), async (req: AuthRequest, res: Response) => {
    const db = getDB();
    const { meterNumber, name, address, phone } = req.body;
    // চেক: মিটার আগে থেকেই আছে কি না
    const existingMeter = await db.collection('meters').findOne({ meterNumber });
    if (existingMeter) {
        res.status(400).json({ message: 'Meter already exists' });
        return;
    }
    // meter collection-এ ঢোকানো (unclaimed)
    await db.collection('meters').insertOne({
        meterNumber,
        claimedBy: null,
        addedByConnectionWing: true,
        consumerInfo: { name, address, phone },
        createdAt: new Date()
    });
    res.status(201).json({ message: 'Consumer added successfully' });
});

// সবার কনজিউমার (meter collection থেকে সব, reg+unreg)
router.get('/all', protect, authorize('xen', 'connection', 'admin', 'billing'), async (_req: AuthRequest, res: Response) => {
    const db = getDB();
    const meters = await db.collection('meters').find().toArray();
    res.json(meters);
});


// পেমেন্ট সফল হলে স্ট্যাটাস আপডেট (success page থেকে কল হবে)
router.post('/confirm-payment/:applicationId', protect, async (req: AuthRequest, res: Response) => {
    const db = getDB();
    const { applicationId } = req.params;
    const userId = new ObjectId(req.user!.userId);

    const result = await db.collection('connections').updateOne(
        { _id: new ObjectId(applicationId), userId, status: 'pending_payment' },
        { $set: { status: 'payment_done', paymentStatus: 'paid', feePaid: true, updatedAt: new Date() } }
    );

    if (result.modifiedCount === 0) {
        return res.status(400).json({ message: 'Application not found or already processed' });
    }

    res.json({ message: 'Payment confirmed, status updated to payment_done' });
});

// এডিট (Connection Wing)
router.put('/:meterNumber', protect, authorize('connection'), async (req: AuthRequest, res: Response) => {
    const db = getDB();
    const { name, address, phone } = req.body;
    await db.collection('meters').updateOne(
        { meterNumber: req.params.meterNumber, addedByConnectionWing: true },
        { $set: { 'consumerInfo.name': name, 'consumerInfo.address': address, 'consumerInfo.phone': phone } }
    );
    res.json({ message: 'Consumer updated' });
});

// ডিলিট (Connection Wing)
router.delete('/:meterNumber', protect, authorize('connection'), async (req: AuthRequest, res: Response) => {
    const db = getDB();
    await db.collection('meters').deleteOne({ meterNumber: req.params.meterNumber, claimedBy: null });
    res.json({ message: 'Consumer deleted' });
});

export default router;