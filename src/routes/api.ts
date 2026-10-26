import { Router } from 'express';
import { AssetController } from '../controllers/cms/AssetController';
import { AssetTakingController } from '../controllers/cms/AssetTakingController';
import { AuthController } from '../controllers/AuthController';
import { authenticateToken } from '../middlewares/authMiddleware';

const router = Router();

// PUBLIC ROUTES (AUTH)
router.post('/auth/signup', AuthController.signup);
router.post('/auth/login', AuthController.login);

// PROTECTED ROUTES (WAJIB LOGIN)
router.use(authenticateToken);

// Master Assets
router.get('/assets', AssetController.index);

// Asset Taking API
router.get('/asset-taking/schedules', AssetTakingController.getSchedules);
router.get('/asset-taking', AssetTakingController.index);
router.post('/asset-taking', AssetTakingController.store);
router.get('/asset-taking/report/:scheduleId', AssetTakingController.getReport);
router.put('/asset-taking/:id', AssetTakingController.update);
router.post('/asset-taking/approve', AssetTakingController.approveSignature);
router.get('/asset-taking/report/:scheduleId/pdf', AssetTakingController.downloadPdf);

export default router;