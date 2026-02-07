import { useState } from 'react';
import { ChatInterface } from './components/Chat/ChatInterface';
import { Sidebar } from './components/Sidebar/Sidebar';
import { ThemeToggle } from './components/ui/theme-toggle';
import { Menu, X } from 'lucide-react';
import { Button } from './components/ui/button';
import { cn } from './lib/utils';

function App() {
  const [sidebarOpen, setSidebarOpen] = useState(true);

  return (
    <div className="h-screen flex flex-col">
      <header className="border-b p-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={() => setSidebarOpen(!sidebarOpen)}
          >
            {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
          <h1 className="text-2xl font-bold">Alpaca MCP Trading Dashboard</h1>
        </div>
        <ThemeToggle />
      </header>
      <div className="flex-1 flex overflow-hidden">
        <aside
          className={cn(
            'border-r bg-muted/40 transition-transform duration-300 ease-in-out',
            'lg:translate-x-0 lg:static lg:w-80',
            sidebarOpen
              ? 'translate-x-0 w-80 absolute inset-y-0 z-10'
              : '-translate-x-full absolute'
          )}
        >
          <div className="h-full p-4 space-y-4 overflow-y-auto">
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
        <main className="flex-1 p-4 min-w-0">
          <ChatInterface />
        </main>
      </div>
    </div>
  );
}

export default App;
