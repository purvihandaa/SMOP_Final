import { Response, NextFunction } from 'express';
import { copilotService } from './copilot.service';
import { AuthenticatedRequest } from '../../types';
import { sendSuccess } from '../../utils/response';

export class CopilotController {
  async chat(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { messages } = req.body;
      const userId = req.user!.userId;
      const userRole = req.user!.role;
      const username = req.user!.username;

      const response = await copilotService.chat(messages, userId, userRole, username);

      sendSuccess(res, { response }, 'Copilot response generated');
    } catch (err) {
      next(err);
    }
  }
}

export const copilotController = new CopilotController();
