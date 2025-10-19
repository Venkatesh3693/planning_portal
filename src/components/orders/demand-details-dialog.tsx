
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
import type { Order, Size, FcComposition } from '@/lib/types';
import { useMemo, useState, useEffect } from 'react';
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
import { Button } from '../ui/button';
import { Percent } from 'lucide-react';
import { getWeek } from 'date-fns';
import { cn } from '@/lib/utils';

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

const DemandTrendAnalysis = ({ order }: { order: Order }) => {
  const [selectedSize, setSelectedSize] = useState<Size | 'total'>('total');
  const [viewMode, setViewMode] = useState<'absolute' | 'percentage'>('absolute');
  const [currentWeek, setCurrentWeek] = useState(0);

  useEffect(() => {
    setCurrentWeek(getWeek(new Date()));
  }, []);

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

    const totals: Record<number, FcComposition> = {};
    snapshots.forEach(snapshot => {
        let totalPo = 0;
        let totalFc = 0;

        forecastWeeks.forEach(week => {
            const weekForecast = snapshot.forecasts[week]?.[selectedSize];
            if (weekForecast) {
                totalPo += weekForecast.po || 0;
                totalFc += weekForecast.fc || 0;
            }
        });
        totals[snapshot.snapshotWeek] = { po: totalPo, fc: totalFc };
    });

    return { forecastWeeks, snapshots, snapshotTotals: totals };
  }, [order.fcVsFcDetails, selectedSize]);

  if (snapshots.length === 0) {
    return <div className="text-center text-muted-foreground p-8">No Demand Trend Analysis data available.</div>;
  }
  
  const renderCellContent = (
    currentData: FcComposition | undefined, 
    previousData: FcComposition | undefined,
  ) => {
    const currentValue = currentData ? (currentData.po || 0) + (currentData.fc || 0) : undefined;
    const previousValue = previousData ? (previousData.po || 0) + (previousData.fc || 0) : undefined;
    
    const isFirstRow = previousData === undefined;
    if (viewMode === 'percentage' && isFirstRow) {
      return <Badge variant="outline">Baseline</Badge>;
    }

    if (viewMode === 'absolute' || isFirstRow) {
      return currentValue !== undefined ? currentValue.toLocaleString() : <span className="text-muted-foreground">-</span>;
    }
    
    if (previousValue !== undefined && currentValue !== undefined && previousValue > 0) {
      const change = ((currentValue - previousValue) / previousValue) * 100;
      return (
        <Badge variant={change > 0 ? 'destructive' : 'secondary'} className="text-xs tabular-nums">
          {change > 0 ? '+' : ''}{change.toFixed(1)}%
        </Badge>
      );
    }
    
    return currentValue !== undefined && currentValue > 0 ? "0.0%" : <span className="text-muted-foreground">-</span>;
  };

  const getCellBgClass = (demandWeek: string, snapshotWeek: number, data: FcComposition | undefined) => {
    const demandWeekNum = parseInt(demandWeek.substring(1));
    const isFirmRule = demandWeekNum <= snapshotWeek + 3;

    if (isFirmRule) {
        return 'bg-green-100 dark:bg-green-900/40';
    }
    if (!data || ((data.po || 0) + (data.fc || 0)) === 0) {
      return '';
    }
    if (data.fc === 0 && data.po > 0) {
      return 'bg-green-100 dark:bg-green-900/40'; // 100% PO
    }
    if (data.po > 0 && data.fc > 0) {
      return 'bg-yellow-100 dark:bg-yellow-900/40'; // Mix
    }
    return 'bg-blue-100 dark:bg-blue-900/40'; // 100% FC
  };

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
        <Button 
            variant={viewMode === 'percentage' ? 'secondary' : 'outline'} 
            size="icon" 
            onClick={() => setViewMode(prev => prev === 'absolute' ? 'percentage' : 'absolute')}
            title={viewMode === 'absolute' ? 'Show Percentage Change' : 'Show Absolute Numbers'}
        >
            <Percent className="h-4 w-4" />
        </Button>
        {currentWeek > 0 && <Badge variant="outline" className="text-sm">Current Week: W{currentWeek}</Badge>}
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
              const prevSnapshot = rowIndex > 0 ? snapshots[rowIndex - 1] : undefined;
              
              const currentDataForTotal = snapshotTotals[snapshot.snapshotWeek];
              const prevDataForTotal = prevSnapshot ? snapshotTotals[prevSnapshot.snapshotWeek] : undefined;

              return (
                <TableRow key={snapshot.snapshotWeek}>
                  <TableCell className="font-medium sticky left-0 bg-background z-10">
                    W{snapshot.snapshotWeek}
                  </TableCell>
                  {forecastWeeks.map(week => {
                    const currentWeekData = snapshot.forecasts[week]?.[selectedSize];
                    const previousWeekData = prevSnapshot?.forecasts[week]?.[selectedSize];
                    
                    return (
                      <TableCell 
                        key={`${snapshot.snapshotWeek}-${week}`} 
                        className={cn("text-right tabular-nums", getCellBgClass(week, snapshot.snapshotWeek, currentWeekData))}
                      >
                        {renderCellContent(currentWeekData, previousWeekData)}
                      </TableCell>
                    );
                  })}
                  <TableCell className="text-right font-bold tabular-nums">
                     {renderCellContent(currentDataForTotal, prevDataForTotal)}
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
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="selection-vs-po-fc">Selection vs. PO+FC</TabsTrigger>
            <TabsTrigger value="demand-trend">Demand Trend Analysis</TabsTrigger>
          </TabsList>
          <TabsContent value="selection-vs-po-fc" className="pt-4">
             <SelectionVsPoFc order={order} />
          </TabsContent>
          <TabsContent value="demand-trend" className="pt-4">
             <DemandTrendAnalysis order={order} />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
