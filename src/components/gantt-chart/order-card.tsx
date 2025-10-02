import type { Order, Process } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import ProcessPill from './process-card';

type OrderCardProps = {
  order: Order;
  processes: Process[];
  onDragStart: (e: React.DragEvent<HTMLDivElement>, orderId: string, processId: string) => void;
};

export default function OrderCard({ order, processes, onDragStart }: OrderCardProps) {
  return (
    <Card className="transition-all duration-200">
      <CardHeader className="p-4 pb-2">
        <CardTitle className="text-base">{order.id}</CardTitle>
        <CardDescription>{order.buyer} &bull; Qty: {order.quantity}</CardDescription>
      </CardHeader>
      <CardContent className="p-4 pt-2">
        <div className="flex flex-wrap gap-2">
          {processes.map((process) => (
            <ProcessPill 
              key={process.id} 
              process={process} 
              orderId={order.id} 
              onDragStart={onDragStart} 
            />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
