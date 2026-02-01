import jwt from 'jsonwebtoken';
import { config } from '../config';

export interface TokenPayload {
  userId?: string;
  customerId?: string;
  organizationId?: string;
  role?: string;
  type?: 'access' | 'refresh';
}

export const generateToken = (payload: TokenPayload, expiresIn: string = '24h'): string => {
  return jwt.sign(payload, config.jwt.secret, { expiresIn });
};

export const generateRefreshToken = (payload: TokenPayload): string => {
  return jwt.sign(
    { ...payload, type: 'refresh' },
    config.jwt.refreshSecret || config.jwt.secret,
    { expiresIn: '7d' }
  );
};

export const verifyToken = (token: string): TokenPayload => {
  return jwt.verify(token, config.jwt.secret) as TokenPayload;
};

export const verifyRefreshToken = (token: string): TokenPayload => {
  return jwt.verify(token, config.jwt.refreshSecret || config.jwt.secret) as TokenPayload;
};
