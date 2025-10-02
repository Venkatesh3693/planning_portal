import { PROCESSES } from '@/lib/data';
import type { ScheduledProcess } from '@/lib/types';
import { cn } from '@/lib/utils';

type ScheduledProcessProps = {
  item: ScheduledProcess;
  gridRow: number;
  gridColStart: number;
};

export default function ScheduledProcessBar({ item, gridRow, gridColStart }: ScheduledProcessProps) {
  const processDetails = PROCESSES.find(p => p.id === item.processId);
  if (!processDetails) return null;

  const Icon = processDetails.icon;
  const durationText = `${processDetails.name} (${item.durationDays} day${item.durationDays > 1 ? 's' : ''})`;

  return (
    <div
      className={cn(
        "z-10 flex items-center overflow-hidden rounded-md m-1 h-[calc(100%-0.5rem)] text-accent-foreground shadow-lg transition-all duration-300 ease-in-out",
        "bg-accent hover:bg-primary/90"
      )}
      style={{
        gridRowStart: gridRow,
        gridColumn: `${gridColStart} / span ${item.durationDays}`,
      }}
      title={durationText}
    >
      <div className="flex items-center gap-2 px-3">
        <Icon className="h-4 w-4 shrink-0" />
        <span className="truncate text-sm font-medium">{processDetails.name}</span>
      </div>
    </div>
  );
}
