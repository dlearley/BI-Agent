import { Router } from 'express';
import { teamController } from '../controllers/team.controller';
import { authenticate } from '../middleware/auth';
import { auditLogger } from '../middleware/audit';

const router = Router();

// Apply authentication to all routes
router.use(authenticate);

// Team endpoints
router.get('/', teamController.listTeams.bind(teamController));
router.get('/:teamId', teamController.getTeam.bind(teamController));
router.put('/:teamId', auditLogger('update_team', 'team'), teamController.updateTeam.bind(teamController));
router.delete('/:teamId', auditLogger('delete_team', 'team'), teamController.deleteTeam.bind(teamController));

// Team members endpoints
router.get('/:teamId/members', teamController.getMembers.bind(teamController));
router.post('/:teamId/members', auditLogger('add_team_member', 'team'), teamController.addMember.bind(teamController));
router.delete('/:teamId/members/:userId', auditLogger('remove_team_member', 'team'), teamController.removeMember.bind(teamController));

// Workspace team endpoints
router.post('/workspace/:workspaceId/teams', auditLogger('create_team', 'team'), teamController.createTeam.bind(teamController));
router.get('/workspace/:workspaceId/teams', teamController.listWorkspaceTeams.bind(teamController));

export default router;
