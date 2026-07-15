import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../auth';

export interface AuthRequest extends Request {
    user?: { userId: string; role: string };
}

// JWT টোকেন ভেরিফাই করা
export function protect(req: AuthRequest, res: Response, next: NextFunction): void {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
        res.status(401).json({ message: 'No token, authorization denied' });
        return;
    }
    try {
        const decoded = verifyToken(token);
        req.user = decoded;
        next();
    } catch (err) {
        res.status(401).json({ message: 'Token is not valid' });
    }
}

// নির্দিষ্ট রোল(গুলো) চেক করা। তবে অ্যাডমিনকে সব রোল অ্যাক্সেস দেয়া হয়েছে।
export function authorize(...roles: string[]) {
    return (req: AuthRequest, res: Response, next: NextFunction) => {
        if (!req.user) {
            res.status(401).json({ message: 'Not authenticated' });
            return;
        }
        // যদি রোল ম্যাচ না করে এবং অ্যাডমিন না হয়, তাহলে ফরবিডেন
        if (!roles.includes(req.user.role) && req.user.role !== 'admin') {
            res.status(403).json({ message: 'Forbidden: insufficient role' });
            return;
        }
        next();
    };
}