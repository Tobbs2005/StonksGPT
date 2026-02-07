import { AccountInfo } from './AccountInfo';
import { PositionsList } from './PositionsList';

export function Sidebar() {
  return (
    <div className="space-y-4">
      <AccountInfo />
      <PositionsList />
    </div>
  );
}
