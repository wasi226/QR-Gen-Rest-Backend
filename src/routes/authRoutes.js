import { Router } from 'express';
import {
	bootstrapAdmin,
	getMyProfile,
	login,
	registerUser,
	resetPassword,
	updateMyProfile,
	recoverPassword,
} from '../controllers/authController.js';
import { requireAuth, requireRoles } from '../middleware/auth.js';

const router = Router();

router.post('/bootstrap-admin', bootstrapAdmin);
router.post('/login', login);
router.post('/recover-password', recoverPassword);
router.get('/me', requireAuth, getMyProfile);
router.patch('/update-profile', requireAuth, updateMyProfile);
router.post('/register', requireAuth, requireRoles('ADMIN'), registerUser);
router.post('/reset-password', requireAuth, requireRoles('ADMIN'), resetPassword);

export default router;
