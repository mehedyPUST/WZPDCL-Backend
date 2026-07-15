// src/routes/bills.ts
import { Router, Response } from 'express';
import { getDB } from '../db';
import { protect, authorize, AuthRequest } from '../middleware/auth';
import { ObjectId } from 'mongodb';

const router = Router();

// 1. কনজিউমার তার নিজের বিলগুলো দেখবে (My Bills)
router.get('/my', protect, authorize('consumer'), async (req: AuthRequest, res: Response) => {
    try {
        const db = getDB();
        const meters = await db.collection('meters')
            .find({ claimedBy: new ObjectId(req.user!.userId) })
            .toArray();
        const meterNumbers = meters.map(m => m.meterNumber);
        const bills = await db.collection('bills')
            .find({ meterNumber: { $in: meterNumbers } })
            .sort({ createdAt: -1 })
            .toArray();
        res.json(bills);
    } catch (err) {
        res.status(500).json({ message: 'Server error' });
    }
});

// 2. Billing Wing: নতুন বিল জেনারেট (Generate Bill)
router.post('/generate', protect, authorize('billing'), async (req: AuthRequest, res: Response) => {
    try {
        const db = getDB();
        const { meterNumber, prevReading, currReading, consumerType, billingMonth } = req.body;

        // একই মিটার ও একই মাসে বিল আছে কিনা চেক
        if (billingMonth) {
            const existingBill = await db.collection('bills').findOne({
                meterNumber,
                billingMonth,
            });
            if (existingBill) {
                return res.status(400).json({
                    message: `A bill already exists for meter ${meterNumber} in ${billingMonth}.`,
                });
            }
        }

        const rate = consumerType === 'commercial' ? 10 : consumerType === 'industrial' ? 15 : 5;
        const units = Number(currReading) - Number(prevReading);
        if (units <= 0) {
            return res.status(400).json({ message: 'Current reading must be greater than previous.' });
        }
        const amount = units * rate;

        const bill = {
            meterNumber,
            consumerType,
            prevReading: Number(prevReading),
            currReading: Number(currReading),
            units,
            amount,
            status: 'unpaid',
            billingMonth: billingMonth || new Date().toISOString().slice(0, 7),
            createdAt: new Date(),
            dueDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000),
        };

        const result = await db.collection('bills').insertOne(bill);
        res.status(201).json({ billId: result.insertedId, ...bill });
    } catch (err) {
        res.status(500).json({ message: 'Server error' });
    }
});

// 3. সবার বিল (XEN, Billing Wing, Admin)
router.get('/all', protect, authorize('xen', 'billing', 'admin'), async (_req: AuthRequest, res: Response) => {
    try {
        const db = getDB();
        const bills = await db.collection('bills').find().toArray();
        res.json(bills);
    } catch (err) {
        res.status(500).json({ message: 'Server error' });
    }
});

// 4. Receive Bill (Billing Wing – অফলাইন পেমেন্ট রিসিভ করে পেইড স্ট্যাটাস)
router.post('/receive-payment', protect, authorize('billing'), async (req: AuthRequest, res: Response) => {
    try {
        const db = getDB();
        const { billId } = req.body;

        const bill = await db.collection('bills').findOne({ _id: new ObjectId(billId) });
        if (!bill) {
            res.status(404).json({ message: 'Bill not found' });
            return;
        }
        if (bill.status === 'paid') {
            res.status(400).json({ message: 'Bill already paid' });
            return;
        }

        await db.collection('bills').updateOne(
            { _id: new ObjectId(billId) },
            { $set: { status: 'paid', paidAt: new Date() } }
        );

        await db.collection('transactions').insertOne({
            billId: billId,
            amount: bill.amount,
            type: 'bill',
            method: 'offline',
            createdAt: new Date(),
            processedBy: req.user!.userId,
        });

        res.json({ message: 'Bill marked as paid' });
    } catch (err) {
        res.status(500).json({ message: 'Server error' });
    }
});

// 5. Edit Bill (Billing Wing, Admin)
router.put('/:id', protect, authorize('billing', 'admin'), async (req: AuthRequest, res: Response) => {
    try {
        const db = getDB();
        const { id } = req.params;
        const { prevReading, currReading, consumerType, units, amount } = req.body;

        const result = await db.collection('bills').updateOne(
            { _id: new ObjectId(id) },
            {
                $set: {
                    prevReading: Number(prevReading),
                    currReading: Number(currReading),
                    consumerType,
                    units: Number(units),
                    amount: Number(amount),
                    updatedAt: new Date(),
                },
            }
        );

        if (result.matchedCount === 0) {
            return res.status(404).json({ message: 'Bill not found' });
        }
        res.json({ message: 'Bill updated' });
    } catch (err) {
        res.status(500).json({ message: 'Server error' });
    }
});

export default router;