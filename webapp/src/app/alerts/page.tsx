'use client';

import { RBACGuard } from '@/components/rbac-guard';
import { AppLayout } from '@/components/app-layout';
import { Permission } from '@/types';

export default function AlertsPage() {
  return (
    <RBACGuard requiredPermissions={[Permission.VIEW_ANALYTICS]}>
      <AppLayout>
        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-bold">Alerts</h1>
            <p className="text-muted-foreground">
              Manage alerts and notifications
            </p>
          </div>
          <div className="text-muted-foreground">
            Alerts configuration coming soon...
          </div>
        </div>
      </AppLayout>
    </RBACGuard>
  );
}
