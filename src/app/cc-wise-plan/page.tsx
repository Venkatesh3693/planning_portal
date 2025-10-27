
'use client';

import { Suspense, useState, useMemo, useEffect } from 'react';
import { useSchedule } from '@/context/schedule-provider';
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
import { Button } from '@/components/ui/button';
import { ArrowLeft, Layers, BarChart } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { runTentativePlanForHorizon } from '@/lib/tna-calculator';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { Card, CardContent } from '@/components/ui/card';
import type { Order } from '@/lib/types';


type PlanData = {
    [orderId: string]: Record<string, number>;
};

type ViewMode = 'quantity' | 'lines';

function CcWisePlanPageContent() {
    const { isScheduleLoaded, orders, appMode } = useSchedule();
    const [selectedCc, setSelectedCc] = useState<string>('');
    const [selectedSnapshotWeek, setSelectedSnapshotWeek] = useState<number | null>(null);
    const [planData, setPlanData] = useState<PlanData>({});
    const [linesData, setLinesData] = useState<PlanData>({});
    const [allWeeks, setAllWeeks] = useState<string[]>([]);
    const [totals, setTotals] = useState<Record<string, number>>({});
    const [viewMode, setViewMode] = useState<ViewMode>('quantity');

    const ccOptions = useMemo(() => {
        if (!isScheduleLoaded) return [];
        const gutOrders = orders.filter(o => o.orderType === 'Forecasted');
        const uniqueCcs = [...new Set(gutOrders.map(o => o.ocn))];
        return uniqueCcs.sort();
    }, [orders, isScheduleLoaded]);

    const ordersForCc = useMemo(() => {
        if (!selectedCc) return [];
        return orders.filter(o => o.ocn === selectedCc && o.orderType === 'Forecasted');
    }, [selectedCc, orders]);

    const snapshotOptions = useMemo(() => {
        if (ordersForCc.length === 0) return [];
        const weekSet = new Set<number>();
        ordersForCc.forEach(order => {
            order.fcVsFcDetails?.forEach(snapshot => {
                weekSet.add(snapshot.snapshotWeek);
            });
        });
        return Array.from(weekSet).sort((a,b) => b - a);
    }, [ordersForCc]);
    
    useEffect(() => {
        if (snapshotOptions.length > 0) {
            setSelectedSnapshotWeek(snapshotOptions[0]);
        } else {
            setSelectedSnapshotWeek(null);
        }
    }, [snapshotOptions]);

    useEffect(() => {
        if (ordersForCc.length > 0 && selectedSnapshotWeek !== null) {
            const newPlanData: PlanData = {};
            const newLinesData: PlanData = {};
            const weekSet = new Set<string>();
            const newTotals: Record<string, number> = {};
            const weeklyLines: Record<string, number> = {};

            ordersForCc.forEach(order => {
                const snapshot = order.fcVsFcDetails?.find(s => s.snapshotWeek === selectedSnapshotWeek);
                if (!snapshot) {
                    newPlanData[order.id] = {};
                    newLinesData[order.id] = {};
                    return;
                }

                const weeklyTotals: Record<string, number> = {};
                Object.entries(snapshot.forecasts).forEach(([week, data]) => {
                    weeklyTotals[week] = (data.total?.po || 0) + (data.total?.fc || 0);
                });

                const { plan, runs } = runTentativePlanForHorizon(selectedSnapshotWeek, null, weeklyTotals, order, 0);
                newPlanData[order.id] = plan;
                
                const orderLinesByWeek: Record<string, number> = {};
                runs.forEach(run => {
                    const start = parseInt(run.startWeek.slice(1));
                    const end = parseInt(run.endWeek.slice(1));
                    for (let w = start; w <= end; w++) {
                        const weekKey = `W${w}`;
                        orderLinesByWeek[weekKey] = Math.max(orderLinesByWeek[weekKey] || 0, run.lines);
                    }
                });
                newLinesData[order.id] = orderLinesByWeek;

                Object.keys(plan).forEach(week => {
                    if (plan[week] > 0) {
                        weekSet.add(week);
                        newTotals[week] = (newTotals[week] || 0) + plan[week];
                    }
                });
            });
            
            setPlanData(newPlanData);
            setLinesData(newLinesData);

            const sortedWeeks = Array.from(weekSet).sort((a, b) => parseInt(a.slice(1)) - parseInt(b.slice(1)));
            setAllWeeks(sortedWeeks);
            
            // Calculate total lines per week (max, not sum)
            sortedWeeks.forEach(week => {
                let maxLines = 0;
                ordersForCc.forEach(order => {
                    if(newLinesData[order.id]?.[week]) {
                        maxLines += newLinesData[order.id][week]
                    }
                })
                weeklyLines[week] = maxLines
            })


            if (viewMode === 'quantity') {
              setTotals(newTotals);
            } else {
              setTotals(weeklyLines);
            }

        } else {
            setPlanData({});
            setLinesData({});
            setAllWeeks([]);
            setTotals({});
        }
    }, [ordersForCc, selectedSnapshotWeek, viewMode]);

    
    if (!isScheduleLoaded) {
        return <div className="flex items-center justify-center h-full">Loading data...</div>;
    }

    if (appMode === 'gup') {
        return (
            <div className="flex h-screen flex-col">
              <Header />
              <main className="flex-1 p-4 sm:p-6 lg:p-8 flex items-center justify-center">
                <div className="text-center">
                  <h2 className="text-xl font-semibold">CC-wise Plan Not Available</h2>
                  <p className="mt-2 text-muted-foreground">
                    This view is only applicable for GUT mode.
                  </p>
                  <Button asChild className="mt-6">
                    <Link href="/">View GUP Schedule</Link>
                  </Button>
                </div>
              </main>
            </div>
        )
    }

    const dataToShow = viewMode === 'quantity' ? planData : linesData;
    const grandTotal = Object.values(totals).reduce((sum, val) => sum + val, 0);

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
                            <BreadcrumbPage>CC-wise Plan</BreadcrumbPage>
                        </BreadcrumbItem>
                    </BreadcrumbList>
                </Breadcrumb>

                 <div className="flex justify-between items-start mb-4 flex-shrink-0">
                    <div>
                        <h1 className="text-2xl font-bold">CC-wise Plan</h1>
                        <p className="text-muted-foreground">
                            A plan based on style/color code combination.
                        </p>
                    </div>
                     <Button variant="outline" asChild>
                        <Link href="/orders">
                            <ArrowLeft className="mr-2 h-4 w-4" />
                            Back to Orders
                        </Link>
                    </Button>
                </div>
                
                <div className="space-y-4">
                    <div className="flex items-end gap-4">
                        <div className="w-full max-w-xs space-y-2">
                            <Label htmlFor="cc-select">Select CC</Label>
                            <Select value={selectedCc} onValueChange={setSelectedCc}>
                                <SelectTrigger id="cc-select">
                                    <SelectValue placeholder="Select a CC..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {ccOptions.map(cc => (
                                        <SelectItem key={cc} value={cc}>
                                            {cc}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        {selectedCc && snapshotOptions.length > 0 && (
                            <div className="space-y-2">
                                <Label htmlFor="snapshot-select">Snapshot Week</Label>
                                <Select value={selectedSnapshotWeek !== null ? String(selectedSnapshotWeek) : ''} onValueChange={(v) => setSelectedSnapshotWeek(Number(v))}>
                                    <SelectTrigger id="snapshot-select" className="w-[180px]">
                                        <SelectValue placeholder="Select week..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {snapshotOptions.map(week => (
                                            <SelectItem key={week} value={String(week)}>
                                                Week {week}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        )}
                        {selectedCc && (
                            <Button
                                variant="outline"
                                onClick={() => setViewMode(prev => prev === 'quantity' ? 'lines' : 'quantity')}
                                title={`Switch to ${viewMode === 'quantity' ? 'Lines' : 'Quantity'} view`}
                            >
                                {viewMode === 'quantity' ? <Layers className="mr-2 h-4 w-4" /> : <BarChart className="mr-2 h-4 w-4" />}
                                View by {viewMode === 'quantity' ? 'Lines' : 'Quantity'}
                            </Button>
                        )}
                    </div>
                    {selectedCc && selectedSnapshotWeek !== null && allWeeks.length > 0 && (
                        <Card>
                            <CardContent className="p-0">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead className="min-w-[200px]">Order ID</TableHead>
                                            {allWeeks.map(week => (
                                                <TableHead key={week} className="text-right">{week}</TableHead>
                                            ))}
                                            <TableHead className="text-right font-bold">Total</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {ordersForCc.map(order => {
                                            const orderPlan = dataToShow[order.id] || {};
                                            const orderTotal = Object.values(orderPlan).reduce((s, v) => s + v, 0);
                                            return (
                                                <TableRow key={order.id}>
                                                    <TableCell className="font-medium">{order.id}</TableCell>
                                                    {allWeeks.map(week => (
                                                        <TableCell key={`${order.id}-${week}`} className="text-right">
                                                            {(orderPlan[week] || 0) > 0 ? (orderPlan[week] || 0).toLocaleString() : '-'}
                                                        </TableCell>
                                                    ))}
                                                    <TableCell className="text-right font-bold">{orderTotal.toLocaleString()}</TableCell>
                                                </TableRow>
                                            );
                                        })}
                                    </TableBody>
                                    <TableFooter>
                                        <TableRow>
                                            <TableCell className="font-bold">Total</TableCell>
                                            {allWeeks.map(week => (
                                                <TableCell key={`total-${week}`} className="text-right font-bold">
                                                    {(totals[week] || 0).toLocaleString()}
                                                </TableCell>
                                            ))}
                                            <TableCell className="text-right font-bold">{grandTotal.toLocaleString()}</TableCell>
                                        </TableRow>
                                    </TableFooter>
                                </Table>
                            </CardContent>
                        </Card>
                    )}
                     {selectedCc && (ordersForCc.length === 0 || allWeeks.length === 0) && (
                        <div className="border rounded-lg p-10 text-center text-muted-foreground">
                           <p>No plan data available for the selected CC and snapshot week.</p>
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
}

export default function CcWisePlanPage() {
    return (
        <Suspense fallback={<div>Loading...</div>}>
            <CcWisePlanPageContent />
        </Suspense>
    );
}
