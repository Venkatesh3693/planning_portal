
'use client';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableFooter
} from '@/components/ui/table';
import { SIZES } from '@/lib/data';
import type { Order, Size, PoDetail } from '@/lib/types';
import { format, getWeek } from 'date-fns';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';


const statusConfig = {
    production: {
        'not-started': { label: 'Not Started', color: 'bg-red-500' },
        'in-progress': { label: 'In Progress', color: 'bg-yellow-500' },
        'completed': { label: 'Completed', color: 'bg-green-500' },
    },
    inspection: {
        'not-started': { label: 'Not Started', color: 'bg-red-500' },
        'in-progress': { label: 'In Progress', color: 'bg-yellow-500' },
        'completed': { label: 'Completed', color: 'bg-green-500' },
    },
    shipping: {
        'not-shipped': { label: 'Not Shipped', color: 'bg-red-500' },
        'shipped-late': { label: 'Shipped Late', color: 'bg-yellow-500' },
        'shipped-on-time': { label: 'Shipped On Time', color: 'bg-green-500' },
    }
}

const StatusIndicator = ({ status, type }: { status: keyof typeof statusConfig.production | keyof typeof statusConfig.shipping; type: 'production' | 'inspection' | 'shipping' }) => {
    const config = statusConfig[type][status as 'not-started'];
    if (!config) return null;

    return (
        <TooltipProvider>
            <Tooltip>
                <TooltipTrigger>
                    <div className={cn("h-3 w-3 rounded-full mx-auto", config.color)} />
                </TooltipTrigger>
                <TooltipContent>
                    <p>{config.label}</p>
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
    )
}


type PoDetailsDialogProps = {
  order: Order;
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
};

export default function PoDetailsDialog({
  order,
  isOpen,
  onOpenChange,
}: PoDetailsDialogProps) {

  const totals = SIZES.reduce((acc, size) => {
    acc[size] = (order.poDetails || []).reduce((sum, po) => sum + (po.quantities[size] || 0), 0);
    return acc;
  }, {} as Record<Size, number>);

  const grandTotal = (order.poDetails || []).reduce((sum, po) => sum + po.quantities.total, 0);

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-screen-2xl">
        <DialogHeader>
          <DialogTitle>Confirmed Purchase Orders for {order.id}</DialogTitle>
          <DialogDescription>
            Detailed breakdown of all confirmed POs associated with this forecast.
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-[70vh] overflow-y-auto">
          <Table>
            <TableHeader className="sticky top-0 bg-background">
              <TableRow>
                <TableHead>PO Number</TableHead>
                <TableHead>EHD</TableHead>
                <TableHead>EHD Week</TableHead>
                <TableHead>CHD</TableHead>
                <TableHead>Destination</TableHead>
                {SIZES.map(size => (
                  <TableHead key={size} className="text-right">{size}</TableHead>
                ))}
                <TableHead className="text-right font-bold">Total</TableHead>
                <TableHead className="text-center">Produced</TableHead>
                <TableHead className="text-center">Inspection</TableHead>
                <TableHead className="text-center">Shipped</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(order.poDetails || []).map((po) => (
                <TableRow key={po.poNumber}>
                  <TableCell className="font-medium">{po.poNumber}</TableCell>
                  <TableCell>{format(po.ehd, 'dd/MM/yy')}</TableCell>
                  <TableCell>{getWeek(po.ehd, { weekStartsOn: 1 })}</TableCell>
                  <TableCell>{format(po.chd, 'dd/MM/yy')}</TableCell>
                  <TableCell>{po.destination}</TableCell>
                  {SIZES.map(size => (
                    <TableCell key={size} className="text-right">
                      {(po.quantities[size] || 0).toLocaleString()}
                    </TableCell>
                  ))}
                  <TableCell className="text-right font-bold">
                    {po.quantities.total.toLocaleString()}
                  </TableCell>
                   <TableCell className="text-center">
                    <StatusIndicator type="production" status={po.productionStatus} />
                  </TableCell>
                  <TableCell className="text-center">
                    <StatusIndicator type="inspection" status={po.inspectionStatus} />
                  </TableCell>
                  <TableCell className="text-center">
                    <StatusIndicator type="shipping" status={po.shippingStatus} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
            <TableFooter className="sticky bottom-0 bg-background">
              <TableRow>
                <TableCell colSpan={5} className="font-bold">Total</TableCell>
                 {SIZES.map(size => (
                    <TableCell key={`total-${size}`} className="text-right font-bold">
                      {(totals[size] || 0).toLocaleString()}
                    </TableCell>
                  ))}
                <TableCell className="text-right font-bold">
                  {grandTotal.toLocaleString()}
                </TableCell>
                <TableCell colSpan={3}></TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </div>
      </DialogContent>
    </Dialog>
  );
}
