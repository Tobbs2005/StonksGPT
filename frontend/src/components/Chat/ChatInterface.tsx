import { useState, useRef, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { MessageList, Message } from './MessageList';
import { MessageInput } from './MessageInput';
import { chatApi } from '@/lib/api';

export function ChatInterface() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const handleSend = async (userMessage: string) => {
    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: userMessage,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setIsLoading(true);

    try {
      // Send natural language message to LLM service (uses Dedalus Labs MCP)
      // The LLM will automatically parse the message and call appropriate MCP tools
      const result = await chatApi.sendMessage(userMessage);
      
      const assistantMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: result,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } catch (error: any) {
      // Extract detailed error information
      let errorContent = '';
      let suggestions: string[] = [];
      
      if (error.response?.data) {
        // API error response
        const errorData = error.response.data;
        errorContent = errorData.error || 'Failed to process request';
        suggestions = errorData.suggestions || [];
      } else if (error.request) {
        // Network error
        errorContent = 'Unable to connect to the server. Please check your connection.';
        suggestions = [
          'Check your internet connection',
          'Verify the backend server is running',
          'Try again in a moment',
        ];
      } else {
        // Other error
        errorContent = error.message || 'An unexpected error occurred';
      }
      
      // Format error message with suggestions
      let formattedError = `**Error**: ${errorContent}`;
      
      if (suggestions.length > 0) {
        formattedError += '\n\n**Suggestions:**\n';
        suggestions.forEach((suggestion, index) => {
          formattedError += `${index + 1}. ${suggestion}\n`;
        });
      }
      
      // Add details in development mode (check if details exist)
      if (error.response?.data?.details) {
        // Only show details if we're likely in dev mode (no production check needed)
        formattedError += `\n\n_Details: ${error.response.data.details}_`;
      }
      
      const errorMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: formattedError,
        timestamp: new Date(),
        isError: true,
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="flex flex-col h-full">
      <CardContent className="flex-1 flex flex-col p-0 min-h-0">
        <div className="flex-1 overflow-hidden min-h-0">
          <MessageList messages={messages} isLoading={isLoading} />
          <div ref={messagesEndRef} />
        </div>
        <MessageInput onSend={handleSend} disabled={isLoading} />
      </CardContent>
    </Card>
  );
}
