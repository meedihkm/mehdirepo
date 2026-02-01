// ═══════════════════════════════════════════════════════════════════════════════
// AWID v3.0 - CONTROLLER AUTHENTIFICATION
// Login, logout, refresh, OTP
// ═══════════════════════════════════════════════════════════════════════════════

import { Request, Response } from 'express';
import { asyncHandler } from '../middlewares/error.middleware';
import authService from '../services/auth.service';
import { logger } from '../utils/logger';

// ═══════════════════════════════════════════════════════════════════════════════
// LOGIN ADMIN/MANAGER/LIVREUR
// ═══════════════════════════════════════════════════════════════════════════════

export const login = asyncHandler(async (req: Request, res: Response) => {
  const { email, password, deviceId } = req.body;

  const result = await authService.login(email, password, deviceId);

  res.json({
    success: true,
    data: result,
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// OTP CLIENT
// ═══════════════════════════════════════════════════════════════════════════════

export const requestOtp = asyncHandler(async (req: Request, res: Response) => {
  const { phone } = req.body;

  const result = await authService.requestCustomerOtp(phone);

  res.json({
    success: true,
    data: result,
  });
});

export const verifyOtp = asyncHandler(async (req: Request, res: Response) => {
  const { phone, otp, deviceId } = req.body;

  const result = await authService.verifyCustomerOtp(phone, otp, deviceId);

  res.json({
    success: true,
    data: result,
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// REFRESH TOKEN
// ═══════════════════════════════════════════════════════════════════════════════

export const refreshToken = asyncHandler(async (req: Request, res: Response) => {
  const { refreshToken } = req.body;

  const result = await authService.refreshTokens(refreshToken);

  res.json({
    success: true,
    data: result,
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// LOGOUT
// ═══════════════════════════════════════════════════════════════════════════════

export const logout = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const token = req.headers.authorization?.substring(7) || '';

  await authService.logout(userId, token);

  res.json({
    success: true,
    message: 'Déconnexion réussie',
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// CHANGEMENT MOT DE PASSE
// ═══════════════════════════════════════════════════════════════════════════════

export const changePassword = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const { currentPassword, newPassword } = req.body;

  await authService.changePassword(userId, currentPassword, newPassword);

  res.json({
    success: true,
    message: 'Mot de passe modifié avec succès',
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// RESET PASSWORD
// ═══════════════════════════════════════════════════════════════════════════════

export const requestPasswordReset = asyncHandler(async (req: Request, res: Response) => {
  const { email } = req.body;

  const result = await authService.requestPasswordReset(email);

  res.json({
    success: true,
    data: result,
  });
});

export const resetPassword = asyncHandler(async (req: Request, res: Response) => {
  const { token, newPassword } = req.body;

  await authService.resetPassword(token, newPassword);

  res.json({
    success: true,
    message: 'Mot de passe réinitialisé avec succès',
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// ME (Profil utilisateur connecté)
// ═══════════════════════════════════════════════════════════════════════════════

export const me = asyncHandler(async (req: Request, res: Response) => {
  const user = req.user!;

  res.json({
    success: true,
    data: {
      id: user.id,
      email: user.email,
      role: user.role,
      organizationId: user.organizationId,
    },
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════════════════════

export default {
  login,
  requestOtp,
  verifyOtp,
  refreshToken,
  logout,
  changePassword,
  requestPasswordReset,
  resetPassword,
  me,
};
