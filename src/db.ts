
import { MongoClient, Db } from 'mongodb';
import dotenv from 'dotenv';
dotenv.config();

let client: MongoClient;
let db: Db;

export async function connectDB(): Promise<Db> {
    if (db) return db;
    const uri = process.env.MONGODB_URI;
    if (!uri) {
        console.warn('WARNING: MONGODB_URI is not defined in environment variables. Database connections will not be established.');
        return null as any;
    }
    try {
        client = new MongoClient(uri);
        await client.connect();
        db = client.db(process.env.DB_NAME || 'WZPDCL-DB'); // এখানে DB_NAME
        console.log('MongoDB connected');
        return db;
    } catch (err) {
        console.error('Failed to connect to MongoDB:', err);
        throw err;
    }
}

export function getDB(): Db {
    if (!db) throw new Error('Database not initialized. Please set the MONGODB_URI environment variable in the Settings tab.');
    return db;
}