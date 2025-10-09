
'use client';

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { Order } from '@/lib/types';
import { format } from 'date-fns';
import type { DraggedItemData } from '@/app/page';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Filter, FilterX, ChevronDown } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { DatePicker } from '@/components/ui/date-picker';
import type { DateRange } from 'react-day-picker';
import { PROCESSES } from '@/lib/data';
import { addBusinessDays } from '@/lib/utils';
import { Separator } from '@/components/ui/separator';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';

const SEWING_PROCESS_ID = 'sewing';

type MachinePanelProps = {
  selectedProcessId: string;
  filteredUnplannedOrders: Order[];
  handleDragStart: (e: React.DragEvent<HTMLDivElement>, item: DraggedItemData) => void;
  sewingScheduledOrderIds: Set<string>;
  sewingLines: Record<string, number>;
  hasActiveFilters: boolean;
  filterOcn: string;
  setFilterOcn: (value: string) => void;
  filterBuyer: string[];
  buyerOptions: string[];
  handleBuyerFilterChange: (buyer: string) => void;
  filterDueDate?: DateRange;
  setFilterDueDate: (date: DateRange | undefined) => void;
  dueDateSort: 'asc' | 'desc' | null;
  setDueDateSort: (value: 'asc' | 'desc' | null) => void;
  clearFilters: () => void;
};

export default function MachinePanel({
  selectedProcessId,
  filteredUnplannedOrders,
  handleDragStart,
  sewingScheduledOrderIds,
  sewingLines,
  hasActiveFilters,
  filterOcn,
  setFilterOcn,
  filterBuyer,
  buyerOptions,
  handleBuyerFilterChange,
  filterDueDate,
  setFilterDueDate,
  dueDateSort,
  setDueDateSort,
  clearFilters,
}: MachinePanelProps) {
  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Unplanned</CardTitle>
        <div className="flex items-center gap-2">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="icon" className="relative">
                <Filter className="h-4 w-4" />
                {hasActiveFilters && (
                  <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-primary"></span>
                  </span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80">
              <div className="grid gap-4">
                <div className="space-y-2">
                  <h4 className="font-medium leading-none">Filters & Sort</h4>
                  <p className="text-sm text-muted-foreground">
                    Filter and sort the unplanned orders.
                  </p>
                </div>
                <div className="grid gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="filter-ocn">OCN</Label>
                    <Input
                      id="filter-ocn"
                      placeholder="e.g. ZAR4531"
                      value={filterOcn}
                      onChange={(e) => setFilterOcn(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Buyer</Label>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="outline"
                          className="w-full justify-between"
                        >
                          <span>
                            {filterBuyer.length > 0
                              ? filterBuyer.join(', ')
                              : 'All Buyers'}
                          </span>
                          <ChevronDown className="h-4 w-4 opacity-50" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent className="w-[--radix-dropdown-menu-trigger-width]">
                        <DropdownMenuLabel>Buyers</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        {buyerOptions.map((buyer) => (
                          <DropdownMenuCheckboxItem
                            key={buyer}
                            checked={filterBuyer.includes(buyer)}
                            onCheckedChange={() => handleBuyerFilterChange(buyer)}
                            onSelect={(e) => e.preventDefault()}
                          >
                            {buyer}
                          </DropdownMenuCheckboxItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  <div className="space-y-2">
                    <Label>Due Date</Label>
                    <DatePicker date={filterDueDate} setDate={setFilterDueDate} />
                  </div>

                  <Separator />

                  <div className="space-y-2">
                    <Label>Sort by Due Date</Label>
                    <RadioGroup value={dueDateSort || ''} onValueChange={(value) => setDueDateSort(value as 'asc' | 'desc' | null)}>
                        <div className="flex items-center space-x-2">
                            <RadioGroupItem value="asc" id="sort-asc" />
                            <Label htmlFor="sort-asc" className="font-normal">Ascending</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                            <RadioGroupItem value="desc" id="sort-desc" />
                            <Label htmlFor="sort-desc" className="font-normal">Descending</Label>
                        </div>
                    </RadioGroup>
                  </div>
                  
                  {hasActiveFilters && (
                    <>
                      <Separator />
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={clearFilters}
                        className="w-full justify-start text-destructive hover:text-destructive px-0"
                      >
                        <FilterX className="mr-2 h-4 w-4" />
                        Clear Filters & Sort
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </CardHeader>
      <CardContent className="flex-1 overflow-hidden">
        <ScrollArea className="h-full pr-4">
          <div className="space-y-2 p-2 pt-0">
            {filteredUnplannedOrders.map((order) => {
              const process = PROCESSES.find(p => p.id === selectedProcessId);
              const durationMinutes = process ? process.sam * order.quantity : 0;
              const durationDays = (durationMinutes / (8 * 60)).toFixed(1);
              const numLines = sewingLines[order.id] || 1;

              const tnaProcess =
                order.tna?.processes.find(
                  (p) => p.processId === selectedProcessId
                ) ?? null;

              const latestEndDate = tnaProcess?.latestStartDate && tnaProcess?.durationDays 
                ? addBusinessDays(new Date(tnaProcess.latestStartDate), tnaProcess.durationDays) 
                : null;

              const item: DraggedItemData = {
                type: 'new',
                orderId: order.id,
                processId: selectedProcessId,
                quantity: order.quantity,
                tna: tnaProcess?.earliestStartDate && tnaProcess?.latestStartDate
                  ? {
                      startDate: new Date(tnaProcess.earliestStartDate),
                      endDate: new Date(tnaProcess.latestStartDate),
                    }
                  : null,
              };

              return (
                <div
                  key={order.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, item)}
                  className="cursor-grab active:cursor-grabbing p-2 text-sm font-medium text-card-foreground rounded-md hover:bg-primary/10"
                  title={order.id}
                >
                  <div className="flex flex-col">
                    <span className="font-semibold">{order.id}</span>
                    <div className="flex justify-between items-center text-xs text-muted-foreground mt-1">
                      <span>
                        Deadline: {latestEndDate ? format(latestEndDate, 'MMM dd') : 'N/A'}
                      </span>
                      {selectedProcessId === SEWING_PROCESS_ID && (
                        <span>{numLines} {numLines > 1 ? 'Lines' : 'Line'}</span>
                      )}
                      <span>{durationDays} days</span>
                    </div>
                  </div>
                </div>
              );
            })}
            {filteredUnplannedOrders.length === 0 && (
              <div className="flex h-full items-center justify-center text-center">
                <p className="text-sm text-muted-foreground">
                  {hasActiveFilters
                    ? 'No orders match your filters.'
                    : selectedProcessId === SEWING_PROCESS_ID
                    ? `All ${PROCESSES.find(p=>p.id === selectedProcessId)?.name} processes are scheduled.`
                    : `Schedule sewing for orders to see them here.`}
                </p>
              </div>
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
