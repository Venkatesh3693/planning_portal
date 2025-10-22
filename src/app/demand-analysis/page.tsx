

'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useSchedule } from '@/context/schedule-provider';
import { useState, useMemo, useEffect } from 'react';
import type { Order, Size, FcComposition, DemandDetail } from '@/lib/types';
import { SIZES } from '@/lib/data';
import { getWeek } from 'date-fns';
import { cn } from '@/lib/utils';

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Percent, ArrowLeft } from 'lucide-react';
import { Header } from '@/components/layout/header';
import Link from 'next/link';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';


const DemandTrendAnalysis = ({ order }: { order: Order }) => {
  const [selectedSize, setSelectedSize] = useState<Size | 'total'>('total');
  const [selectedDestination, setSelectedDestination] = useState<string>('total');
  const [viewMode, setViewMode] = useState<'absolute' | 'percentage'>('absolute');
  const [currentWeek, setCurrentWeek] = useState(0);

  useEffect(() => {
    setCurrentWeek(getWeek(new Date()));
  }, []);
  
  const destinationOptions = useMemo(() => {
    return order.demandDetails?.map(d => d.destination) || [];
  }, [order.demandDetails]);

  const { forecastWeeks, snapshots, snapshotTotals } = useMemo(() => {
    const allFcDetails = order.fcVsFcDetails || [];
    if (allFcDetails.length === 0) {
      return { forecastWeeks: [], snapshots: [], snapshotTotals: {} };
    }
    
    // Determine the relevant forecast data
    let relevantFcDetails = allFcDetails;
    const isDestinationSpecificView = selectedDestination !== 'total';

    if (isDestinationSpecificView) {
      // Find the specific destination's forecast evolution if it exists
      // This assumes a structure like order.destinationFcVsFcDetails: { [destination]: FcSnapshot[] }
      // Since it doesn't exist, we will simulate it by scaling the total forecast.
      const destinationDetail = order.demandDetails?.find(d => d.destination === selectedDestination);
      const totalDemand = order.demandDetails?.reduce((sum, d) => sum + d.selectionQty, 0) || order.quantity;

      if (destinationDetail && totalDemand > 0) {
        const scalingFactor = destinationDetail.selectionQty / totalDemand;
        relevantFcDetails = allFcDetails.map(snapshot => {
          const newForecasts: typeof snapshot.forecasts = {};
          for (const weekKey in snapshot.forecasts) {
            newForecasts[weekKey] = {};
            const weekData = snapshot.forecasts[weekKey];
            for (const sizeKey in weekData) {
              const fcComp = weekData[sizeKey as Size | 'total'];
              newForecasts[weekKey][sizeKey as Size | 'total'] = {
                po: Math.round(fcComp.po * scalingFactor),
                fc: Math.round(fcComp.fc * scalingFactor),
              };
            }
          }
          return { ...snapshot, forecasts: newForecasts };
        });
      }
    }


    const weekSet = new Set<string>();
    relevantFcDetails.forEach(snapshot => {
      Object.keys(snapshot.forecasts).forEach(week => weekSet.add(week));
    });
    
    const forecastWeeks = Array.from(weekSet).sort((a, b) => {
      const weekA = parseInt(a.replace('W', ''));
      const weekB = parseInt(b.replace('W', ''));
      return weekA - weekB;
    });
    
    const snapshots = relevantFcDetails.sort((a, b) => a.snapshotWeek - b.snapshotWeek);

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
  }, [order, selectedSize, selectedDestination]);

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
    const isHistorical = demandWeekNum < snapshotWeek;
    
    if (isHistorical) {
        return 'bg-slate-100 dark:bg-slate-800';
    }

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
    <div className="space-y-4 flex flex-col h-full">
       <div className="flex items-center gap-4 flex-shrink-0">
        <div className="flex items-center gap-2">
            <Label htmlFor="destination-filter" className="text-sm">Destination:</Label>
            <Select value={selectedDestination} onValueChange={setSelectedDestination}>
              <SelectTrigger className="w-[180px]" id="destination-filter">
                <SelectValue placeholder="Select a destination" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="total">ALL</SelectItem>
                {destinationOptions.map(dest => (
                  <SelectItem key={dest} value={dest}>{dest}</SelectItem>
                ))}
              </SelectContent>
            </Select>
        </div>
        <div className="flex items-center gap-2">
          <Label htmlFor="size-filter" className="text-sm">Size:</Label>
          <Select value={selectedSize} onValueChange={(value) => setSelectedSize(value as Size | 'total')}>
            <SelectTrigger className="w-[120px]" id="size-filter">
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
      <div className="flex-1 min-h-0 overflow-auto border rounded-lg">
        <Table className="text-xs">
          <TableHeader className="sticky top-0 bg-background z-10">
            <TableRow>
              <TableHead className="sticky left-0 bg-background z-20 min-w-[90px] px-2">Snapshot Week</TableHead>
              {forecastWeeks.map(week => (
                <TableHead key={week} className="text-right min-w-[90px] px-2">{week}</TableHead>
              ))}
              <TableHead className="text-right min-w-[100px] font-bold px-2">Total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {snapshots.map((snapshot, rowIndex) => {
              const prevSnapshot = rowIndex > 0 ? snapshots[rowIndex - 1] : undefined;
              
              const currentDataForTotal = snapshotTotals[snapshot.snapshotWeek];
              const prevDataForTotal = prevSnapshot ? snapshotTotals[prevSnapshot.snapshotWeek] : undefined;

              return (
                <TableRow key={snapshot.snapshotWeek}>
                  <TableCell className="font-medium sticky left-0 bg-background z-10 px-2">
                    W{snapshot.snapshotWeek}
                  </TableCell>
                  {forecastWeeks.map(week => {
                    const currentWeekData = snapshot.forecasts[week]?.[selectedSize];
                    const previousWeekData = prevSnapshot?.forecasts[week]?.[selectedSize];
                    
                    return (
                      <TableCell 
                        key={`${snapshot.snapshotWeek}-${week}`} 
                        className={cn("text-right tabular-nums px-2", getCellBgClass(week, snapshot.snapshotWeek, currentWeekData))}
                      >
                        {renderCellContent(currentWeekData, previousWeekData)}
                      </TableCell>
                    );
                  })}
                  <TableCell className="text-right font-bold tabular-nums px-2">
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


function DemandAnalysisPageContent() {
    const searchParams = useSearchParams();
    const orderId = searchParams.get('orderId');
    const { orders, isScheduleLoaded, appMode } = useSchedule();

    const order = useMemo(() => {
        if (!isScheduleLoaded || !orderId) return null;
        return orders.find(o => o.id === orderId);
    }, [orderId, orders, isScheduleLoaded]);

    if (!isScheduleLoaded) {
        return <div className="flex items-center justify-center h-full">Loading analysis data...</div>;
    }

    if (appMode === 'gut') {
        return <div className="flex items-center justify-center h-full">This view is not applicable for GUT mode.</div>;
    }

    if (!order) {
        return <div className="flex items-center justify-center h-full">Order not found. Please go back and select an order.</div>;
    }

    return (
        <div className="flex h-screen flex-col">
            <Header />
            <main className="flex-1 p-4 sm:p-6 lg:p-8 flex flex-col">
                <Breadcrumb className="mb-4 flex-shrink-0">
                    <BreadcrumbList>
                        <BreadcrumbItem>
                            <BreadcrumbLink asChild>
                                <Link href="/">Home</Link>
                            </BreadcrumbLink>
                        </BreadcrumbItem>
                        <BreadcrumbSeparator />
                        <BreadcrumbItem>
                             <BreadcrumbLink asChild>
                                <Link href="/orders">Order Management</Link>
                            </BreadcrumbLink>
                        </BreadcrumbItem>
                        <BreadcrumbSeparator />
                        <BreadcrumbItem>
                            <BreadcrumbPage>Demand Trend Analysis</BreadcrumbPage>
                        </BreadcrumbItem>
                    </BreadcrumbList>
                </Breadcrumb>

                <div className="flex justify-between items-center mb-4 flex-shrink-0">
                    <div>
                        <h1 className="text-2xl font-bold">Demand Trend Analysis</h1>
                        <p className="text-muted-foreground">
                            Order ID: {order.id}
                        </p>
                    </div>
                     <Button variant="outline" asChild>
                        <Link href="/orders">
                            <ArrowLeft className="mr-2 h-4 w-4" />
                            Back to Orders
                        </Link>
                    </Button>
                </div>
                
                <div className="flex-1 min-h-0">
                    <DemandTrendAnalysis order={order} />
                </div>
            </main>
        </div>
    );
}

export default function DemandAnalysisPage() {
    return (
        <Suspense fallback={<div>Loading...</div>}>
            <DemandAnalysisPageContent />
        </Suspense>
    );
}
