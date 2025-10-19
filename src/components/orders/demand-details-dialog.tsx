
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { Order, Size } from '@/lib/types';
import { useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { SIZES } from '@/lib/data';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from '../ui/label';

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

const FcVsFc = ({ order }: { order: Order }) => {
  const [selectedSize, setSelectedSize] = useState<Size | 'total'>('total');

  const { forecastWeeks, snapshots, snapshotTotals } = useMemo(() => {
    if (!order.fcVsFcDetails || order.fcVsFcDetails.length === 0) {
      return { forecastWeeks: [], snapshots: [], snapshotTotals: {} };
    }

    const weekSet = new Set<string>();
    order.fcVsFcDetails.forEach(snapshot => {
      Object.keys(snapshot.forecasts).forEach(week => weekSet.add(week));
    });
    
    const forecastWeeks = Array.from(weekSet).sort((a, b) => {
      return parseInt(a.substring(1)) - parseInt(b.substring(1));
    });
    
    const snapshots = order.fcVsFcDetails.sort((a, b) => a.snapshotWeek - b.snapshotWeek);

    const totals: Record<number, Record<Size | 'total', number>> = {};
    snapshots.forEach(snapshot => {
      totals[snapshot.snapshotWeek] = { total: 0 };
      forecastWeeks.forEach(week => {
         const weekForecast = snapshot.forecasts[week];
         if (weekForecast) {
            totals[snapshot.snapshotWeek].total += weekForecast.total;
            SIZES.forEach(size => {
              if(!totals[snapshot.snapshotWeek][size]) totals[snapshot.snapshotWeek][size] = 0;
              totals[snapshot.snapshotWeek][size] += weekForecast[size] || 0;
            })
         }
      })
    });

    return { forecastWeeks, snapshots, snapshotTotals: totals };
  }, [order.fcVsFcDetails]);

  if (snapshots.length === 0) {
    return <div className="text-center text-muted-foreground p-8">No Forecast vs. Forecast data available.</div>;
  }

  return (
    <div className="space-y-4">
       <div className="flex items-center gap-4">
        <Label htmlFor="size-filter" className="text-sm">View by Size:</Label>
        <Select value={selectedSize} onValueChange={(value) => setSelectedSize(value as Size | 'total')}>
          <SelectTrigger className="w-[180px]" id="size-filter">
            <SelectValue placeholder="Select a size" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="total">ALL</SelectItem>
            {SIZES.map(size => (
              <SelectItem key={size} value={size}>{size}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="max-h-[60vh] overflow-auto border rounded-lg">
        <Table>
          <TableHeader className="sticky top-0 bg-background z-10">
            <TableRow>
              <TableHead className="sticky left-0 bg-background z-20 min-w-[120px]">Snapshot Week</TableHead>
              {forecastWeeks.map(week => (
                <TableHead key={week} className="text-right min-w-[150px]">{week}</TableHead>
              ))}
              <TableHead className="text-right min-w-[150px] font-bold">Total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {snapshots.map((snapshot, rowIndex) => {
              const snapshotTotal = snapshotTotals[snapshot.snapshotWeek]?.[selectedSize] || 0;
              const prevSnapshotWeek = rowIndex > 0 ? snapshots[rowIndex - 1].snapshotWeek : undefined;
              const prevSnapshotTotal = prevSnapshotWeek ? snapshotTotals[prevSnapshotWeek]?.[selectedSize] : undefined;
              
              let totalChangeIndicator: React.ReactNode = null;
              if (prevSnapshotTotal !== undefined && snapshotTotal !== undefined && prevSnapshotTotal > 0 && snapshotTotal !== prevSnapshotTotal) {
                const change = ((snapshotTotal - prevSnapshotTotal) / prevSnapshotTotal) * 100;
                totalChangeIndicator = (
                  <Badge variant={change > 0 ? 'destructive' : 'secondary'} className="ml-2 text-xs tabular-nums">
                    {change > 0 ? '+' : ''}{change.toFixed(1)}%
                  </Badge>
                );
              }

              return (
                <TableRow key={snapshot.snapshotWeek}>
                  <TableCell className="font-medium sticky left-0 bg-background z-10">
                    W{snapshot.snapshotWeek}
                  </TableCell>
                  {forecastWeeks.map(week => {
                    const value = snapshot.forecasts[week]?.[selectedSize];
                    const prevValue = rowIndex > 0 ? snapshots[rowIndex - 1].forecasts[week]?.[selectedSize] : undefined;
                    
                    let changeIndicator: React.ReactNode = null;
                    if (prevValue !== undefined && value !== undefined && prevValue > 0 && value !== prevValue) {
                      const change = ((value - prevValue) / prevValue) * 100;
                      changeIndicator = (
                        <Badge variant={change > 0 ? 'destructive' : 'secondary'} className="ml-2 text-xs tabular-nums">
                          {change > 0 ? '+' : ''}{change.toFixed(1)}%
                        </Badge>
                      );
                    }

                    return (
                      <TableCell key={`${snapshot.snapshotWeek}-${week}`} className="text-right tabular-nums">
                        {value !== undefined ? (
                          <div className="flex items-center justify-end">
                            {value.toLocaleString()}
                            {changeIndicator}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                    );
                  })}
                  <TableCell className="text-right font-bold tabular-nums">
                    {snapshotTotal > 0 ? (
                       <div className="flex items-center justify-end">
                          {snapshotTotal.toLocaleString()}
                          {totalChangeIndicator}
                        </div>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};


export default function DemandDetailsDialog({
  order,
  isOpen,
  onOpenChange,
}: DemandDetailsDialogProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-7xl">
        <DialogHeader>
          <DialogTitle>Demand Details for {order.id}</DialogTitle>
          <DialogDescription>
            Comparison of various demand signals for this forecast.
          </DialogDescription>
        </DialogHeader>
        <Tabs defaultValue="selection-vs-po-fc">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="selection-vs-po-fc">Selection vs. PO+FC</TabsTrigger>
            <TabsTrigger value="fc-vs-fc">FC vs. FC</TabsTrigger>
            <TabsTrigger value="fc-vs-po" disabled>FC vs. PO</TabsTrigger>
          </TabsList>
          <TabsContent value="selection-vs-po-fc" className="pt-4">
             <SelectionVsPoFc order={order} />
          </TabsContent>
          <TabsContent value="fc-vs-fc" className="pt-4">
             <FcVsFc order={order} />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
