import { Router } from 'express';
import { authController } from './auth.controller';
import { authenticate } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { loginSchema } from './auth.validator';

const router = Router();

router.post('/login', validate({ body: loginSchema }), (req, res, next) => authController.login(req, res, next));
router.post('/logout', authenticate, (req, res, next) => authController.logout(req, res, next));
router.get('/session', authenticate, (req, res, next) => authController.getSession(req, res, next));

export default router;
