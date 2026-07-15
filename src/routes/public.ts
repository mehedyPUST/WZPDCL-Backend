// import { Router, Request, Response } from 'express';
// import { getDB } from '../db';
// import Stripe from 'stripe';
// import dotenv from 'dotenv';
// import { ObjectId } from 'mongodb';

// dotenv.config();

// const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
// const router = Router();

// // Public Pay Bill (মিটার নম্বর সার্চ)
// router.get('/bill/:meterNumber', async (req: Request, res: Response) => {
//     const db = getDB();
//     const bill = await db.collection('bills').findOne({
//         meterNumber: req.params.meterNumber,
//         status: 'unpaid',
//     });
//     if (!bill) {
//         res.status(404).json({ message: 'No unpaid bill found for this meter' });
//         return;
//     }
//     res.json(bill);
// });

// // Stripe Payment Intent for public bill pay
// router.post('/create-payment-intent', async (req: Request, res: Response) => {
//     const db = getDB();
//     const { billId } = req.body;
//     const bill = await db.collection('bills').findOne({ _id: new ObjectId(billId) });
//     if (!bill || bill.status === 'paid') {
//         res.status(400).json({ message: 'Bill not found or already paid' });
//         return;
//     }
//     const paymentIntent = await stripe.paymentIntents.create({
//         amount: Math.round(bill.amount * 100),
//         currency: 'bdt',
//         metadata: { billId: billId.toString(), public: 'true', type: 'bill_payment' },
//     });
//     res.json({ clientSecret: paymentIntent.client_secret });
// });

// // Stripe Webhook (public)
// router.post('/webhook', async (req: Request, res: Response) => {
//     const sig = req.headers['stripe-signature']!;
//     let event;
//     try {
//         event = stripe.webhooks.constructEvent(
//             req.body,
//             sig,
//             process.env.STRIPE_WEBHOOK_SECRET || ''
//         );
//     } catch (err) {
//         res.status(400).send(`Webhook Error: ${(err as Error).message}`);
//         return;
//     }

//     const db = getDB();

//     // বিল পেমেন্ট সফল (Payment Intent)
//     if (event.type === 'payment_intent.succeeded') {
//         const paymentIntent = event.data.object;
//         const metadata = paymentIntent.metadata;
//         if (metadata?.billId) {
//             await db.collection('bills').updateOne(
//                 { _id: new ObjectId(metadata.billId) },
//                 { $set: { status: 'paid', paidAt: new Date() } }
//             );
//             await db.collection('transactions').insertOne({
//                 billId: metadata.billId,
//                 amount: paymentIntent.amount_received / 100,
//                 stripePaymentId: paymentIntent.id,
//                 type: 'bill',
//                 createdAt: new Date(),
//             });
//         }
//     }

//     // কানেকশন ফি পেমেন্ট সফল (Checkout Session)
//     if (event.type === 'checkout.session.completed') {
//         const session = event.data.object;
//         const metadata = session.metadata;
//         if (metadata) {
//             const { applicationId, userId, type } = metadata;
//             if (type === 'connection_fee' && applicationId) {
//                 await db.collection('connections').updateOne(
//                     { _id: new ObjectId(applicationId) },
//                     {
//                         $set: {
//                             status: 'payment_done',
//                             paymentStatus: 'paid',
//                             feePaid: true,
//                             stripePaymentId: session.id,
//                             updatedAt: new Date(),
//                         },
//                     }
//                 );
//                 await db.collection('transactions').insertOne({
//                     userId: userId || null,
//                     applicationId,
//                     amount: session.amount_total ? session.amount_total / 100 : 0,
//                     type: 'connection_fee',
//                     stripePaymentId: session.id,
//                     status: 'completed',
//                     createdAt: new Date(),
//                 });
//             }
//         }
//     }

//     res.json({ received: true });
// });

// // পাবলিক রিভিউ লিস্ট
// router.get('/reviews', async (_req: Request, res: Response) => {
//     const db = getDB();
//     const reviews = await db.collection('reviews').find({ visible: true }).toArray();
//     res.json(reviews);
// });

// export default router;

import { Router, Request, Response } from 'express';
import { getDB } from '../db';
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

// Public Pay Bill (মিটার নম্বর সার্চ)
router.get('/bill/:meterNumber', async (req: Request, res: Response) => {
    const db = getDB();
    const bill = await db.collection('bills').findOne({
        meterNumber: req.params.meterNumber,
        status: 'unpaid',
    });
    if (!bill) {
        res.status(404).json({ message: 'No unpaid bill found for this meter' });
        return;
    }
    res.json(bill);
});

// Stripe Payment Intent for public bill pay
router.post('/create-payment-intent', async (req: Request, res: Response) => {
    const stripe = getStripe();
    const db = getDB();
    const { billId } = req.body;
    const bill = await db.collection('bills').findOne({ _id: new ObjectId(billId) });
    if (!bill || bill.status === 'paid') {
        res.status(400).json({ message: 'Bill not found or already paid' });
        return;
    }
    const paymentIntent = await stripe.paymentIntents.create({
        amount: Math.round(bill.amount * 100),
        currency: 'bdt',
        metadata: { billId: billId.toString(), public: 'true', type: 'bill_payment' },
    });
    res.json({ clientSecret: paymentIntent.client_secret });
});

// Stripe Webhook (public)
router.post('/webhook', async (req: Request, res: Response) => {
    const stripe = getStripe();
    const sig = req.headers['stripe-signature']!;
    let event;
    try {
        event = stripe.webhooks.constructEvent(
            req.body,
            sig,
            process.env.STRIPE_WEBHOOK_SECRET || ''
        );
    } catch (err) {
        res.status(400).send(`Webhook Error: ${(err as Error).message}`);
        return;
    }

    const db = getDB();

    // বিল পেমেন্ট সফল (Payment Intent)
    if (event.type === 'payment_intent.succeeded') {
        const paymentIntent = event.data.object;
        const metadata = paymentIntent.metadata;
        if (metadata?.billId) {
            await db.collection('bills').updateOne(
                { _id: new ObjectId(metadata.billId) },
                { $set: { status: 'paid', paidAt: new Date() } }
            );
            await db.collection('transactions').insertOne({
                billId: metadata.billId,
                amount: paymentIntent.amount_received / 100,
                stripePaymentId: paymentIntent.id,
                type: 'bill',
                createdAt: new Date(),
            });
        }
    }

    // কানেকশন ফি পেমেন্ট সফল (Checkout Session)
    if (event.type === 'checkout.session.completed') {
        const session = event.data.object;
        const metadata = session.metadata;
        if (metadata) {
            const { applicationId, userId, type } = metadata;
            if (type === 'connection_fee' && applicationId) {
                await db.collection('connections').updateOne(
                    { _id: new ObjectId(applicationId) },
                    {
                        $set: {
                            status: 'payment_done',
                            paymentStatus: 'paid',
                            feePaid: true,
                            stripePaymentId: session.id,
                            updatedAt: new Date(),
                        },
                    }
                );
                await db.collection('transactions').insertOne({
                    userId: userId || null,
                    applicationId,
                    amount: session.amount_total ? session.amount_total / 100 : 0,
                    type: 'connection_fee',
                    stripePaymentId: session.id,
                    status: 'completed',
                    createdAt: new Date(),
                });
            }
        }
    }

    res.json({ received: true });
});

// পাবলিক রিভিউ লিস্ট
router.get('/reviews', async (_req: Request, res: Response) => {
    const db = getDB();
    const reviews = await db.collection('reviews').find({ visible: true }).toArray();
    res.json(reviews);
});

export default router;