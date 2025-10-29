

'use client';

import React, { Suspense, useState, useMemo, useEffect } from 'react';
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
import { ArrowLeft } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { Order, SewingOperation, Size, SizeBreakdown } from '@/lib/types';
import { SEWING_OPERATIONS_BY_STYLE, WORK_DAY_MINUTES, SIZES } from '@/lib/data';
import { cn } from '@/lib/utils';
import { runCcWisePlan, type CcWisePlanResult } from '@/lib/tna-calculator';


function CcWisePlanPageContent() {
    const { isScheduleLoaded, orders, appMode } = useSchedule();
    const [selectedCc, setSelectedCc] = useState<string>('');
    const [selectedSnapshotWeek, setSelectedSnapshotWeek] = useState<number | null>(null);
    const [planResult, setPlanResult] = useState<CcWisePlanResult | null>(null);
    
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
        setPlanResult(null);
    }, [selectedCc, snapshotOptions]);

     const handlePlan = () => {
        if (!selectedCc || !selectedSnapshotWeek || ordersForCc.length === 0) return;

        let cumulativeProducedData: Record<string, number> = {};

        const historicalSnapshots = snapshotOptions
            .filter(w => w < selectedSnapshotWeek)
            .sort((a, b) => a - b);
        
        // Simulate plan from the beginning up to the week before the selected snapshot
        // This builds the accurate "produced" history.
        for (const week of historicalSnapshots) {
             const resultForWeek = runCcWisePlan({
                ordersForCc,
                snapshotWeek: week,
                producedData: cumulativeProducedData,
            });
            
            if (resultForWeek) {
                 // The plan from this historical week becomes "produced" for the next iteration
                 // but only for the week it was planned in.
                const planForThisWeek = resultForWeek.planData[`W${week}`] || 0;
                if(planForThisWeek > 0) {
                   cumulativeProducedData[`W${week}`] = (cumulativeProducedData[`W${week}`] || 0) + planForThisWeek;
                }
            }
        }
        
        // Final run for the selected snapshot week, using the complete historical production data
        const finalResult = runCcWisePlan({
            ordersForCc,
            snapshotWeek: selectedSnapshotWeek,
            producedData: cumulativeProducedData,
        });

        setPlanResult(finalResult);
    };

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

    const { weeklyDemand, producedData, planData, modelData, allWeeks, fgciData, trackerData } = planResult || {
        weeklyDemand: {},
        producedData: {},
        planData: {},
        modelData: {},
        allWeeks: [],
        fgciData: {},
        trackerData: [],
    };
    
    const totalPoFc = Object.values(weeklyDemand).reduce((sum, val) => sum + val, 0);
    const totalProduced = Object.values(producedData).reduce((sum, qty) => sum + qty, 0);
    const totalPlan = Object.values(planData).reduce((sum, qty) => sum + qty, 0);

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
                            <div className="flex items-end gap-2">
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
                                 <Button onClick={handlePlan}>Plan</Button>
                            </div>
                        )}
                    </div>
                    {selectedCc && selectedSnapshotWeek !== null && planResult && allWeeks.length > 0 && (
                        <Card>
                            <CardContent className="p-0">
                                <div className="overflow-x-auto relative">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead className="min-w-[80px] font-bold sticky left-0 bg-background/95 z-20">Type</TableHead>
                                                <TableHead className="min-w-[150px] font-bold sticky left-[80px] bg-background/95 z-20">Dimension</TableHead>
                                                {allWeeks.map(week => (
                                                    <TableHead key={week} className="text-right">{week}</TableHead>
                                                ))}
                                                <TableHead className="text-right font-bold">Total</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            <TableRow>
                                                <TableCell rowSpan={4} className="font-bold sticky left-0 bg-background/95 min-w-[80px] z-10 align-middle text-center">{selectedCc}</TableCell>
                                                <TableCell className="font-medium sticky left-[80px] bg-background/95 z-10">PO + FC</TableCell>
                                                {allWeeks.map(week => (
                                                    <TableCell key={week} className="text-right">
                                                        {(weeklyDemand[week] || 0) > 0 ? (weeklyDemand[week] || 0).toLocaleString() : '-'}
                                                    </TableCell>
                                                ))}
                                                <TableCell className="text-right font-bold">{totalPoFc > 0 ? totalPoFc.toLocaleString() : '-'}</TableCell>
                                            </TableRow>
                                             <TableRow>
                                                <TableCell className="font-medium sticky left-[80px] bg-background/95 z-10">Produced</TableCell>
                                                {allWeeks.map(week => (
                                                    <TableCell key={week} className="text-right text-green-600 font-semibold">
                                                        {(producedData[week] || 0) > 0 ? (producedData[week] || 0).toLocaleString() : '-'}
                                                    </TableCell>
                                                ))}
                                                <TableCell className="text-right font-bold text-green-600">
                                                    {totalProduced > 0 ? totalProduced.toLocaleString() : '-'}
                                                </TableCell>
                                            </TableRow>
                                            <TableRow>
                                                <TableCell className="font-medium sticky left-[80px] bg-background/95 z-10">Plan</TableCell>
                                                {allWeeks.map(week => (
                                                    <TableCell key={week} className="text-right font-semibold">
                                                        {(planData[week] || 0) > 0 ? (planData[week] || 0).toLocaleString() : '-'}
                                                    </TableCell>
                                                ))}
                                                <TableCell className="text-right font-bold">
                                                    {totalPlan > 0 ? totalPlan.toLocaleString() : '-'}
                                                </TableCell>
                                            </TableRow>
                                            <TableRow>
                                                <TableCell className="font-medium sticky left-[80px] bg-background/95 z-10">FG CI</TableCell>
                                                {allWeeks.map(week => (
                                                    <TableCell key={week} className="text-right">
                                                        {fgciData[week] !== undefined ? fgciData[week].toLocaleString() : '-'}
                                                    </TableCell>
                                                ))}
                                                <TableCell></TableCell>
                                            </TableRow>

                                            {ordersForCc.map((order, orderIndex) => {
                                                const modelPlan = modelData[order.id];
                                                const totalModelPoFc = Object.values(modelPlan?.poFc || {}).reduce((s, v) => s + v, 0);
                                                const totalModelProduced = Object.values(modelPlan?.produced || {}).reduce((s, v) => s + v, 0);
                                                const totalModelPlan = Object.values(modelPlan?.plan || {}).reduce((s, v) => s + v, 0);

                                                return (
                                                    <React.Fragment key={order.id}>
                                                        <TableRow>
                                                            <TableCell rowSpan={4} className={cn("font-bold sticky left-0 z-10 align-middle text-center", orderIndex % 2 === 0 ? 'bg-muted/95' : 'bg-background/95')}>{order.color}</TableCell>
                                                            <TableCell className={cn("font-medium sticky left-[80px] z-10", orderIndex % 2 === 0 ? 'bg-muted/95' : 'bg-background/95')}>
                                                                PO + FC
                                                            </TableCell>
                                                            {allWeeks.map(week => (
                                                                <TableCell key={week} className="text-right">
                                                                    {(modelPlan?.poFc?.[week] || 0) > 0 ? (modelPlan?.poFc?.[week] || 0).toLocaleString() : '-'}
                                                                </TableCell>
                                                            ))}
                                                            <TableCell className="text-right font-bold">
                                                                {totalModelPoFc > 0 ? totalModelPoFc.toLocaleString() : '-'}
                                                            </TableCell>
                                                        </TableRow>
                                                        <TableRow>
                                                            <TableCell className={cn("font-medium sticky left-[80px] z-10", orderIndex % 2 === 0 ? 'bg-muted/95' : 'bg-background/95')}>Produced</TableCell>
                                                            {allWeeks.map(week => (
                                                                <TableCell key={week} className="text-right text-green-600 font-semibold">
                                                                    {(modelPlan?.produced?.[week] || 0) > 0 ? (modelPlan?.produced?.[week] || 0).toLocaleString() : '-'}
                                                                </TableCell>
                                                            ))}
                                                            <TableCell className="text-right font-bold text-green-600">{totalModelProduced > 0 ? totalModelProduced.toLocaleString() : '-'}</TableCell>
                                                        </TableRow>
                                                        <TableRow>
                                                            <TableCell className={cn("font-medium sticky left-[80px] z-10", orderIndex % 2 === 0 ? 'bg-muted/95' : 'bg-background/95')}>Plan</TableCell>
                                                             {allWeeks.map(week => (
                                                                <TableCell key={week} className="text-right font-semibold">
                                                                    {(modelPlan?.plan?.[week] || 0) > 0 ? (modelPlan?.plan?.[week] || 0).toLocaleString() : '-'}
                                                                </TableCell>
                                                            ))}
                                                            <TableCell className="text-right font-bold">{totalModelPlan > 0 ? totalModelPlan.toLocaleString() : '-'}</TableCell>
                                                        </TableRow>
                                                        <TableRow>
                                                            <TableCell className={cn("font-medium sticky left-[80px] z-10", orderIndex % 2 === 0 ? 'bg-muted/95' : 'bg-background/95')}>FG CI</TableCell>
                                                            {allWeeks.map(week => (
                                                                <TableCell key={week} className="text-right">
                                                                    {modelPlan?.fgci?.[week] !== undefined ? modelPlan?.fgci?.[week].toLocaleString() : '-'}
                                                                </TableCell>
                                                            ))}
                                                            <TableCell></TableCell>
                                                        </TableRow>
                                                    </React.Fragment>
                                                )
                                            })}
                                        </TableBody>
                                    </Table>
                                </div>
                            </CardContent>
                        </Card>
                    )}
                     {selectedCc && (!planResult || allWeeks.length === 0) && (
                        <div className="border rounded-lg p-10 text-center text-muted-foreground">
                           <p>No PO+FC demand data available for the selected CC and snapshot week. Click "Plan" to run a calculation.</p>
                        </div>
                    )}
                </div>

                {selectedCc && planResult && (
                    <Card className="mt-6">
                        <CardHeader>
                            <CardTitle>Tracker</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Run Number</TableHead>
                                        <TableHead>Plan start</TableHead>
                                        <TableHead>Plan end</TableHead>
                                        <TableHead>Offset</TableHead>
                                        <TableHead className="text-right">Quantity</TableHead>
                                        <TableHead>Number of lines</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {trackerData.length > 0 ? (
                                        trackerData.map(run => (
                                            <TableRow key={run.runNumber}>
                                                <TableCell>{run.runNumber}</TableCell>
                                                <TableCell>{run.startWeek}</TableCell>
                                                <TableCell>{run.endWeek}</TableCell>
                                                <TableCell>{run.offset}</TableCell>
                                                <TableCell className="text-right font-medium">{run.quantity.toLocaleString()}</TableCell>
                                                <TableCell>{run.lines}</TableCell>
                                            </TableRow>
                                        ))
                                    ) : (
                                        <TableRow>
                                            <TableCell colSpan={6} className="h-24 text-center">
                                                Click "Plan" to generate production runs.
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                )}
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



    