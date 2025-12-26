'use client';

import { RBACGuard } from '@/components/rbac-guard';
import { AppLayout } from '@/components/app-layout';
import { Permission } from '@/types';
import { useInsights } from '@/hooks/use-analytics';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function InsightsPage() {
  const { data: insights, isLoading } = useInsights();

  return (
    <RBACGuard requiredPermissions={[Permission.VIEW_ANALYTICS]}>
      <AppLayout>
        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-bold">Insights</h1>
            <p className="text-muted-foreground">
              AI-powered insights and anomaly detection
            </p>
          </div>

          {isLoading && (
            <Card>
              <CardHeader>
                <div className="h-4 bg-muted rounded animate-pulse w-1/3" />
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="h-4 bg-muted rounded animate-pulse" />
                  <div className="h-4 bg-muted rounded animate-pulse w-5/6" />
                </div>
              </CardContent>
            </Card>
          )}

          {insights && (
            <Card>
              <CardHeader>
                <CardTitle>Insights Report</CardTitle>
                <CardDescription>Generated insights from your data</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm">{insights.narrative || 'No insights available'}</p>
              </CardContent>
            </Card>
          )}

          {!isLoading && !insights && (
            <div className="text-muted-foreground">
              No insights available at the moment
            </div>
          )}
        </div>
      </AppLayout>
    </RBACGuard>
  );
}
