import { CardContent } from '@/components/ui/card';
import { AccountInfo } from './AccountInfo';
import { PositionsList } from './PositionsList';
import { PendingOrdersList } from './PendingOrdersList';

export function Sidebar() {
  return (
    <div className="h-full w-full flex flex-col space-y-4 overflow-y-auto">
      {/* Account Info Section */}
      <div className="space-y-2">
        <h3 className="px-2 text-xs font-semibold uppercase tracking-widest text-sidebar-foreground/70">
          Account
        </h3>
        <CardContent className="pt-0">
          <AccountInfo />
        </CardContent>
      </div>

      {/* Positions Section */}
      <div className="space-y-2">
        <h3 className="px-2 text-xs font-semibold uppercase tracking-widest text-sidebar-foreground/70">
          Positions
        </h3>
        <CardContent className="pt-0">
          <PositionsList />
        </CardContent>
      </div>

      <div className="space-y-2">
        <h3 className="px-2 text-xs font-semibold uppercase tracking-widest text-sidebar-foreground/70">
          Pending Orders
        </h3>
        <CardContent className="pt-0 max-h-64 overflow-auto pr-1">
          <PendingOrdersList />
        </CardContent>
      </div>
    </div>
  );
}
