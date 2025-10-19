
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
import type { Order, Size } from '@/lib/types';
import { format, getWeek } from 'date-fns';

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
      <DialogContent className="max-w-7xl">
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
              </TableRow>
            </TableHeader>
            <TableBody>
              {(order.poDetails || []).map((po) => (
                <TableRow key={po.poNumber}>
                  <TableCell className="font-medium">{po.poNumber}</TableCell>
                  <TableCell>{format(po.ehd, 'MMM dd, yyyy')}</TableCell>
                  <TableCell>{getWeek(po.ehd, { weekStartsOn: 1 })}</TableCell>
                  <TableCell>{format(po.chd, 'MMM dd, yyyy')}</TableCell>
                  <TableCell>{po.destination}</TableCell>
                  {SIZES.map(size => (
                    <TableCell key={size} className="text-right">
                      {(po.quantities[size] || 0).toLocaleString()}
                    </TableCell>
                  ))}
                  <TableCell className="text-right font-bold">
                    {po.quantities.total.toLocaleString()}
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
              </TableRow>
            </TableFooter>
          </Table>
        </div>
      </DialogContent>
    </Dialog>
  );
}
