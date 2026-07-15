// src/routes/connections.ts
import { Router, Response } from 'express';
import { getDB } from '../db';
import { protect, authorize, AuthRequest } from '../middleware/auth';
import { ObjectId } from 'mongodb';

const router = Router();

// 1. কনজিউমার নতুন সংযোগ আবেদন
router.post('/apply', protect, authorize('consumer'), async (req: AuthRequest, res: Response) => {
    try {
        const db = getDB();
        const userId = new ObjectId(req.user!.userId);

        const {
            applicantName,
            email,
            mobile,
            nidNo,
            address,
            connectionType,
            loadRequired,
            voltageLevel,
            purpose,
            feederName,
            transformerNo,
            poleNumber,
            nearestLandmark,
            status = 'pending_payment',
            paymentStatus = 'pending',
            feeAmount = 0,
        } = req.body;

        const applicationId = `APP-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;

        const connectionDoc = {
            userId,
            applicantName,
            email,
            mobile,
            nidNo,
            address,
            connectionType,
            loadRequired: Number(loadRequired),
            voltageLevel,
            purpose,
            feederName,
            transformerNo,
            poleNumber,
            nearestLandmark,
            status,
            paymentStatus,
            feeAmount: Number(feeAmount), // ✅ ফি সংরক্ষণ
            applicationId,
            assignedMeterNo: null,
            implementedAt: null,
            xenRemarks: null,
            connectionWingRemarks: null,
            createdAt: new Date(),
            updatedAt: new Date(),
        };

        const result = await db.collection('connections').insertOne(connectionDoc);

        res.status(201).json({
            message: 'Application created',
            _id: result.insertedId,
            applicationId: connectionDoc.applicationId,
        });
    } catch (error) {
        console.error('Apply connection error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// 2. XEN রিভিউ
// XEN Approve/Reject
router.put('/xen-review/:id', protect, authorize('xen'), async (req: AuthRequest, res: Response) => {
    try {
        const db = getDB();
        const { status, rejectReason } = req.body; // status: 'approved' or 'rejected'
        const { id } = req.params;

        if (!['approved', 'rejected'].includes(status)) {
            return res.status(400).json({ message: 'Invalid status' });
        }

        // Find the application first (optional, but good for verification)
        const app = await db.collection('connections').findOne({ _id: new ObjectId(id) });
        if (!app) {
            return res.status(404).json({ message: 'Application not found' });
        }

        // Define the update object
        const update: any = {
            updatedAt: new Date(),
        };

        if (status === 'approved') {
            update.status = 'forwarded_to_wing';          // ✅ main status
            update.xenRemarks = 'Approved by XEN';
            // paymentStatus stays as 'paid', but we can also explicitly set
            update.paymentStatus = 'paid';  // ensure it remains paid
        } else {
            update.status = 'rejected';
            update.xenRemarks = rejectReason || 'Rejected by XEN';
            update.rejectReason = rejectReason || 'No reason provided';
            // paymentStatus can remain as 'paid' or not, doesn't matter
        }

        console.log('Updating application', id, 'with', update);

        // Perform the update
        const result = await db.collection('connections').updateOne(
            { _id: new ObjectId(id) },
            { $set: update }
        );

        console.log('Update result:', result);

        if (result.modifiedCount === 0) {
            return res.status(400).json({ message: 'Update failed' });
        }

        res.json({ message: `Application ${status}` });
    } catch (error) {
        console.error('XEN review error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});
// 3. Connection Wing action
router.put('/connection-action/:id', protect, authorize('connection'), async (req: AuthRequest, res: Response) => {
    try {
        const db = getDB();
        const { action, meterNumber } = req.body;
        const { id } = req.params;
        const update: any = { updatedAt: new Date() };
        if (action === 'sendTeam') update.status = 'teamAssigned';
        else if (action === 'complete') {
            update.status = 'completed';
            if (meterNumber) {
                update.meterAssigned = meterNumber;
                await db.collection('meters').updateOne(
                    { meterNumber },
                    { $set: { assignedToConnection: id } }
                );
            }
        }
        await db.collection('connections').updateOne({ _id: new ObjectId(id) }, { $set: update });
        res.json({ message: 'Updated' });
    } catch (error) {
        console.error('Connection action error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// 4. কনজিউমার নিজের আবেদন
router.get('/my', protect, authorize('consumer'), async (req: AuthRequest, res: Response) => {
    try {
        const db = getDB();
        // ✅ ObjectId দিয়ে userId ফিল্টার
        const connections = await db
            .collection('connections')
            .find({ userId: new ObjectId(req.user!.userId) })
            .sort({ createdAt: -1 })
            .toArray();
        res.json(connections);
    } catch (error) {
        console.error('Fetch user connections error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// 5. সব আবেদন (XEN, Connection Wing, Admin)
router.get('/all', protect, authorize('xen', 'connection', 'admin'), async (_req: AuthRequest, res: Response) => {
    try {
        const db = getDB();
        const connections = await db
            .collection('connections')
            .find()
            .sort({ createdAt: -1 })
            .toArray();
        res.json(connections);
    } catch (error) {
        console.error('Fetch all connections error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

export default router;