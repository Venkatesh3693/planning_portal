
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
  
  const backgroundColor = processDetails.color ? processDetails.color : 'hsl(var(--accent))';
  const hoverBackgroundColor = processDetails.color ? `${processDetails.color.slice(0, -1)}, 0.9)` : 'hsl(var(--primary)/0.9)';

  const bar = (
    <div
      className={cn(
        "z-10 flex items-center overflow-hidden rounded-md m-0.5 h-[calc(100%-0.25rem)] text-white shadow-lg transition-all duration-300 ease-in-out",
        !isOrderLevelView && "cursor-context-menu",
      )}
      style={{
        gridRowStart: gridRow,
        gridColumn: `${gridColStart} / span ${item.durationDays}`,
        backgroundColor: backgroundColor,
      }}
      onMouseEnter={(e) => {
        if (isOrderLevelView || !processDetails.color) return;
        (e.currentTarget as HTMLDivElement).style.backgroundColor = hoverBackgroundColor;
      }}
      onMouseLeave={(e) => {
        if (isOrderLevelView || !processDetails.color) return;
        (e.currentTarget as HTMLDivElement).style.backgroundColor = backgroundColor;
      }}
      title={durationText}
    >
      <div className="flex items-center gap-2 px-2">
        <Icon className="h-3 w-3 shrink-0" />
        <span className="truncate text-xs font-medium">{isOrderLevelView ? processDetails.name : orderDetails.id}</span>
      </div>
    </div>
  );

  if (isOrderLevelView) {
    return (
      <Popover>
        <PopoverTrigger asChild style={{
          gridRowStart: gridRow,
          gridColumn: `${gridColStart} / span ${item.durationDays}`,
          height: 'calc(100% - 0.25rem)',
          margin: '0.125rem',
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
