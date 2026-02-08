import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { AccountInfo } from '@/components/Sidebar/AccountInfo';
import { PositionsList } from '@/components/Sidebar/PositionsList';
import { PendingOrdersList } from '@/components/Sidebar/PendingOrdersList';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export function AccountPage() {
  return (
    <DashboardLayout>
      <div>
        <h2 className="text-lg font-semibold text-foreground">Account</h2>
        <p className="text-sm text-muted-foreground">Your account details, positions, and orders.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Account Overview</CardTitle>
          </CardHeader>
          <CardContent>
            <AccountInfo />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Open Positions</CardTitle>
          </CardHeader>
          <CardContent>
            <PositionsList />
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Pending Orders</CardTitle>
          </CardHeader>
          <CardContent>
            <PendingOrdersList />
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
