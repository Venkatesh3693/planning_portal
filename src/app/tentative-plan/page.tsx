
'use client';

import { Suspense, useMemo, useState, useEffect } from 'react';
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { getWeek } from 'date-fns';
import type { FcComposition, Size, SewingOperation } from '@/lib/types';
import { SEWING_OPERATIONS_BY_STYLE, WORK_DAY_MINUTES } from '@/lib/data';

type TrackerRun = {
  runNumber: number;
  startWeek: string;
  endWeek: string;
  quantity: number;
  lines: number;
  offset: number;
};


const TentativePlanTable = ({ order, selectedSnapshotWeek, planData, producedData }: { order: any, selectedSnapshotWeek: number | null, planData: Record<string, number>, producedData: Record<string, number>}) => {
    
    const latestSnapshot = useMemo(() => {
        if (!order?.fcVsFcDetails || order.fcVsFcDetails.length === 0 || selectedSnapshotWeek === null) return null;

        return order.fcVsFcDetails.find((s: any) => s.snapshotWeek === selectedSnapshotWeek);
    }, [order, selectedSnapshotWeek]);

    const { weeks, weeklyData } = useMemo(() => {
        if (!latestSnapshot) return { weeks: [], weeklyData: {} };

        const allWeeks = Object.keys(latestSnapshot.forecasts).sort((a, b) => {
            const weekA = parseInt(a.replace('W', ''));
            const weekB = parseInt(b.replace('W', ''));
            return weekA - weekB;
        });
        
        const data: Record<string, { poFc: number }> = {};
        allWeeks.forEach(week => {
            const forecast = latestSnapshot.forecasts[week]?.total;
            if (forecast) {
                data[week] = {
                    poFc: (forecast.po || 0) + (forecast.fc || 0),
                };
            }
        });

        return { weeks: allWeeks, weeklyData: data };
    }, [latestSnapshot]);

    const pciData = useMemo(() => {
        const data: Record<string, number> = {};
        const sortedWeeks = [...weeks].sort((a, b) => parseInt(a.slice(1)) - parseInt(b.slice(1)));

        const firstRelevantWeekIndex = sortedWeeks.findIndex(w => (weeklyData[w]?.poFc || 0) > 0 || (planData[w] || 0) > 0 || (producedData[w] || 0) > 0);
        if (firstRelevantWeekIndex === -1) return {};

        const relevantWeeks = sortedWeeks.slice(firstRelevantWeekIndex);

        let lastWeekPci = 0;

        for (let i = 0; i < relevantWeeks.length; i++) {
            const week = relevantWeeks[i];
            const demand = weeklyData[week]?.poFc || 0;
            
            const supplyThisWeek = (planData[week] || 0) + (producedData[week] || 0);

            const openingInventory = lastWeekPci;
            const currentPci = openingInventory + supplyThisWeek - demand;
            
            data[week] = currentPci;
            lastWeekPci = currentPci;
        }

        return data;
    }, [weeks, weeklyData, planData, producedData]);

    if (!latestSnapshot) {
        return <div className="p-4 text-muted-foreground">No forecast snapshot data available for the selected week.</div>;
    }

    return (
        <Card>
            <CardContent className="p-0">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="w-[200px] font-bold">Dimension</TableHead>
                            {weeks.map(week => (
                                <TableHead key={week} className="text-right">{week}</TableHead>
                            ))}
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        <TableRow>
                            <TableCell className="font-medium">PO + FC</TableCell>
                            {weeks.map(week => (
                                <TableCell key={week} className="text-right">
                                    {(weeklyData[week]?.poFc || 0).toLocaleString()}
                                </TableCell>
                            ))}
                        </TableRow>
                        <TableRow>
                            <TableCell className="font-medium">Produced</TableCell>
                            {weeks.map(week => (
                                <TableCell key={week} className="text-right text-green-600 font-semibold">
                                    {(producedData[week] || 0) > 0 ? (producedData[week] || 0).toLocaleString() : '-'}
                                </TableCell>
                            ))}
                        </TableRow>
                        <TableRow>
                            <TableCell className="font-medium">Plan</TableCell>
                            {weeks.map(week => (
                                <TableCell key={week} className="text-right font-semibold">
                                    {(planData[week] || 0) > 0 ? (planData[week] || 0).toLocaleString() : '-'}
                                </TableCell>
                            ))}
                        </TableRow>
                         <TableRow>
                            <TableCell className="font-medium">FG CI</TableCell>
                            {weeks.map(week => (
                                <TableCell key={week} className="text-right">
                                    {pciData[week] !== undefined ? pciData[week].toLocaleString() : '-'}
                                </TableCell>
                            ))}
                        </TableRow>
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    );
};


