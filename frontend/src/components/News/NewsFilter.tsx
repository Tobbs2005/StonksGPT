import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { X } from 'lucide-react';

interface NewsFilterProps {
  selectedSymbols: string[];
  onSymbolsChange: (symbols: string[]) => void;
  availableSymbols?: string[];
}

export function NewsFilter({ selectedSymbols, onSymbolsChange, availableSymbols = [] }: NewsFilterProps) {
  const [inputValue, setInputValue] = useState('');

  const handleAddSymbol = () => {
    const symbol = inputValue.trim().toUpperCase();
    if (symbol && !selectedSymbols.includes(symbol)) {
      onSymbolsChange([...selectedSymbols, symbol]);
      setInputValue('');
    }
  };

  const handleRemoveSymbol = (symbol: string) => {
    onSymbolsChange(selectedSymbols.filter(s => s !== symbol));
  };

  const handleClearAll = () => {
    onSymbolsChange([]);
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddSymbol();
    }
  };

  // Filter available symbols based on input
  const filteredAvailable = availableSymbols.filter(
    s => s.includes(inputValue.toUpperCase()) && !selectedSymbols.includes(s)
  ).slice(0, 5);

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <Input
          type="text"
          placeholder="Add symbol (e.g., AAPL)"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyPress={handleKeyPress}
          className="flex-1"
        />
        <Button onClick={handleAddSymbol} size="sm">
          Add
        </Button>
        {selectedSymbols.length > 0 && (
          <Button onClick={handleClearAll} variant="outline" size="sm">
            Clear All
          </Button>
        )}
      </div>
      
      {inputValue && filteredAvailable.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {filteredAvailable.map((symbol) => (
            <Button
              key={symbol}
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              onClick={() => {
                if (!selectedSymbols.includes(symbol)) {
                  onSymbolsChange([...selectedSymbols, symbol]);
                  setInputValue('');
                }
              }}
            >
              {symbol}
            </Button>
          ))}
        </div>
      )}
      
      {selectedSymbols.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selectedSymbols.map((symbol) => (
            <Badge key={symbol} variant="secondary" className="flex items-center gap-1">
              {symbol}
              <button
                onClick={() => handleRemoveSymbol(symbol)}
                className="ml-1 hover:bg-secondary-foreground/20 rounded-full p-0.5"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}
