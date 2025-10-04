
import { ORDERS, PROCESSES } from '@/lib/data';
import type { ScheduledProcess } from '@/lib/types';
import { cn } from '@/lib/utils';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Undo2 } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { format } from 'date-fns';

type ScheduledProcessProps = {
  item: ScheduledProcess;
  gridRow: number;
  gridColStart: number;
  durationInColumns: number;
  onUndo: (scheduledProcessId: string) => void;
  onDragStart: (e: React.DragEvent<HTMLDivElement>, process: ScheduledProcess) => void;
  onDragEnd: () => void;
  isOrderLevelView?: boolean;
  isBeingDragged?: boolean;
};

export default function ScheduledProcessBar({ 
  item, 
  gridRow, 
  gridColStart, 
  durationInColumns, 
  onUndo,
  onDragStart,
  onDragEnd,
  isOrderLevelView = false,
  isBeingDragged = false,
}: ScheduledProcessProps) {
  const processDetails = PROCESSES.find(p => p.id === item.processId);
  const orderDetails = ORDERS.find(o => o.id === item.orderId);
  if (!processDetails || !orderDetails) return null;

  const Icon = processDetails.icon;

  const durationDays = Math.floor(item.durationMinutes / (8 * 60));
  const remainingMinutes = item.durationMinutes % (8 * 60);
  const durationHours = Math.floor(remainingMinutes / 60);
  const finalMinutes = remainingMinutes % 60;
  
  let durationText = '';
  if (durationDays > 0) durationText += `${durationDays}d `;
  if (durationHours > 0) durationText += `${durationHours}h `;
  if (finalMinutes > 0) durationText += `${finalMinutes}m`;
  durationText = durationText.trim();


  const handleUndo = () => {
    onUndo(item.id);
  }
  
  const backgroundColor = processDetails.color ? processDetails.color : 'hsl(var(--accent))';

  const barContent = (
    <div className="flex items-center gap-2 px-2">
      <Icon className="h-3 w-3 shrink-0" />
      <span className="truncate text-xs font-medium">{isOrderLevelView ? processDetails.name : orderDetails.id}</span>
    </div>
  );

  const popoverContent = (
    <div className="grid gap-4">
      <div className="space-y-2">
        <h4 className="font-medium leading-none">{orderDetails.ocn} - {orderDetails.style}</h4>
        <p className="text-sm text-muted-foreground">
          {processDetails.name}
        </p>
      </div>
      <p className="text-sm">
        <strong>Start:</strong> {format(item.startDateTime, 'MMM d, yyyy @ h:mm a')}
      </p>
      <p className="text-sm">
        <strong>Duration:</strong> {durationText}
      </p>
      <p className="text-sm">
        <strong>Order ID:</strong> {orderDetails.id}
      </p>
    </div>
  );

  const bar = (
     <div
      data-scheduled-process-id={item.id}
      className={cn(
        "relative z-10 flex items-center overflow-hidden rounded-md m-px h-[calc(100%-0.125rem)] text-white shadow-lg transition-opacity duration-200 ease-in-out",
        isBeingDragged && "opacity-50"
      )}
      style={{
        gridRowStart: gridRow,
        gridColumn: `${gridColStart} / span ${durationInColumns}`,
        backgroundColor: backgroundColor,
      }}
      title={`${orderDetails.id}: ${processDetails.name} (${durationText})`}
    >
       <div
          draggable={!isOrderLevelView}
          onDragStart={(e) => onDragStart(e, item)}
          onDragEnd={onDragEnd}
          className={cn(
            "absolute inset-0",
            !isOrderLevelView && "cursor-grab active:cursor-grabbing"
          )}
        />
      {barContent}
    </div>
  );

  if (isOrderLevelView) {
    return (
      <Popover>
        <PopoverTrigger asChild style={{
          gridRowStart: gridRow,
          gridColumn: `${gridColStart} / span ${durationInColumns}`,
          height: 'calc(100% - 0.125rem)',
          margin: '1px',
          cursor: 'pointer'
        }}>
          {bar}
        </PopoverTrigger>
        <PopoverContent className="w-80">
          {popoverContent}
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
        <div className="p-4 pt-2">
          {popoverContent}
        </div>
        <DropdownMenuItem onClick={handleUndo}>
          <Undo2 className="mr-2 h-4 w-4" />
          <span>Return to Unplanned</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
