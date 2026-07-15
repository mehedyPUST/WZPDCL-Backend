// src/routes/complaints.ts
import { Router, Response } from 'express';
import { getDB } from '../db';
import { protect, authorize, AuthRequest } from '../middleware/auth';
import { ObjectId } from 'mongodb';

const router = Router();

// 1. Consumer Register Complaint (meter থাকতে হবে)
router.post('/register', protect, authorize('consumer'), async (req: AuthRequest, res: Response) => {
    try {
        const db = getDB();
        const { meterNumber, description } = req.body;
        const userId = new ObjectId(req.user!.userId);

        // চেক করো মিটারটি এই ইউজারের ক্লেইম করা কিনা
        const meter = await db.collection('meters').findOne({
            meterNumber,
            claimedBy: userId,
        });

        if (!meter) {
            return res.status(400).json({ message: 'You do not own this meter or it is not claimed.' });
        }

        const complaint = {
            userId,
            meterNumber,
            description,
            status: 'pending',  // pending -> teamSent -> resolved
            createdAt: new Date(),
            updatedAt: new Date(),
        };

        const result = await db.collection('complaints').insertOne(complaint);
        res.status(201).json({
            message: 'Complaint registered',
            complaintId: result.insertedId,
            ...complaint,
        });
    } catch (error) {
        console.error('Register complaint error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// 2. Consumer তার নিজের অভিযোগগুলো দেখে
router.get('/my', protect, authorize('consumer'), async (req: AuthRequest, res: Response) => {
    try {
        const db = getDB();
        const complaints = await db
            .collection('complaints')
            .find({ userId: new ObjectId(req.user!.userId) })
            .sort({ createdAt: -1 })
            .toArray();
        res.json(complaints);
    } catch (error) {
        console.error('Fetch my complaints error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// 3. Complaint Manager / XEN / Admin সব অভিযোগ দেখতে পারবে
router.get('/all', protect, authorize('complaint', 'xen', 'admin'), async (_req: AuthRequest, res: Response) => {
    try {
        const db = getDB();
        const complaints = await db
            .collection('complaints')
            .find()
            .sort({ createdAt: -1 })
            .toArray();
        res.json(complaints);
    } catch (error) {
        console.error('Fetch all complaints error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// 4. Complaint Manager অ্যাকশন নেয় (send team / resolve)
router.put('/action/:id', protect, authorize('complaint'), async (req: AuthRequest, res: Response) => {
    try {
        const db = getDB();
        const { action, teamInfo } = req.body; // 'sendTeam' or 'resolve'
        const { id } = req.params;

        const update: any = { updatedAt: new Date() };

        if (action === 'sendTeam') {
            update.status = 'teamSent';
            if (teamInfo) update.teamInfo = teamInfo;
        } else if (action === 'resolve') {
            update.status = 'resolved';
            update.resolvedAt = new Date();
        } else {
            return res.status(400).json({ message: 'Invalid action. Use sendTeam or resolve.' });
        }

        const result = await db.collection('complaints').updateOne(
            { _id: new ObjectId(id) },
            { $set: update }
        );

        if (result.matchedCount === 0) {
            return res.status(404).json({ message: 'Complaint not found' });
        }

        res.json({ message: 'Complaint updated', status: update.status });
    } catch (error) {
        console.error('Complaint action error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

export default router;