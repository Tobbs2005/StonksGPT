import { useState, KeyboardEvent } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Send } from 'lucide-react';

interface MessageInputProps {
  onSend: (message: string) => void;
  disabled?: boolean;
}

export function MessageInput({ onSend, disabled }: MessageInputProps) {
  const [message, setMessage] = useState('');

  const handleSend = () => {
    if (message.trim() && !disabled) {
      onSend(message);
      setMessage('');
    }
  };

  const handleKeyPress = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex gap-3 p-4 bg-card/60 backdrop-blur-xl border-t border-border/30">
      <Input
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        onKeyPress={handleKeyPress}
        placeholder="Type your message or trading command..."
        disabled={disabled}
        className="flex-1 rounded-full border-border/40 bg-background/80 shadow-surface placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring/30"
      />
      <Button
        onClick={handleSend}
        disabled={disabled || !message.trim()}
        className="shrink-0 rounded-full px-6 bg-primary hover:bg-primary/90 text-primary-foreground shadow-surface hover:shadow-elevated transition-all duration-150"
        size="icon"
      >
        <Send className="h-4 w-4" />
      </Button>
    </div>
  );
}
