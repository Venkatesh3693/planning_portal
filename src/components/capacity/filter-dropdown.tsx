
'use client';

import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { ChevronDown } from 'lucide-react';

type FilterDropdownProps = {
  title: string;
  options: string[];
  selected: string[];
  onSelectedChange: (selected: string[]) => void;
};

export function FilterDropdown({
  title,
  options,
  selected,
  onSelectedChange,
}: FilterDropdownProps) {
  const handleCheckedChange = (value: string) => {
    const newSelected = selected.includes(value)
      ? selected.filter((item) => item !== value)
      : [...selected, value];
    onSelectedChange(newSelected);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="flex items-center gap-1 group outline-none ring-0 focus:ring-0 focus-visible:ring-0">
            <span className="font-medium text-muted-foreground group-hover:text-foreground">{title}</span>
            {selected.length > 0 && (
                <span className="bg-primary text-primary-foreground text-xs font-bold rounded-full px-1.5 py-0.5">
                    {selected.length}
                </span>
            )}
            <ChevronDown className="h-4 w-4 opacity-50 group-hover:opacity-100" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56">
        <DropdownMenuLabel>{title}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {options.map((option) => (
          <DropdownMenuCheckboxItem
            key={option}
            checked={selected.includes(option)}
            onCheckedChange={() => handleCheckedChange(option)}
            onSelect={(e) => e.preventDefault()} // Prevent closing on select
          >
            {option}
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
