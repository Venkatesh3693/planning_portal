import type { Process } from '@/lib/types';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

type ProcessCardProps = {
  process: Process;
  onDragStart: (e: React.DragEvent<HTMLDivElement>, processId: string) => void;
};

export default function ProcessCard({ process, onDragStart }: ProcessCardProps) {
  const Icon = process.icon;

  return (
    <Card
      draggable
      onDragStart={(e) => onDragStart(e, process.id)}
      className="cursor-grab active:cursor-grabbing transition-all duration-200 hover:shadow-md hover:-translate-y-0.5"
    >
      <CardContent className="p-3">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10">
            <Icon className="h-4 w-4 text-primary" />
          </div>
          <p className="flex-1 font-medium text-sm text-foreground truncate">
            {process.name}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
