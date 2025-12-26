'use client';

import { RBACGuard } from '@/components/rbac-guard';
import { AppLayout } from '@/components/app-layout';
import { Permission } from '@/types';

export default function DashboardsPage() {
  return (
    <RBACGuard requiredPermissions={[Permission.VIEW_ANALYTICS]}>
      <AppLayout>
        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-bold">Dashboards</h1>
            <p className="text-muted-foreground">
              Create and manage custom dashboards
            </p>
          </div>
          <div className="text-muted-foreground">
            Dashboard builder coming soon...
          </div>
        </div>
      </AppLayout>
    </RBACGuard>
  );
}
