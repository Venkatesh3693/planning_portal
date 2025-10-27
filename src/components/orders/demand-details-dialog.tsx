
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
  TableFooter,
} from '@/components/ui/table';
import type { Order } from '@/lib/types';
import { useMemo } from 'react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { LineChart } from 'lucide-react';


type DemandDetailsDialogProps = {
  order: Order;
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
};

const SelectionVsPoFc = ({ order }: { order: Order }) => {
  const totals = useMemo(() => {
    if (!order.demandDetails) {
      return { selectionQty: 0, po: 0, fc: 0, poPlusFc: 0 };
    }
    return order.demandDetails.reduce(
      (acc, detail) => {
        acc.selectionQty += detail.selectionQty;
        acc.po += detail.po;
        acc.fc += detail.fc;
        acc.poPlusFc += detail.poPlusFc;
        return acc;
      },
      { selectionQty: 0, po: 0, fc: 0, poPlusFc: 0 }
    );
  }, [order.demandDetails]);

  const totalRealisation =
    totals.selectionQty > 0
      ? (totals.poPlusFc / totals.selectionQty) * 100
      : 0;

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Destination</TableHead>
          <TableHead className="text-right">Selection Qty</TableHead>
          <TableHead className="text-right">PO</TableHead>
          <TableHead className="text-right">FC</TableHead>
          <TableHead className="text-right">PO+FC</TableHead>
          <TableHead className="text-right">Réalisation</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {(order.demandDetails || []).map((detail) => {
          const realisation =
            detail.selectionQty > 0
              ? (detail.poPlusFc / detail.selectionQty) * 100
              : 0;
          return (
            <TableRow key={detail.destination}>
              <TableCell className="font-medium">{detail.destination}</TableCell>
              <TableCell className="text-right">
                {detail.selectionQty.toLocaleString()}
              </TableCell>
              <TableCell className="text-right">{detail.po.toLocaleString()}</TableCell>
              <TableCell className="text-right">{detail.fc.toLocaleString()}</TableCell>
              <TableCell className="text-right font-bold">
                {detail.poPlusFc.toLocaleString()}
              </TableCell>
              <TableCell className="text-right">
                {realisation.toFixed(2)}%
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
      <TableFooter>
        <TableRow>
          <TableCell className="font-bold">Total</TableCell>
          <TableCell className="text-right font-bold">
            {totals.selectionQty.toLocaleString()}
          </TableCell>
          <TableCell className="text-right font-bold">
            {totals.po.toLocaleString()}
          </TableCell>
          <TableCell className="text-right font-bold">
            {totals.fc.toLocaleString()}
          </TableCell>
          <TableCell className="text-right font-bold">
            {totals.poPlusFc.toLocaleString()}
          </TableCell>
          <TableCell className="text-right font-bold">
            {totalRealisation.toFixed(2)}%
          </TableCell>
        </TableRow>
      </TableFooter>
    </Table>
  );
};

export default function DemandDetailsDialog({
  order,
  isOpen,
  onOpenChange,
}: DemandDetailsDialogProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Demand Details for {order.id}</DialogTitle>
          <DialogDescription>
            Comparison of Selection Quantity vs. PO+FC.
          </DialogDescription>
        </DialogHeader>
        <div className="pt-4 space-y-4">
            <SelectionVsPoFc order={order} />
        </div>
      </DialogContent>
    </Dialog>
  );
}
