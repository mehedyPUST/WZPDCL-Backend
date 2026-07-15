// import { Router, Response } from 'express';
// import { getDB } from '../db';
// import { protect, authorize, AuthRequest } from '../middleware/auth';
// import Stripe from 'stripe';
// import dotenv from 'dotenv';
// import { ObjectId } from 'mongodb';

// dotenv.config();

// const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

// const router = Router();

// // 1. Stripe Payment Intent তৈরি (বিল পেমেন্টের জন্য - Consumer)
// router.post(
//     '/create-payment-intent',
//     protect,
//     authorize('consumer'),
//     async (req: AuthRequest, res: Response) => {
//         try {
//             const db = getDB();
//             const { billId } = req.body;

//             const bill = await db
//                 .collection('bills')
//                 .findOne({ _id: new ObjectId(billId) });

//             if (!bill || bill.status === 'paid') {
//                 res.status(400).json({ message: 'Bill not found or already paid' });
//                 return;
//             }

//             const paymentIntent = await stripe.paymentIntents.create({
//                 amount: Math.round(bill.amount * 100), // cents
//                 currency: 'bdt',
//                 metadata: {
//                     billId: billId.toString(),
//                     userId: req.user!.userId,
//                     type: 'bill_payment',
//                 },
//             });

//             res.json({ clientSecret: paymentIntent.client_secret });
//         } catch (error: any) {
//             console.error('Payment intent error:', error);
//             res.status(500).json({ message: error.message || 'Payment failed' });
//         }
//     }
// );

// // 2. Stripe Checkout Session তৈরি (নতুন সংযোগ আবেদনের পেমেন্ট)
// router.post(
//     '/create-connection-payment',
//     protect,
//     async (req: AuthRequest, res: Response) => {
//         try {
//             const { applicationId, amount, connectionType, description } = req.body;
//             const userId = req.user!.userId;
//             const db = getDB();

//             // আবেদন খুঁজে বের করো (pending_payment স্ট্যাটাসে)
//             const application = await db.collection('connections').findOne({
//                 _id: new ObjectId(applicationId),
//                 userId: new ObjectId(userId),
//                 status: 'pending_payment',
//             });

//             if (!application) {
//                 res.status(404).json({
//                     message: 'Application not found or not eligible for payment',
//                 });
//                 return;
//             }

//             // Stripe চেকআউট সেশন তৈরি
//             const session = await stripe.checkout.sessions.create({
//                 payment_method_types: ['card'],
//                 line_items: [
//                     {
//                         price_data: {
//                             currency: 'bdt',
//                             product_data: {
//                                 name: `New Connection - ${connectionType}`,
//                                 description:
//                                     description || `Application ID: ${applicationId}`,
//                             },
//                             unit_amount: Math.round(amount * 100), // পয়সায় রূপান্তর
//                         },
//                         quantity: 1,
//                     },
//                 ],
//                 mode: 'payment',
//                 success_url: `${process.env.FRONTEND_URL}/dashboard/consumer/payment-success?app=${applicationId}`,
//                 cancel_url: `${process.env.FRONTEND_URL}/dashboard/consumer/connections?payment=cancelled`,
//                 metadata: {
//                     applicationId: applicationId.toString(),
//                     userId: userId,
//                     type: 'connection_fee',
//                 },
//             });

//             // সেশন URL রিটার্ন
//             res.json({ url: session.url });
//         } catch (error: any) {
//             console.error('Checkout session error:', error);
//             res.status(500).json({ message: error.message || 'Payment failed' });
//         }
//     }
// );

// // src/routes/payments.ts (শেষে যোগ করো)
// router.post('/manual-confirm-payment', protect, async (req: AuthRequest, res: Response) => {
//     const { applicationId } = req.body;
//     const userId = req.user!.userId;
//     const db = getDB();

//     const application = await db.collection('connections').findOne({
//         _id: new ObjectId(applicationId),
//         userId: new ObjectId(userId),
//         status: 'pending_payment',
//     });

//     if (!application) {
//         return res.status(400).json({ message: 'Application not eligible for confirmation' });
//     }

