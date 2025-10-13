

'use client';

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { Order, UnplannedBatch } from '@/lib/types';
import { format } from 'date-fns';
import type { DraggedItemData } from '@/app/page';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Filter, FilterX, ChevronDown, ArrowUp, ArrowDown, UnfoldVertical, FoldVertical } from 'lucide-react';
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
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

const SEWING_PROCESS_ID = 'sewing';
const PACKING_PROCESS_ID = 'packing';

type MachinePanelProps = {
  selectedProcessId: string;
  unplannedOrders: Order[];
  unplannedBatches: UnplannedBatch[];
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
  splitOrderProcesses: Record<string, boolean>;
  toggleSplitProcess: (orderId: string, processId: string) => void;
  latestSewingStartDateMap: Map<string, Date>;
  latestStartDatesMap: Map<string, Date>;
};

export default function MachinePanel({
  selectedProcessId,
  unplannedOrders,
  unplannedBatches,
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
  splitOrderProcesses,
  toggleSplitProcess,
  latestSewingStartDateMap,
  latestStartDatesMap,
}: MachinePanelProps) {

  const handleSortToggle = () => {
    if (dueDateSort === null) {
      setDueDateSort('asc');
    } else if (dueDateSort === 'asc') {
      setDueDateSort('desc');
    } else {
      setDueDateSort(null);
    }
  };
  
  const sortTooltip = dueDateSort === null 
    ? "Sort Ascending" 
    : dueDateSort === 'asc' 
    ? "Sort Descending" 
    : "Clear Sort";

  const isPreSewingProcess = PROCESSES.find(p => p.id === selectedProcessId)?.id !== SEWING_PROCESS_ID;

  const handleUnplannedDragStart = (e: React.DragEvent<HTMLDivElement>, batch: UnplannedBatch) => {
    const dateMapKey = `${batch.orderId}-${batch.processId}-${batch.batchNumber}`;
    const liveLatestStartDate = latestStartDatesMap.get(dateMapKey);

    const item: DraggedItemData = { 
      type: 'new-batch', 
      batch: {
        ...batch,
        latestStartDate: liveLatestStartDate || batch.latestStartDate, // Fallback to stale date if lookup fails
      }
    };
    handleDragStart(e, item);
  };


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
                    <div className="flex gap-2 items-center">
                        <DatePicker date={filterDueDate} setDate={setFilterDueDate} className="flex-1"/>
                         <TooltipProvider>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button variant="outline" size="icon" onClick={handleSortToggle} className="w-10 h-10">
                                        {dueDateSort === 'asc' && <ArrowUp className="h-4 w-4" />}
                                        {dueDateSort === 'desc' && <ArrowDown className="h-4 w-4" />}
                                        {dueDateSort === null && <ArrowDown className="h-4 w-4 opacity-40" />}
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                    <p>{sortTooltip}</p>
                                </TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                    </div>
                  </div>

                  {hasActiveFilters && (
                    <>
                      <Separator className="mt-2"/>
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
            {unplannedBatches.map((batch) => {
               const dateMapKey = `${batch.orderId}-${batch.processId}-${batch.batchNumber}`;
               const liveLatestStartDate = latestStartDatesMap.get(dateMapKey) || batch.latestStartDate;

               return (
                  <div
                    key={`${batch.orderId}-${batch.processId}-${batch.batchNumber}`}
                    draggable
                    onDragStart={(e) => handleUnplannedDragStart(e, batch)}
                    className="cursor-grab active:cursor-grabbing p-2 text-sm font-medium text-card-foreground rounded-md hover:bg-primary/10 border-l-4 border-primary/50"
                    title={`${batch.orderId} - Batch ${batch.batchNumber}`}
                  >
                    <div className="flex flex-col">
                      <div className="flex justify-between items-center">
                        <span className="font-semibold">{batch.orderId}</span>
                         <Button 
                           variant="ghost" 
                           size="icon" 
                           className="h-6 w-6"
                           onClick={() => toggleSplitProcess(batch.orderId, batch.processId)}
                          >
                           <FoldVertical className="h-4 w-4 text-muted-foreground" />
                         </Button>
                      </div>
                      <div className="flex justify-between items-center text-xs text-muted-foreground mt-1">
                        <span>Batch {batch.batchNumber}/{batch.totalBatches} ({batch.quantity} units)</span>
                        <span>
                          Latest Start: {format(liveLatestStartDate, 'MMM dd')}
                        </span>
                      </div>
                    </div>
                  </div>
               )
            })}
            {unplannedOrders.map((order) => {
              const process = PROCESSES.find(p => p.id === selectedProcessId)!;
              const durationMinutes = process.sam * order.quantity;
              const durationDays = (durationMinutes / (8 * 60)).toFixed(1);
              const numLines = sewingLines[order.id] || 1;

              const isSplit = splitOrderProcesses[`${order.id}_${selectedProcessId}`];
              
              const showSplitButton = (isPreSewingProcess && sewingScheduledOrderIds.has(order.id)) ||
                                    (selectedProcessId === PACKING_PROCESS_ID && sewingScheduledOrderIds.has(order.id));
               
              const item: DraggedItemData = {
                type: 'new-order',
                orderId: order.id,
                processId: selectedProcessId,
                quantity: order.quantity,
                tna: null,
              };

              const latestSewingStart = latestSewingStartDateMap.get(order.id);

              return (
                <div
                  key={order.id}
                  draggable={!isSplit}
                  onDragStart={(e) => handleDragStart(e, item)}
                  className={cn(
                    "p-2 text-sm font-medium text-card-foreground rounded-md",
                    !isSplit && "cursor-grab active:cursor-grabbing hover:bg-primary/10",
                    isSplit && "bg-muted"
                  )}
                  title={order.id}
                >
                  <div className="flex flex-col">
                     <div className="flex justify-between items-center">
                        <span className="font-semibold">{order.id}</span>
                        {showSplitButton && (
                           <TooltipProvider>
                              <Tooltip>
                                 <TooltipTrigger asChild>
                                    <Button 
                                      variant="ghost" 
                                      size="icon" 
                                      className="h-6 w-6"
                                      onClick={() => toggleSplitProcess(order.id, selectedProcessId)}
                                    >
                                       {isSplit 
                                          ? <FoldVertical className="h-4 w-4" /> 
                                          : <UnfoldVertical className="h-4 w-4" />
                                       }
                                    </Button>
                                 </TooltipTrigger>
                                 <TooltipContent>
                                    <p>{isSplit ? 'Merge Batches' : 'Split into Batches'}</p>
                                 </TooltipContent>
                              </Tooltip>
                           </TooltipProvider>
                        )}
                     </div>
                    <div className="flex justify-between items-center text-xs text-muted-foreground mt-1">
                      <span>
                        {selectedProcessId === SEWING_PROCESS_ID && latestSewingStart 
                          ? `Latest Start: ${format(latestSewingStart, 'MMM dd')}`
                          : `Due: ${format(order.dueDate, 'MMM dd')}`
                        }
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
            {unplannedOrders.length === 0 && unplannedBatches.length === 0 && (
              <div className="flex h-full items-center justify-center text-center">
                <p className="text-sm text-muted-foreground">
                  {hasActiveFilters
                    ? 'No orders match your filters.'
                    : `All ${PROCESSES.find(p=>p.id === selectedProcessId)?.name} processes are scheduled.`}
                </p>
              </div>
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
