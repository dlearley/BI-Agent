'use client';

import { RBACGuard } from '@/components/rbac-guard';
import { AppLayout } from '@/components/app-layout';
import { Permission } from '@/types';

export default function ReportsPage() {
  return (
    <RBACGuard requiredPermissions={[Permission.EXPORT_DATA]}>
      <AppLayout>
        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-bold">Reports</h1>
            <p className="text-muted-foreground">
              Generate and export reports
            </p>
          </div>
          <div className="text-muted-foreground">
            Report generation coming soon...
          </div>
        </div>
      </AppLayout>
    </RBACGuard>
  );
}
