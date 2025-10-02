import type { Process } from '@/lib/types';
import { Card, CardContent } from '@/components/ui/card';
import { Clock, Package } from 'lucide-react';
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
      className="cursor-grab active:cursor-grabbing transition-all duration-200 hover:shadow-md hover:-translate-y-1"
    >
      <CardContent className="p-4">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
            <Icon className="h-6 w-6 text-primary" />
          </div>
          <div className="flex-1">
            <p className="font-semibold text-foreground">{process.name}</p>
            <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
              <div className="flex items-center gap-1.5" title="Standard Allowed Minutes">
                <Clock className="h-3.5 w-3.5" />
                <span>{process.sam} SAM</span>
              </div>
              <div className="flex items-center gap-1.5" title="Order Quantity">
                <Package className="h-3.5 w-3.5" />
                <span>Qty: {process.orderQuantity}</span>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
