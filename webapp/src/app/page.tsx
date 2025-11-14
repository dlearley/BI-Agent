'use client';

import { RBACGuard } from '@/components/rbac-guard';
import { AppLayout } from '@/components/app-layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAnalytics } from '@/hooks/use-analytics';
import { Permission } from '@/types';

export default function DashboardPage() {
  const { data: analytics, isLoading, error } = useAnalytics();

  return (
    <RBACGuard requiredPermissions={[Permission.VIEW_ANALYTICS]}>
      <AppLayout>
        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-bold">Dashboard</h1>
            <p className="text-muted-foreground">
              Overview of your analytics and key metrics
            </p>
          </div>

          {isLoading && (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              {[...Array(4)].map((_, i) => (
                <Card key={i}>
                  <CardHeader className="pb-2">
                    <div className="h-4 bg-muted rounded animate-pulse" />
                  </CardHeader>
                  <CardContent>
                    <div className="h-8 bg-muted rounded animate-pulse" />
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {error && (
            <Card className="border-destructive">
              <CardHeader>
                <CardTitle>Error</CardTitle>
                <CardDescription>Failed to load analytics data</CardDescription>
              </CardHeader>
            </Card>
          )}

          {analytics && (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Pipeline Count</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{analytics.pipelineCount}</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Time to Fill</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{analytics.timeToFill} days</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Compliance Rate</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {(analytics.complianceStatus.complianceRate * 100).toFixed(1)}%
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Total Revenue</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    ${analytics.revenue.totalRevenue.toLocaleString()}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </AppLayout>
    </RBACGuard>
  );
}
