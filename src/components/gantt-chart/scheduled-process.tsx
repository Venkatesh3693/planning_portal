import { ORDERS, PROCESSES } from '@/lib/data';
import type { ScheduledProcess } from '@/lib/types';
import { cn } from '@/lib/utils';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Undo2 } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';

type ScheduledProcessProps = {
  item: ScheduledProcess;
  gridRow: number;
  gridColStart: number;
  onUndo: (scheduledProcessId: string) => void;
  isOrderLevelView?: boolean;
};

export default function ScheduledProcessBar({ item, gridRow, gridColStart, onUndo, isOrderLevelView = false }: ScheduledProcessProps) {
  const processDetails = PROCESSES.find(p => p.id === item.processId);
  const orderDetails = ORDERS.find(o => o.id === item.orderId);
  if (!processDetails || !orderDetails) return null;

  const Icon = processDetails.icon;
  const durationText = `${orderDetails.id}: ${processDetails.name} (${item.durationDays} day${item.durationDays > 1 ? 's' : ''})`;

  const handleUndo = () => {
    onUndo(item.id);
  }

  const bar = (
    <div
      className={cn(
        "z-10 flex items-center overflow-hidden rounded-md m-1 h-[calc(100%-0.5rem)] text-accent-foreground shadow-lg transition-all duration-300 ease-in-out",
        "bg-accent hover:bg-primary/90",
        !isOrderLevelView && "cursor-context-menu",
      )}
      style={{
        gridRowStart: gridRow,
        gridColumn: `${gridColStart} / span ${item.durationDays}`,
      }}
      title={durationText}
    >
      <div className="flex items-center gap-2 px-3">
        <Icon className="h-4 w-4 shrink-0" />
        <span className="truncate text-sm font-medium">{isOrderLevelView ? processDetails.name : orderDetails.id}</span>
      </div>
    </div>
  );

  if (isOrderLevelView) {
    return (
      <Popover>
        <PopoverTrigger asChild style={{
          gridRowStart: gridRow,
          gridColumn: `${gridColStart} / span ${item.durationDays}`,
        }}>
          {bar}
        </PopoverTrigger>
        <PopoverContent className="w-80">
          <div className="grid gap-4">
            <div className="space-y-2">
              <h4 className="font-medium leading-none">{orderDetails.id}</h4>
              <p className="text-sm text-muted-foreground">
                {processDetails.name}
              </p>
            </div>
             <p className="text-sm">
                Duration: {item.durationDays} day{item.durationDays > 1 ? 's' : ''}
              </p>
          </div>
        </PopoverContent>
      </Popover>
    )
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {bar}
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuItem onClick={handleUndo}>
          <Undo2 className="mr-2 h-4 w-4" />
          <span>Return to Unplanned</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