//     // সংযোগের স্ট্যাটাস আপডেট
//     await db.collection('connections').updateOne(
//         { _id: new ObjectId(applicationId) },
//         {
//             $set: {
//                 status: 'payment_done',
//                 paymentStatus: 'paid',
//                 feePaid: true,
//                 updatedAt: new Date(),
//             },
//         }
//     );

//     // ✅ ট্রানজেকশন রেকর্ড তৈরি (এটা গুরুত্বপূর্ণ)
//     const totalAmount = (application.feeAmount || 0) +
//         (application.connectionType === 'residential' ? 2000 :
//             application.connectionType === 'commercial' ? 5000 : 10000);

//     await db.collection('transactions').insertOne({
//         userId: userId,
//         applicationId: applicationId,
//         amount: totalAmount,
//         type: 'connection_fee',
//         status: 'completed',
//         method: 'online',  // বা 'manual'
//         createdAt: new Date(),
//     });

//     res.json({ message: 'Payment confirmed manually' });
// });

// // 3. ট্রানজেকশন হিস্টোরি (Consumer)
// router.get(
//     '/my',
//     protect,
//     authorize('consumer'),
//     async (req: AuthRequest, res: Response) => {
//         try {
//             const db = getDB();
//             const transactions = await db
//                 .collection('transactions')
//                 .find({ userId: new ObjectId(req.user!.userId) })
//                 .sort({ createdAt: -1 })
//                 .toArray();
//             res.json(transactions);
//         } catch (error) {
//             res.status(500).json({ message: 'Server error' });
//         }
//     }
// );

// // 4. সব ট্রানজেকশন (XEN, Admin)
// router.get(
//     '/all',
//     protect,
//     authorize('xen', 'admin'),
//     async (_req: AuthRequest, res: Response) => {
//         try {
//             const db = getDB();
//             const transactions = await db
//                 .collection('transactions')
//                 .find()
//                 .sort({ createdAt: -1 })
//                 .toArray();
//             res.json(transactions);
//         } catch (error) {
//             res.status(500).json({ message: 'Server error' });
//         }
//     }
// );

// export default router;


import { Router, Response } from 'express';
import { getDB } from '../db';
import { protect, authorize, AuthRequest } from '../middleware/auth';
import Stripe from 'stripe';
import dotenv from 'dotenv';
import { ObjectId } from 'mongodb';

dotenv.config();

let stripeClient: Stripe | null = null;
const getStripe = (): Stripe => {
    if (!stripeClient) {
        const apiKey = process.env.STRIPE_SECRET_KEY;
        if (!apiKey) {
            throw new Error('STRIPE_SECRET_KEY is not defined in the environment variables');
        }
        stripeClient = new Stripe(apiKey);
    }
    return stripeClient;
};

const router = Router();

// 1. Stripe Payment Intent তৈরি (বিল পেমেন্টের জন্য - Consumer)
router.post(
    '/create-payment-intent',
    protect,
    authorize('consumer'),
    async (req: AuthRequest, res: Response) => {
        try {
            const stripe = getStripe();
            const db = getDB();
            const { billId } = req.body;

            const bill = await db
                .collection('bills')
                .findOne({ _id: new ObjectId(billId) });

            if (!bill || bill.status === 'paid') {
                res.status(400).json({ message: 'Bill not found or already paid' });
                return;
            }

            const paymentIntent = await stripe.paymentIntents.create({
                amount: Math.round(bill.amount * 100), // cents
                currency: 'bdt',
                metadata: {
                    billId: billId.toString(),
                    userId: req.user!.userId,
                    type: 'bill_payment',
                },
            });

            res.json({ clientSecret: paymentIntent.client_secret });
        } catch (error: any) {
            console.error('Payment intent error:', error);
            res.status(500).json({ message: error.message || 'Payment failed' });
        }
    }
);

