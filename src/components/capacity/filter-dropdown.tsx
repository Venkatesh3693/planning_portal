
'use client';

import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
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
        <Button variant="outline" className="flex items-center gap-2">
          {title}
          {selected.length > 0 && (
            <>
              <span className="h-4 w-[1px] bg-border" />
              <span className="bg-primary text-primary-foreground text-xs font-bold rounded-full px-1.5 py-0.5">
                {selected.length}
              </span>
            </>
          )}
          <ChevronDown className="h-4 w-4 opacity-50" />
        </Button>
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
