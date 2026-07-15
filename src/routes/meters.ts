// src/routes/meters.ts
import { Router, Response } from 'express';
import { getDB } from '../db';
import { protect, authorize, AuthRequest } from '../middleware/auth';
import { ObjectId } from 'mongodb';

const router = Router();

// ---------- 1. আনক্লেইমড মিটার দেখার জন্য (Consumer) ----------
router.get(
    '/available',
    protect,
    authorize('consumer'),
    async (_req: AuthRequest, res: Response) => {
        const db = getDB();
        const meters = await db
            .collection('meters')
            .find({ claimedBy: null, status: { $ne: 'inactive' } })
            .toArray();
        res.json(meters);
    }
);

// ---------- 2. মিটার ক্লেইম করা (Consumer) ----------
router.post(
    '/claim',
    protect,
    authorize('consumer'),
    async (req: AuthRequest, res: Response) => {
        const db = getDB();
        const { meterNumber } = req.body;
        const userId = req.user!.userId;

        const meter = await db
            .collection('meters')
            .findOne({ meterNumber, claimedBy: null, status: { $ne: 'inactive' } });

        if (!meter) {
            res.status(400).json({ message: 'Meter not available or already claimed' });
            return;
        }

        await db.collection('meters').updateOne(
            { _id: meter._id },
            { $set: { claimedBy: new ObjectId(userId), claimedAt: new Date() } }
        );
        res.json({ message: 'Meter claimed successfully' });
    }
);

// ---------- 3. আমার ক্লেইম করা মিটারগুলো (Consumer) ----------
router.get(
    '/my',
    protect,
    authorize('consumer'),
    async (req: AuthRequest, res: Response) => {
        const db = getDB();
        const meters = await db
            .collection('meters')
            .find({ claimedBy: new ObjectId(req.user!.userId) })
            .toArray();
        res.json(meters);
    }
);

// ---------- 4. সব মিটার (Connection Wing, XEN, Admin) ----------
router.get(
    '/all',
    protect,
    authorize('connection', 'xen', 'admin'),
    async (_req: AuthRequest, res: Response) => {
        const db = getDB();
        const meters = await db
            .collection('meters')
            .find()
            .sort({ createdAt: -1 })
            .toArray();
        res.json(meters);
    }
);

// ---------- 5. মিটার রিপ্লেস (Connection Wing) ----------
router.put(
    '/replace',
    protect,
    authorize('connection'),
    async (req: AuthRequest, res: Response) => {
        const db = getDB();
        const { oldMeterNumber, newMeterNumber } = req.body;

        if (!oldMeterNumber || !newMeterNumber) {
            res.status(400).json({ message: 'Both old and new meter numbers are required.' });
            return;
        }

        // পুরনো মিটার খুঁজে বের করো (inactive নয়)
        const oldMeter = await db
            .collection('meters')
            .findOne({ meterNumber: oldMeterNumber, status: { $ne: 'inactive' } });

        if (!oldMeter) {
            res.status(404).json({ message: 'Old meter not found or already inactive.' });
            return;
        }

        // ✅ নতুন মিটার নম্বর ইতিমধ্যে আছে কিনা — Duplicate check
        const existingNew = await db.collection('meters').findOne({ meterNumber: newMeterNumber });
        if (existingNew) {
            res.status(400).json({ message: 'New meter number already exists in the system.' });
            return;
        }

        // পুরনো মিটার inactive করো
        await db.collection('meters').updateOne(
            { meterNumber: oldMeterNumber },
            {
                $set: {
                    status: 'inactive',
                    replacedAt: new Date(),
                    replacedBy: newMeterNumber,
                },
            }
        );

        // নতুন মিটার তৈরি করো
        const newMeter = {
            meterNumber: newMeterNumber,
            consumerInfo: oldMeter.consumerInfo || {},
            claimedBy: null,
            addedByConnectionWing: true,
            replacedFrom: oldMeterNumber,
            status: 'active',
            lastReading: oldMeter.lastReading || 0,
            createdAt: new Date(),
        };

        const result = await db.collection('meters').insertOne(newMeter);

        // কানেকশন কালেকশনে meterAssigned আপডেট
        await db.collection('connections').updateMany(
            { meterAssigned: oldMeterNumber },
            { $set: { meterAssigned: newMeterNumber } }
        );

        res.json({
            message: 'Meter replaced successfully',
            newMeterId: result.insertedId,
        });
    }
);

// ---------- 6. ইনঅ্যাক্টিভ মিটার ডিলিট (Connection Wing) ----------
router.delete(
    '/:id',
    protect,
    authorize('connection'),
    async (req: AuthRequest, res: Response) => {
        const db = getDB();
        const { id } = req.params;

        // শুধু inactive মিটার ডিলিট করা যাবে
        const meter = await db.collection('meters').findOne({
            _id: new ObjectId(id),
            status: 'inactive',
        });

        if (!meter) {
            res.status(404).json({ message: 'Inactive meter not found or already removed.' });
            return;
        }

        await db.collection('meters').deleteOne({ _id: new ObjectId(id) });
        res.json({ message: 'Inactive meter removed permanently.' });
    }
);

export default router;