// 2. Stripe Checkout Session তৈরি (নতুন সংযোগ আবেদনের পেমেন্ট)
router.post(
    '/create-connection-payment',
    protect,
    async (req: AuthRequest, res: Response) => {
        try {
            const stripe = getStripe();
            const { applicationId, amount, connectionType, description } = req.body;
            const userId = req.user!.userId;
            const db = getDB();

            // আবেদন খুঁজে বের করো (pending_payment স্ট্যাটাসে)
            const application = await db.collection('connections').findOne({
                _id: new ObjectId(applicationId),
                userId: new ObjectId(userId),
                status: 'pending_payment',
            });

            if (!application) {
                res.status(404).json({
                    message: 'Application not found or not eligible for payment',
                });
                return;
            }

            // Stripe চেকআউট সেশন তৈরি
            const session = await stripe.checkout.sessions.create({
                payment_method_types: ['card'],
                line_items: [
                    {
                        price_data: {
                            currency: 'bdt',
                            product_data: {
                                name: `New Connection - ${connectionType}`,
                                description:
                                    description || `Application ID: ${applicationId}`,
                            },
                            unit_amount: Math.round(amount * 100), // পয়সায় রূপান্তর
                        },
                        quantity: 1,
                    },
                ],
                mode: 'payment',
                success_url: `${process.env.FRONTEND_URL}/dashboard/consumer/payment-success?app=${applicationId}`,
                cancel_url: `${process.env.FRONTEND_URL}/dashboard/consumer/connections?payment=cancelled`,
                metadata: {
                    applicationId: applicationId.toString(),
                    userId: userId,
                    type: 'connection_fee',
                },
            });

            // সেশন URL রিটার্ন
            res.json({ url: session.url });
        } catch (error: any) {
            console.error('Checkout session error:', error);
            res.status(500).json({ message: error.message || 'Payment failed' });
        }
    }
);

// src/routes/payments.ts (শেষে যোগ করো)
router.post('/manual-confirm-payment', protect, async (req: AuthRequest, res: Response) => {
    const { applicationId } = req.body;
    const userId = req.user!.userId;
    const db = getDB();

    const application = await db.collection('connections').findOne({
        _id: new ObjectId(applicationId),
        userId: new ObjectId(userId),
        status: 'pending_payment',
    });

    if (!application) {
        return res.status(400).json({ message: 'Application not eligible for confirmation' });
    }

    // সংযোগের স্ট্যাটাস আপডেট
    await db.collection('connections').updateOne(
        { _id: new ObjectId(applicationId) },
        {
            $set: {
                status: 'payment_done',
                paymentStatus: 'paid',
                feePaid: true,
                updatedAt: new Date(),
            },
        }
    );

    // ✅ ট্রানজেকশন রেকর্ড তৈরি (এটা গুরুত্বপূর্ণ)
    const totalAmount = (application.feeAmount || 0) +
        (application.connectionType === 'residential' ? 2000 :
            application.connectionType === 'commercial' ? 5000 : 10000);

    await db.collection('transactions').insertOne({
        userId: userId,
        applicationId: applicationId,
        amount: totalAmount,
        type: 'connection_fee',
        status: 'completed',
        method: 'online',  // বা 'manual'
        createdAt: new Date(),
    });

    res.json({ message: 'Payment confirmed manually' });
});

// 3. ট্রানজেকশন হিস্টোরি (Consumer)
router.get(
    '/my',
    protect,
    authorize('consumer'),
    async (req: AuthRequest, res: Response) => {
        try {
            const db = getDB();
            const transactions = await db
                .collection('transactions')
                .find({ userId: new ObjectId(req.user!.userId) })
                .sort({ createdAt: -1 })
                .toArray();
            res.json(transactions);
        } catch (error) {
            res.status(500).json({ message: 'Server error' });
        }
    }
);

// 4. সব ট্রানজেকশন (XEN, Admin)
router.get(
    '/all',
    protect,
    authorize('xen', 'admin'),
    async (_req: AuthRequest, res: Response) => {
        try {
            const db = getDB();
            const transactions = await db
                .collection('transactions')
                .find()
                .sort({ createdAt: -1 })
                .toArray();
            res.json(transactions);
        } catch (error) {
            res.status(500).json({ message: 'Server error' });
        }
    }
);

export default router;