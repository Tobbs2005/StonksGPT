import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { ChatInterface } from '@/components/Chat/ChatInterface';

export function ChatPage() {
  return (
    <DashboardLayout flush>
      <div className="h-full w-full flex flex-col p-6 gap-6 overflow-hidden">
        <div className="flex-1 overflow-hidden">
          <ChatInterface />
        </div>
      </div>
    </DashboardLayout>
  );
}
