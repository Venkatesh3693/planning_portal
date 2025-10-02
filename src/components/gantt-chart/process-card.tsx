import type { Process } from '@/lib/types';

type ProcessPillProps = {
  process: Process;
  orderId: string;
  onDragStart: (e: React.DragEvent<HTMLDivElement>, orderId: string, processId: string) => void;
};

export default function ProcessPill({ process, orderId, onDragStart }: ProcessPillProps) {
  const Icon = process.icon;

  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, orderId, process.id)}
      className="cursor-grab active:cursor-grabbing transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 flex items-center gap-2 rounded-full bg-secondary px-3 py-1 text-secondary-foreground"
    >
      <Icon className="h-4 w-4" />
      <span className="text-xs font-medium">{process.name}</span>
    </div>
  );
}
