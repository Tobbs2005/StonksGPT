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
    <div className="flex gap-3 p-4 bg-card/80">
      <Input
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        onKeyPress={handleKeyPress}
        placeholder="Type your message or trading command..."
        disabled={disabled}
        className="flex-1 rounded-full border-border/60 bg-background/80 placeholder:text-muted-foreground focus:ring-2 focus:ring-primary/50"
      />
      <Button
        onClick={handleSend}
        disabled={disabled || !message.trim()}
        className="shrink-0 rounded-full px-6 bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm transition-colors"
        size="icon"
      >
        <Send className="h-4 w-4" />
      </Button>
    </div>
  );
}
