'use client';

import { RBACGuard } from '@/components/rbac-guard';
import { AppLayout } from '@/components/app-layout';
import { Permission } from '@/types';

export default function QueriesPage() {
  return (
    <RBACGuard requiredPermissions={[Permission.VIEW_ANALYTICS]}>
      <AppLayout>
        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-bold">Queries</h1>
            <p className="text-muted-foreground">
              Build and execute custom queries
            </p>
          </div>
          <div className="text-muted-foreground">
            Query builder coming soon...
          </div>
        </div>
      </AppLayout>
    </RBACGuard>
  );
}
