
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
import type { Order, ProjectionDetail } from '@/lib/types';
import { format } from 'date-fns';
import { useMemo } from 'react';

type ProjectionDetailsDialogProps = {
  order: Order;
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
};

export default function ProjectionDetailsDialog({
  order,
  isOpen,
  onOpenChange,
}: ProjectionDetailsDialogProps) {

  const totals = useMemo(() => {
    if (!order.projectionDetails) {
      return { projectionQty: 0, poQty: 0, grnQty: 0 };
    }
    return order.projectionDetails.reduce(
      (acc, detail) => {
        acc.projectionQty += detail.projectionQty;
        acc.poQty += detail.poQty;
        acc.grnQty += detail.grnQty;
        return acc;
      },
      { projectionQty: 0, poQty: 0, grnQty: 0 }
    );
  }, [order.projectionDetails]);


  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Projection Details for {order.id}</DialogTitle>
          <DialogDescription>
            Detailed breakdown of all projections for this forecast.
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-[70vh] overflow-y-auto">
          <Table>
            <TableHeader className="sticky top-0 bg-background">
              <TableRow>
                <TableHead>Projection Number</TableHead>
                <TableHead>Projection Date</TableHead>
                <TableHead className="text-right">Projection Qty</TableHead>
                <TableHead className="text-right">PO Qty</TableHead>
                <TableHead className="text-right">GRN Qty</TableHead>
                <TableHead>Receipt Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(order.projectionDetails || []).map((detail) => (
                <TableRow key={detail.projectionNumber}>
                  <TableCell className="font-medium whitespace-nowrap">{detail.projectionNumber}</TableCell>
                  <TableCell>{format(detail.projectionDate, 'dd/MM/yy')}</TableCell>
                  <TableCell className="text-right">{detail.projectionQty.toLocaleString()}</TableCell>
                  <TableCell className="text-right">{detail.poQty.toLocaleString()}</TableCell>
                  <TableCell className="text-right">{detail.grnQty.toLocaleString()}</TableCell>
                  <TableCell>{format(detail.receiptDate, 'dd/MM/yy')}</TableCell>
                </TableRow>
              ))}
            </TableBody>
             <TableFooter className="sticky bottom-0 bg-background">
              <TableRow>
                <TableCell colSpan={2} className="font-bold">Total</TableCell>
                <TableCell className="text-right font-bold">
                  {totals.projectionQty.toLocaleString()}
                </TableCell>
                <TableCell className="text-right font-bold">
                  {totals.poQty.toLocaleString()}
                </TableCell>
                 <TableCell className="text-right font-bold">
                  {totals.grnQty.toLocaleString()}
                </TableCell>
                <TableCell></TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </div>
      </DialogContent>
    </Dialog>
  );
}
