// src/routes/admin.ts – only collection name changed
import { Router, Response } from 'express';
import { getDB } from '../db';
import { protect, authorize, AuthRequest } from '../middleware/auth';
import { ObjectId } from 'mongodb';

const router = Router();

const DEFAULT_SETTINGS = {
    connectionFeeResidential: 5000,
    connectionFeeCommercial: 10000,
    connectionFeeIndustrial: 20000,
    securityDepositResidential: 2000,
    securityDepositCommercial: 5000,
    securityDepositIndustrial: 10000,
    billRateResidential: 5,
    billRateCommercial: 10,
    dueDays: 15,
    autoApprove: false,
};

// ---------- ইউজার ম্যানেজমেন্ট ----------

router.get('/users', protect, authorize('admin'), async (_req: AuthRequest, res: Response) => {
    const db = getDB();
    const users = await db.collection('user').find({}, { projection: { password: 0 } }).toArray();   // ✅
    res.json(users);
});

router.put('/change-role/:userId', protect, authorize('admin'), async (req: AuthRequest, res: Response) => {
    const db = getDB();
    const { role } = req.body;
    const { userId } = req.params;

    if (req.user!.userId === userId) {
        return res.status(400).json({ message: 'You cannot change your own role.' });
    }

    await db.collection('user').updateOne(   // ✅
        { _id: new ObjectId(userId) },
        { $set: { role } }
    );
    res.json({ message: 'Role updated' });
});

router.delete('/users/:userId', protect, authorize('admin'), async (req: AuthRequest, res: Response) => {
    const db = getDB();
    const { userId } = req.params;

    if (req.user!.userId === userId) {
        return res.status(400).json({ message: 'You cannot delete your own account.' });
    }

    await db.collection('user').deleteOne({ _id: new ObjectId(userId) });   // ✅
    res.json({ message: 'User deleted' });
});

// ---------- সিস্টেম সেটিংস (কোনো change নেই) ----------

router.get('/settings', protect, authorize('admin'), async (_req: AuthRequest, res: Response) => {
    const db = getDB();
    let settings: any = await db.collection('settings').findOne({ key: 'global' });

    if (!settings) {
        const newSettings = { key: 'global', ...DEFAULT_SETTINGS };
        await db.collection('settings').insertOne(newSettings);
        settings = newSettings;
    }

    const { key, _id, ...rest } = settings;
    res.json(rest);
});

router.put('/settings', protect, authorize('admin'), async (req: AuthRequest, res: Response) => {
    const db = getDB();
    const {
        connectionFeeResidential,
        connectionFeeCommercial,
        connectionFeeIndustrial,
        securityDepositResidential,
        securityDepositCommercial,
        securityDepositIndustrial,
        billRateResidential,
        billRateCommercial,
        dueDays,
        autoApprove,
    } = req.body;

    const update: any = {};
    if (typeof connectionFeeResidential === 'number') update.connectionFeeResidential = connectionFeeResidential;
    if (typeof connectionFeeCommercial === 'number') update.connectionFeeCommercial = connectionFeeCommercial;
    if (typeof connectionFeeIndustrial === 'number') update.connectionFeeIndustrial = connectionFeeIndustrial;
    if (typeof securityDepositResidential === 'number') update.securityDepositResidential = securityDepositResidential;
    if (typeof securityDepositCommercial === 'number') update.securityDepositCommercial = securityDepositCommercial;
    if (typeof securityDepositIndustrial === 'number') update.securityDepositIndustrial = securityDepositIndustrial;
    if (typeof billRateResidential === 'number') update.billRateResidential = billRateResidential;
    if (typeof billRateCommercial === 'number') update.billRateCommercial = billRateCommercial;
    if (typeof dueDays === 'number') update.dueDays = dueDays;
    if (typeof autoApprove === 'boolean') update.autoApprove = autoApprove;

    await db.collection('settings').updateOne(
        { key: 'global' },
        { $set: update },
        { upsert: true }
    );

    res.json({ message: 'Settings saved' });
});

export default router;