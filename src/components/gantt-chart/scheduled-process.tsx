
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
  durationInColumns: number;
  onUndo: (scheduledProcessId: string) => void;
  isOrderLevelView?: boolean;
};

export default function ScheduledProcessBar({ item, gridRow, gridColStart, durationInColumns, onUndo, isOrderLevelView = false }: ScheduledProcessProps) {
  const processDetails = PROCESSES.find(p => p.id === item.processId);
  const orderDetails = ORDERS.find(o => o.id === item.orderId);
  if (!processDetails || !orderDetails) return null;

  const Icon = processDetails.icon;

  const durationDays = Math.floor(item.durationMinutes / (8 * 60));
  const remainingMinutes = item.durationMinutes % (8 * 60);
  const durationHours = Math.floor(remainingMinutes / 60);
  const finalMinutes = remainingMinutes % 60;
  let durationText = `${orderDetails.id}: ${processDetails.name} (`;
  if (durationDays > 0) durationText += `${durationDays}d `;
  if (durationHours > 0) durationText += `${durationHours}h `;
  if (finalMinutes > 0) durationText += `${finalMinutes}m`;
  durationText += ')';


  const handleUndo = () => {
    onUndo(item.id);
  }
  
  const backgroundColor = processDetails.color ? processDetails.color : 'hsl(var(--accent))';

  const bar = (
    <div
      className={cn(
        "z-10 flex items-center overflow-hidden rounded-md m-px h-[calc(100%-0.125rem)] text-white shadow-lg transition-all duration-200 ease-in-out",
        !isOrderLevelView && "cursor-context-menu hover:scale-[1.02] hover:brightness-95",
      )}
      style={{
        gridRowStart: gridRow,
        gridColumn: `${gridColStart} / span ${durationInColumns}`,
        backgroundColor: backgroundColor,
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
          gridColumn: `${gridColStart} / span ${durationInColumns}`,
          height: 'calc(100% - 0.125rem)',
          margin: '1px',
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
                Duration: {durationText.split('(')[1].slice(0, -1)}
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
