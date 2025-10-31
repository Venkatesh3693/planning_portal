
'use client';

import { useState, useMemo } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Filter, X, ChevronDown } from 'lucide-react';
import type { FrcRow } from '@/lib/types';
import { Badge } from '../ui/badge';

export type FrcFilters = {
  ccNos: string[];
  models: string[];
  frcWeekRange: { start: number | null, end: number | null };
  ckWeekRange: { start: number | null, end: number | null };
};

type FilterPopoverProps = {
  allFrcData: FrcRow[];
  filters: FrcFilters;
  onFiltersChange: (filters: FrcFilters) => void;
};

const MultiSelectDropdown = ({ title, options, selected, onSelectedChange, disabled = false }: { title: string, options: string[], selected: string[], onSelectedChange: (selected: string[]) => void, disabled?: boolean }) => (
  <DropdownMenu>
    <DropdownMenuTrigger asChild>
      <Button variant="outline" className="w-full justify-between" disabled={disabled}>
        <span>{selected.length > 0 ? `${selected.length} selected` : title}</span>
        <ChevronDown className="h-4 w-4 opacity-50" />
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent className="w-[--radix-dropdown-menu-trigger-width]">
      <DropdownMenuLabel>{title}</DropdownMenuLabel>
      <DropdownMenuSeparator />
      {options.map((option) => (
        <DropdownMenuCheckboxItem
          key={option}
          checked={selected.includes(option)}
          onCheckedChange={() => onSelectedChange(
            selected.includes(option)
              ? selected.filter(item => item !== option)
              : [...selected, option]
          )}
          onSelect={(e) => e.preventDefault()}
        >
          {option}
        </DropdownMenuCheckboxItem>
      ))}
    </DropdownMenuContent>
  </DropdownMenu>
);


export function FilterPopover({ allFrcData, filters, onFiltersChange }: FilterPopoverProps) {
  const [isOpen, setIsOpen] = useState(false);

  const filterOptions = useMemo(() => {
    const ccNos = [...new Set(allFrcData.map(d => d.ccNo))].sort();
    const models = [...new Set(allFrcData.filter(d => filters.ccNos.length === 0 || filters.ccNos.includes(d.ccNo)).map(d => d.model))].sort();
    const allFrcWeeks = [...new Set(allFrcData.map(d => parseInt(d.frcWeek.replace('W', ''))))].sort((a,b) => a-b);
    const allCkWeeks = [...new Set(allFrcData.map(d => parseInt(d.ckWeek.replace('W', ''))))].sort((a,b) => a-b);
    return { ccNos, models, allFrcWeeks, allCkWeeks };
  }, [allFrcData, filters.ccNos]);

  const handleClearFilters = () => {
    onFiltersChange({
      ccNos: [],
      models: [],
      frcWeekRange: { start: null, end: null },
      ckWeekRange: { start: null, end: null },
    });
  };
  
  const numActiveFilters = useMemo(() => {
      let count = 0;
      if (filters.ccNos.length > 0) count++;
      if (filters.models.length > 0) count++;
      if (filters.frcWeekRange.start !== null || filters.frcWeekRange.end !== null) count++;
      if (filters.ckWeekRange.start !== null || filters.ckWeekRange.end !== null) count++;
      return count;
  }, [filters]);


  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" className="relative">
          <Filter className="mr-2 h-4 w-4" />
          Filter
           {numActiveFilters > 0 && <Badge variant="secondary" className="ml-2">{numActiveFilters}</Badge>}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80">
        <div className="grid gap-4">
          <div className="space-y-2">
            <h4 className="font-medium leading-none">Filters</h4>
            <p className="text-sm text-muted-foreground">Filter the FRC data.</p>
          </div>
          <div className="grid gap-2">
            <div className="space-y-2">
                <Label>CC No.</Label>
                <MultiSelectDropdown title="Select CCs" options={filterOptions.ccNos} selected={filters.ccNos} onSelectedChange={(newCcs) => onFiltersChange({...filters, ccNos: newCcs, models: [] })} />
            </div>
            <div className="space-y-2">
                <Label>Model / Color</Label>
                <MultiSelectDropdown title="Select Models" options={filterOptions.models} selected={filters.models} onSelectedChange={(newModels) => onFiltersChange({...filters, models: newModels})} disabled={filters.ccNos.length === 0} />
            </div>
            <div className="space-y-2">
                <Label>FRC Week</Label>
                <div className="flex gap-2">
                    <Select value={filters.frcWeekRange.start?.toString() ?? ''} onValueChange={(val) => onFiltersChange({...filters, frcWeekRange: {...filters.frcWeekRange, start: val ? parseInt(val) : null }})}>
                        <SelectTrigger><SelectValue placeholder="Start" /></SelectTrigger>
                        <SelectContent>
                            {filterOptions.allFrcWeeks.map(w => <SelectItem key={w} value={w.toString()}>W{w}</SelectItem>)}
                        </SelectContent>
                    </Select>
                     <Select value={filters.frcWeekRange.end?.toString() ?? ''} onValueChange={(val) => onFiltersChange({...filters, frcWeekRange: {...filters.frcWeekRange, end: val ? parseInt(val) : null }})}>
                        <SelectTrigger><SelectValue placeholder="End" /></SelectTrigger>
                        <SelectContent>
                            {filterOptions.allFrcWeeks.filter(w => filters.frcWeekRange.start === null || w >= filters.frcWeekRange.start).map(w => <SelectItem key={w} value={w.toString()}>W{w}</SelectItem>)}
                        </SelectContent>
                    </Select>
                </div>
            </div>
             <div className="space-y-2">
                <Label>CK Week</Label>
                <div className="flex gap-2">
                    <Select value={filters.ckWeekRange.start?.toString() ?? ''} onValueChange={(val) => onFiltersChange({...filters, ckWeekRange: {...filters.ckWeekRange, start: val ? parseInt(val) : null }})}>
                        <SelectTrigger><SelectValue placeholder="Start" /></SelectTrigger>
                        <SelectContent>
                            {filterOptions.allCkWeeks.map(w => <SelectItem key={w} value={w.toString()}>W{w}</SelectItem>)}
                        </SelectContent>
                    </Select>
                     <Select value={filters.ckWeekRange.end?.toString() ?? ''} onValueChange={(val) => onFiltersChange({...filters, ckWeekRange: {...filters.ckWeekRange, end: val ? parseInt(val) : null }})}>
                        <SelectTrigger><SelectValue placeholder="End" /></SelectTrigger>
                        <SelectContent>
                            {filterOptions.allCkWeeks.filter(w => filters.ckWeekRange.start === null || w >= filters.ckWeekRange.start).map(w => <SelectItem key={w} value={w.toString()}>W{w}</SelectItem>)}
                        </SelectContent>
                    </Select>
                </div>
            </div>
          </div>
           {numActiveFilters > 0 && (
            <Button variant="ghost" onClick={handleClearFilters} className="w-full justify-start text-destructive hover:text-destructive px-0">
              <X className="mr-2 h-4 w-4" />
              Clear all filters
            </Button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
