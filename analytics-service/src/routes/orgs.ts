import { Router } from 'express';
import { orgController } from '../controllers/org.controller';
import { authenticate } from '../middleware/auth';
import { auditLogger } from '../middleware/audit';

const router = Router();

// Apply authentication to all routes
router.use(authenticate);

// Org endpoints
router.post('/', auditLogger('create_org', 'org'), orgController.createOrg.bind(orgController));
router.get('/', orgController.listOrgs.bind(orgController));
router.get('/:orgId', orgController.getOrg.bind(orgController));
router.put('/:orgId', auditLogger('update_org', 'org'), orgController.updateOrg.bind(orgController));
router.delete('/:orgId', auditLogger('delete_org', 'org'), orgController.deleteOrg.bind(orgController));

// Org members endpoints
router.get('/:orgId/members', orgController.getMembers.bind(orgController));
router.post('/:orgId/members', auditLogger('add_org_member', 'org'), orgController.addMember.bind(orgController));
router.delete('/:orgId/members/:userId', auditLogger('remove_org_member', 'org'), orgController.removeMember.bind(orgController));

// Workspace endpoints
router.post('/:orgId/workspaces', auditLogger('create_workspace', 'workspace'), orgController.createWorkspace.bind(orgController));
router.get('/:orgId/workspaces', orgController.listWorkspaces.bind(orgController));

export default router;
