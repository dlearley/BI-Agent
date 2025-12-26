'use client';

import { RBACGuard } from '@/components/rbac-guard';
import { AppLayout } from '@/components/app-layout';
import { UserRole, Permission } from '@/types';
import { useAuditLogs } from '@/hooks/use-analytics';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function AdminPage() {
  const { data: auditLogs, isLoading } = useAuditLogs();

  return (
    <RBACGuard requiredRoles={[UserRole.ADMIN]} requiredPermissions={[Permission.MANAGE_GOVERNANCE]}>
      <AppLayout>
        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-bold">Admin Panel</h1>
            <p className="text-muted-foreground">
              Manage users, permissions, and system settings
            </p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Recent Audit Logs</CardTitle>
              <CardDescription>View system activity and audit logs</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading && (
                <div className="space-y-2">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="h-4 bg-muted rounded animate-pulse" />
                  ))}
                </div>
              )}
              {auditLogs && auditLogs.length > 0 ? (
                <div className="text-sm">
                  {auditLogs.slice(0, 5).map((log: any) => (
                    <div key={log.id} className="py-2 border-b last:border-0">
                      <p>{log.action} by {log.userEmail}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground">No audit logs available</p>
              )}
            </CardContent>
          </Card>
        </div>
      </AppLayout>
    </RBACGuard>
  );
}
