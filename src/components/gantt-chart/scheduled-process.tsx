
import { ORDERS, PROCESSES } from '@/lib/data';
import type { ScheduledProcess } from '@/lib/types';
import { cn } from '@/lib/utils';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Undo2 } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { format } from 'date-fns';
import { useEffect, useRef, useState } from 'react';

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
  const ref = useRef<HTMLDivElement>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const processDetails = PROCESSES.find(p => p.id === item.processId);
  const orderDetails = ORDERS.find(o => o.id === item.orderId);

  useEffect(() => {
    if (isBeingDragged) {
      const timeoutId = setTimeout(() => {
        if (ref.current) {
          ref.current.style.opacity = '0';
          ref.current.style.pointerEvents = 'none';
        }
      }, 0);

      return () => {
        clearTimeout(timeoutId);
        if (ref.current) {
          ref.current.style.opacity = '';
          ref.current.style.pointerEvents = '';
        }
      };
    } else {
        if (ref.current) {
            ref.current.style.opacity = '';
            ref.current.style.pointerEvents = '';
        }
    }
  }, [isBeingDragged]);


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

  const handleContextMenu = (e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsMenuOpen(true);
  };
  
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
        <strong>End:</strong> {format(item.endDateTime, 'MMM d, yyyy @ h:mm a')}
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
      ref={ref}
      draggable={!isOrderLevelView}
      onDragStart={(e) => onDragStart(e, item)}
      onDragEnd={onDragEnd}
      onContextMenu={handleContextMenu}
      data-scheduled-process-id={item.id}
      className={cn(
        "relative z-10 flex items-center overflow-hidden rounded-md m-px h-[calc(100%-0.125rem)] text-white shadow-lg transition-opacity duration-150",
        !isOrderLevelView && "cursor-grab active:cursor-grabbing"
      )}
      style={{
        gridRowStart: gridRow,
        gridColumn: `${gridColStart} / span ${durationInColumns}`,
        backgroundColor: backgroundColor,
      }}
      title={`${orderDetails.id}: ${processDetails.name} (${durationText})`}
    >
      <Popover>
        <PopoverTrigger asChild>
          {barContent}
        </PopoverTrigger>
        <PopoverContent className="w-80">
          {popoverContent}
        </PopoverContent>
      </Popover>
    </div>
  );

  return (
    <DropdownMenu open={isMenuOpen} onOpenChange={setIsMenuOpen}>
      <DropdownMenuTrigger asChild>
        {bar}
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        {!isOrderLevelView && (
          <DropdownMenuItem onClick={handleUndo}>
            <Undo2 className="mr-2 h-4 w-4" />
            <span>Return to Unplanned</span>
          </DropdownMenuItem>
        )}
         <DropdownMenuItem disabled>
            No actions available
          </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
