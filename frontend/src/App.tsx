import { useState } from 'react';
import { ChatInterface } from './components/Chat/ChatInterface';
import { Sidebar } from './components/Sidebar/Sidebar';
import { NavigationBar } from './components/Navigation/NavigationBar';
import { Menu, X } from 'lucide-react';
import { Button } from './components/ui/button';
import { cn } from './lib/utils';

function App() {
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const handleLogout = () => {
    console.log('Logout clicked');
    // Add your logout logic here
  };

  const handleGoHome = () => {
    setSidebarOpen(true);
  };

  return (
    <div className="h-screen flex flex-col bg-background">
      <NavigationBar
        userName="User"
        onGoHome={handleGoHome}
      />
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <aside
          className={cn(
            'w-80 shrink-0 border-r border-border bg-sidebar transition-all duration-300 ease-in-out',
            'lg:translate-x-0 lg:relative',
            sidebarOpen
              ? 'translate-x-0 absolute inset-y-0 z-20 h-full'
              : '-translate-x-full absolute h-full'
          )}
        >
          <div className="h-full p-4 space-y-4 overflow-hidden">
            <div className="lg:hidden flex justify-end mb-4">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setSidebarOpen(false)}
              >
                <X className="h-5 w-5" />
              </Button>
            </div>
            <Sidebar />
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 overflow-hidden bg-background">
          <div className="h-full w-full flex flex-col p-6 gap-6 overflow-hidden">
            <div className="flex items-center gap-4 lg:hidden">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setSidebarOpen(true)}
              >
                <Menu className="h-5 w-5" />
              </Button>
              <h2 className="text-lg font-semibold text-foreground">Chat</h2>
            </div>
            <div className="flex-1 overflow-hidden">
              <ChatInterface />
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

export default App;
