
'use client';

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { ORDER_COLORS } from '@/lib/data';
import { cn } from '@/lib/utils';
import { Check } from 'lucide-react';
import { useState } from 'react';

type ColorPickerProps = {
  color?: string;
  onColorChange: (color: string) => void;
};

export default function ColorPicker({ color, onColorChange }: ColorPickerProps) {
  const [isOpen, setIsOpen] = useState(false);

  const handleSelectColor = (newColor: string) => {
    onColorChange(newColor);
    setIsOpen(false);
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <button
          className="w-6 h-6 rounded-full border-2 border-white dark:border-zinc-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
          style={{ backgroundColor: color }}
          aria-label={`Current color: ${color}`}
        />
      </PopoverTrigger>
      <PopoverContent className="w-auto p-2">
        <div className="grid grid-cols-4 gap-2">
          {ORDER_COLORS.map((swatchColor) => (
            <button
              key={swatchColor}
              className={cn(
                'w-8 h-8 rounded-md border-2 transition-all duration-150',
                color === swatchColor
                  ? 'border-primary shadow-md scale-110'
                  : 'border-transparent hover:scale-110'
              )}
              style={{ backgroundColor: swatchColor }}
              onClick={() => handleSelectColor(swatchColor)}
              aria-label={`Select color: ${swatchColor}`}
            >
              {color === swatchColor && (
                <Check className="h-5 w-5 text-primary-foreground" />
              )}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