function TentativePlanPageContent() {
    const { appMode, orders, isScheduleLoaded } = useSchedule();
    const [selectedOrderId, setSelectedOrderId] = useState<string>('');
    const [selectedSnapshotWeek, setSelectedSnapshotWeek] = useState<number | null>(null);
    const [trackerData, setTrackerData] = useState<TrackerRun[]>([]);
    const [planData, setPlanData] = useState<Record<string, number>>({});
    const [producedData, setProducedData] = useState<Record<string, number>>({});

    const gutOrders = useMemo(() => {
        if (!isScheduleLoaded) return [];
        return orders.filter(o => o.orderType === 'Forecasted');
    }, [orders, isScheduleLoaded]);

    const selectedOrder = useMemo(() => {
        if (!selectedOrderId) return null;
        return gutOrders.find(o => o.id === selectedOrderId);
    }, [selectedOrderId, gutOrders]);

    const snapshotOptions = useMemo(() => {
        if (!selectedOrder?.fcVsFcDetails) return [];
        return [...selectedOrder.fcVsFcDetails]
            .map(s => s.snapshotWeek)
            .sort((a, b) => b - a);
    }, [selectedOrder]);

    useEffect(() => {
        if (selectedOrder && snapshotOptions.length > 0) {
            setSelectedSnapshotWeek(snapshotOptions[0]);
        } else {
            setSelectedSnapshotWeek(null);
        }
        setTrackerData([]);
        setPlanData({});
        setProducedData({});
    }, [selectedOrder]);


    const calculatePlanForHorizon = (
        startWeek: number, 
        endWeek: number | null,
        weeklyDemand: Record<string, number>,
        order: any,
        initialInventory: number = 0,
        simulationStartDate: number
    ): { runs: TrackerRun[], plan: Record<string, number> } => {
        const allDemandWeeks = Object.keys(weeklyDemand).sort((a, b) => parseInt(a.slice(1)) - parseInt(b.slice(1)));

        const runs: Omit<TrackerRun, 'lines' | 'offset'>[] = [];
        let currentRun: Partial<Omit<TrackerRun, 'lines' | 'offset'>> & { quantity: number } = { quantity: 0 };
        let zeroDemandStreak = 0;
        let runCounter = 1;

        const weeksToScan = allDemandWeeks.filter(w => {
            const weekNum = parseInt(w.slice(1));
            const isAfterStart = weekNum >= startWeek;
            const isBeforeEnd = endWeek === null || weekNum <= endWeek;
            return isAfterStart && isBeforeEnd && (weeklyDemand[w] || 0) > 0;
        });

        for (const week of weeksToScan) {
            const demand = weeklyDemand[week] || 0;

            if (demand > 0) {
                if (!currentRun.startWeek) {
                    currentRun.startWeek = week;
                    currentRun.quantity = 0;
                }
                currentRun.endWeek = week;
                currentRun.quantity! += demand;
                zeroDemandStreak = 0;
            } else {
                if (currentRun.startWeek) {
                    zeroDemandStreak++;
                }
            }

            if (zeroDemandStreak >= 4 && currentRun.startWeek) {
                runs.push({
                    runNumber: runCounter++,
                    startWeek: currentRun.startWeek,
                    endWeek: currentRun.endWeek!,
                    quantity: Math.round(currentRun.quantity!),
                });
                currentRun = { quantity: 0 };
                zeroDemandStreak = 0;
            }
        }
        
        if (currentRun.startWeek) {
            runs.push({
                runNumber: runCounter++,
                startWeek: currentRun.startWeek,
                endWeek: currentRun.endWeek!,
                quantity: Math.round(currentRun.quantity!),
            });
        }

        const obData = SEWING_OPERATIONS_BY_STYLE[order.style];
        if (!obData) return { runs: [], plan: {} };

        const totalSam = obData.reduce((sum, op) => sum + op.sam, 0);
        const totalTailors = obData.reduce((sum, op) => sum + op.operators, 0);
        const budgetedEfficiency = order.budgetedEfficiency || 85;

        const finalRuns: TrackerRun[] = [];
        const finalPlan: Record<string, number> = {};
        
        let inventoryCarryOver = initialInventory;

        for (const run of runs) {
            let numberOfLines = 1;
            let keepLooping = true;
            
            const runStartWeekNum = parseInt(run.startWeek.slice(1));

            while (keepLooping) {
                const maxWeeklyOutput = (WORK_DAY_MINUTES * 6 * totalTailors * numberOfLines * (budgetedEfficiency / 100)) / totalSam;
                
                let openingInventory = inventoryCarryOver;
                let minClosingInventory = openingInventory;

                for (let w = runStartWeekNum; w <= parseInt(run.endWeek.slice(1)); w++) {
                    const weekKey = `W${w}`;
                    const poFc = weeklyDemand[weekKey] || 0;
                    
                    const supplyFromPreviousWeek = (w === runStartWeekNum) ? 0 : maxWeeklyOutput;
                    
                    const closingInventory = openingInventory + supplyFromPreviousWeek - poFc;
                    if (closingInventory < minClosingInventory) {
                        minClosingInventory = closingInventory;
                    }
                    openingInventory = closingInventory;
                }
                
                const calculatedOffset = Math.ceil(Math.abs(Math.min(0, minClosingInventory)) / maxWeeklyOutput);
                const initialProposedStartWeek = runStartWeekNum - calculatedOffset;
                const finalStartWeekNum = Math.max(initialProposedStartWeek, simulationStartDate);
                const finalOffset = runStartWeekNum - finalStartWeekNum;

                if (finalOffset <= 4) {
                    const weeksToProduce = Math.ceil(run.quantity / maxWeeklyOutput);
                    const finalEndWeekNum = finalStartWeekNum + weeksToProduce - 1;

                    const currentRunData: TrackerRun = {
                        ...run,
                        startWeek: `W${finalStartWeekNum}`,
                        endWeek: `W${finalEndWeekNum}`,
                        lines: numberOfLines,
                        offset: finalOffset,
                    };
                    finalRuns.push(currentRunData);
                    
                    inventoryCarryOver = openingInventory; // Carry over for next run

                    let remainingQty = run.quantity;
                    for (let w = finalStartWeekNum; w <= finalEndWeekNum; w++) {
                        const weekKey = `W${w}`;
                        const planQty = Math.min(remainingQty, maxWeeklyOutput);
                        finalPlan[weekKey] = (finalPlan[weekKey] || 0) + Math.round(planQty);
                        remainingQty -= planQty;
                    }
                    keepLooping = false;
                } else {
                    numberOfLines++;
                }
                if(numberOfLines > 100) keepLooping = false; // Safety break
            }
        }
        return { runs: finalRuns, plan: finalPlan };
    };


    const handlePlan = () => {
        if (!selectedOrder || selectedSnapshotWeek === null) return;

        const snapshot = selectedOrder.fcVsFcDetails?.find(s => s.snapshotWeek === selectedSnapshotWeek);
        if (!snapshot) return;

        const weeklyTotals: Record<string, number> = {};
        const allWeeks = Object.keys(snapshot.forecasts).sort((a, b) => parseInt(a.slice(1)) - parseInt(b.slice(1)));
        allWeeks.forEach(week => {
            const total = snapshot.forecasts[week]?.total;
            weeklyTotals[week] = (total?.po || 0) + (total?.fc || 0);
        });

        const firstPoFcWeekStr = allWeeks.find(w => (weeklyTotals[w] || 0) > 0);
        if (!firstPoFcWeekStr) {
            setTrackerData([]);
            setPlanData({});
            setProducedData({});
            return;
        }

        const firstPoFcWeekNum = parseInt(firstPoFcWeekStr.slice(1));
        const earliestProductionStartWeek = firstPoFcWeekNum - 4;
        
        let finalProducedData: Record<string, number> = {};
        let initialInventoryForPlan = 0;
        let simulationStartDateForCurrentPlan = earliestProductionStartWeek;
        
        if (selectedSnapshotWeek > earliestProductionStartWeek) {
            const pastPlanResult = calculatePlanForHorizon(earliestProductionStartWeek, 52, weeklyTotals, selectedOrder, 0, earliestProductionStartWeek);
            
            const producedPlan: Record<string, number> = {};
            Object.keys(pastPlanResult.plan).forEach(weekKey => {
                const weekNum = parseInt(weekKey.slice(1));
                if (weekNum < selectedSnapshotWeek) {
                    producedPlan[weekKey] = pastPlanResult.plan[weekKey];
                }
            });
            finalProducedData = producedPlan;

            let inventory = 0;
            const pastWeeks = allWeeks.filter(w => parseInt(w.slice(1)) < selectedSnapshotWeek);
            
            for (const weekKey of pastWeeks) {
                const supplyThisWeek = producedPlan[weekKey] || 0;
                const demandThisWeek = weeklyTotals[weekKey] || 0;
                inventory += supplyThisWeek - demandThisWeek;
            }
            initialInventoryForPlan = inventory;
            simulationStartDateForCurrentPlan = selectedSnapshotWeek;
        }

        const currentPlanResult = calculatePlanForHorizon(selectedSnapshotWeek, null, weeklyTotals, selectedOrder, initialInventoryForPlan, simulationStartDateForCurrentPlan);
        
        setProducedData(finalProducedData);
        setPlanData(currentPlanResult.plan);
        setTrackerData(currentPlanResult.runs);
    };

    if (appMode === 'gup') {
        return (
            <div className="flex h-screen flex-col">
              <Header />
              <main className="flex-1 p-4 sm:p-6 lg:p-8 flex items-center justify-center">
                <div className="text-center">
                  <h2 className="text-xl font-semibold">Tentative Plan Not Available</h2>
                  <p className="mt-2 text-muted-foreground">
                    This view is only applicable for GUT mode.
                  </p>
                  <Button asChild className="mt-6">
                    <Link href="/orders">View GUP Orders</Link>
                  </Button>
                </div>
              </main>
            </div>
        )
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
                            <BreadcrumbPage>Tentative Plan</BreadcrumbPage>
                        </BreadcrumbItem>
                    </BreadcrumbList>
                </Breadcrumb>

                 <div className="flex justify-between items-center mb-4 flex-shrink-0">
                    <div>
                        <h1 className="text-2xl font-bold">Tentative Plan</h1>
                        <p className="text-muted-foreground">
                            A high-level overview of the tentative production plan.
                        </p>
                    </div>
                </div>
                
                <div className="space-y-6">
                    <div className="flex gap-4">
                        <div className="w-full max-w-xs space-y-2">
                            <Label htmlFor="order-select">Select Order ID</Label>
                            <Select value={selectedOrderId} onValueChange={setSelectedOrderId}>
                                <SelectTrigger id="order-select">
                                    <SelectValue placeholder="Select an order..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {gutOrders.map(order => (
                                        <SelectItem key={order.id} value={order.id}>
                                            {order.id} ({order.style})
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                         {selectedOrder && snapshotOptions.length > 0 && (
                            <div className="flex items-end gap-2">
                                <div className="w-full max-w-xs space-y-2">
                                    <Label htmlFor="snapshot-select">Select Snapshot Week</Label>
                                    <Select value={selectedSnapshotWeek !== null ? String(selectedSnapshotWeek) : ''} onValueChange={(val) => setSelectedSnapshotWeek(Number(val))}>
                                        <SelectTrigger id="snapshot-select">
                                            <SelectValue placeholder="Select a snapshot..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {snapshotOptions.map(week => (
                                                <SelectItem key={week} value={String(week)}>
                                                    Snapshot Week {week}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <Button onClick={handlePlan}>Plan</Button>
                            </div>
                        )}
                    </div>
                    
                    {selectedOrder ? (
                        <TentativePlanTable order={selectedOrder} selectedSnapshotWeek={selectedSnapshotWeek} planData={planData} producedData={producedData} />
                    ) : (
                        <div className="text-center text-muted-foreground pt-10">Please select an order to view the tentative plan.</div>
                    )}

                    {selectedOrder && (
                        <Card>
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
                </div>
            </main>
        </div>
    );
}

export default function TentativePlanPage() {
    return (
        <Suspense fallback={<div>Loading...</div>}>
            <TentativePlanPageContent />
        </Suspense>
    );
}
