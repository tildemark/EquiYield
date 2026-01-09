import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
const SALT_ROUNDS = 10;
export function generatePassword(length = 12) {
    const raw = crypto.randomBytes(Math.ceil(length * 0.75)).toString('base64');
    return raw.replace(/[^a-zA-Z0-9]/g, '').slice(0, length) || 'TempPass123';
}
export async function hashPassword(password) {
    return bcrypt.hash(password, SALT_ROUNDS);
}
export async function comparePassword(password, hash) {
    return bcrypt.compare(password, hash);
}
function getJwtSecret() {
    const secret = process.env.JWT_SECRET;
    if (!secret)
        throw new Error('JWT_SECRET not configured');
    return secret;
}
export function signToken(payload, expiresIn = '30d') {
    const secret = getJwtSecret();
    return jwt.sign(payload, secret, { expiresIn });
}
export function verifyToken(token) {
    const secret = getJwtSecret();
    const decoded = jwt.verify(token, secret);
    const { userId, role } = decoded;
    return { userId, role };
}
