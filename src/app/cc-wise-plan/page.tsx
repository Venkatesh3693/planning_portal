

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

type TrackerRun = {
  runNumber: number;
  startWeek: string;
  endWeek: string;
  quantity: number;
  lines: number;
  offset: number;
};

type ModelPlanData = {
    poFc: Record<string, number>;
    fgci: Record<string, number>;
    plan: Record<string, number>;
    produced: Record<string, number>;
};


function CcWisePlanPageContent() {
    const { isScheduleLoaded, orders, appMode } = useSchedule();
    const [selectedCc, setSelectedCc] = useState<string>('');
    const [selectedSnapshotWeek, setSelectedSnapshotWeek] = useState<number | null>(null);
    const [weeklyDemand, setWeeklyDemand] = useState<Record<string, number>>({});
    const [allWeeks, setAllWeeks] = useState<string[]>([]);
    const [trackerData, setTrackerData] = useState<TrackerRun[]>([]);
    const [planData, setPlanData] = useState<Record<string, number>>({});
    const [producedData, setProducedData] = useState<Record<string, number>>({});
    const [modelData, setModelData] = useState<Record<string, ModelPlanData>>({});
    
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

    const firstSnapshotWeek = useMemo(() => {
        if (ordersForCc.length === 0) return null;
        const allWeeks = new Set<number>();
         ordersForCc.forEach(order => {
            order.fcVsFcDetails?.forEach(snapshot => {
                allWeeks.add(snapshot.snapshotWeek);
            });
        });
        if (allWeeks.size === 0) return null;
        return Math.min(...Array.from(allWeeks));
    }, [ordersForCc]);
    
    useEffect(() => {
        if (snapshotOptions.length > 0) {
            setSelectedSnapshotWeek(snapshotOptions[0]);
        } else {
            setSelectedSnapshotWeek(null);
        }
        setPlanData({});
        setProducedData({});
        setTrackerData([]);
        setWeeklyDemand({});
        setAllWeeks([]);
    }, [selectedCc, snapshotOptions]);

    const calculatePlanForHorizon = (
        startWeek: number,
        endWeek: number | null,
        weeklyDemand: Record<string, number>,
        ccOrders: Order[],
        initialInventory: number = 0,
        simulationStartDate: number
    ): { runs: TrackerRun[]; plan: Record<string, number> } => {
        if (ccOrders.length === 0) return { runs: [], plan: {} };
        const representativeOrder = ccOrders[0]; // Use first order for style and efficiency info

        const allDemandWeeks = Object.keys(weeklyDemand).sort((a, b) => parseInt(a.slice(1)) - parseInt(b.slice(1)));
        
        let inventory = initialInventory;
        let finalRuns: TrackerRun[] = [];
        let finalPlan: Record<string, number> = {};
        let runCounter = 1;
        let lastRunEndWeek = startWeek - 1;

        while (lastRunEndWeek < (endWeek || 52)) {
            const nextDemandWeekStr = allDemandWeeks.find(w => {
                const weekNum = parseInt(w.slice(1));
                return weekNum > lastRunEndWeek && (weeklyDemand[w] || 0) > 0;
            });

            if (!nextDemandWeekStr) break;

            let currentRun = {
                startWeek: nextDemandWeekStr,
                endWeek: nextDemandWeekStr,
                quantity: 0
            };
            
            let zeroDemandStreak = 0;
            const demandScanStartWeek = parseInt(nextDemandWeekStr.slice(1));

            for (let w = demandScanStartWeek; w <= (endWeek || 52); w++) {
                const weekKey = `W${w}`;
                const demand = weeklyDemand[weekKey] || 0;

                if (demand > 0) {
                    currentRun.endWeek = weekKey;
                    zeroDemandStreak = 0;
                } else {
                    zeroDemandStreak++;
                }
                if (zeroDemandStreak >= 4) {
                    break;
                }
            }

            const runStartNum = parseInt(currentRun.startWeek.slice(1));
            const runEndNum = parseInt(currentRun.endWeek.slice(1));
            
            let grossDemandForRun = 0;
            for (let w = runStartNum; w <= runEndNum; w++) {
                grossDemandForRun += weeklyDemand[`W${w}`] || 0;
            }

            const netQuantityForRun = Math.max(0, grossDemandForRun - inventory);
            inventory = Math.max(0, inventory - grossDemandForRun);

            if (netQuantityForRun > 0) {
                 const obData: SewingOperation[] = SEWING_OPERATIONS_BY_STYLE[representativeOrder.style] || [];
                 if (!obData || obData.length === 0) continue;

                 const totalSam = obData.reduce((sum, op) => sum + op.sam, 0);
                 const totalTailors = obData.reduce((sum, op) => sum + op.operators, 0);
                 const budgetedEfficiency = representativeOrder.budgetedEfficiency || 85;

                 let numberOfLines = 1;
                 let keepLooping = true;

                 while (keepLooping) {
                     const maxWeeklyOutput = (WORK_DAY_MINUTES * 6 * totalTailors * numberOfLines * (budgetedEfficiency / 100)) / totalSam;

                     let openingInventoryForSim = 0;
                     let minClosingInventory = 0;

                     for (let w = runStartNum; w <= runEndNum; w++) {
                         const weekKey = `W${w}`;
                         const poFc = weeklyDemand[weekKey] || 0;
                         const supplyFromPreviousWeek = (w === runStartNum) ? 0 : maxWeeklyOutput;
                         const closingInventory = openingInventoryForSim + supplyFromPreviousWeek - poFc;

                         if (closingInventory < minClosingInventory) {
                             minClosingInventory = closingInventory;
                         }
                         openingInventoryForSim = closingInventory;
                     }
                     
                     const trueRequiredOffset = Math.ceil(Math.abs(Math.min(0, minClosingInventory)) / maxWeeklyOutput);
                     
                     if (trueRequiredOffset <= 4) {
                         const initialProposedStartWeek = runStartNum - trueRequiredOffset;
                         const finalStartWeekNum = Math.max(initialProposedStartWeek, simulationStartDate);
                         const finalOffset = runStartNum - finalStartWeekNum;

                         const weeksToProduce = Math.ceil(netQuantityForRun / maxWeeklyOutput);
                         const finalEndWeekNum = finalStartWeekNum + weeksToProduce - 1;

                         const currentRunData: TrackerRun = {
                             runNumber: runCounter++,
                             startWeek: `W${finalStartWeekNum}`,
                             endWeek: `W${finalEndWeekNum}`,
                             lines: numberOfLines,
                             offset: finalOffset,
                             quantity: Math.round(netQuantityForRun),
                         };
                         finalRuns.push(currentRunData);
                         
                         let remainingQty = netQuantityForRun;
                         for (let w = finalStartWeekNum; w <= finalEndWeekNum; w++) {
                             const weekKey = `W${w}`;
                             const planQty = Math.min(remainingQty, maxWeeklyOutput);
                             finalPlan[weekKey] = (finalPlan[weekKey] || 0) + Math.round(planQty);
                             remainingQty -= planQty;
                         }

                         inventory += netQuantityForRun; //Replenish inventory with what was just planned
                         keepLooping = false;
                     } else {
                         numberOfLines++;
                     }

                     if (numberOfLines > 100) keepLooping = false;
                 }
            }
            lastRunEndWeek = runEndNum;
        }

        return { runs: finalRuns, plan: finalPlan };
    };

    const handlePlan = () => {
        if (!selectedCc || !selectedSnapshotWeek || ordersForCc.length === 0 || !firstSnapshotWeek) return;
    
        // 1. Aggregate CC-level demand
        const currentDemand: Record<string, number> = {};
        ordersForCc.forEach(order => {
            const snapshot = order.fcVsFcDetails?.find(s => s.snapshotWeek === selectedSnapshotWeek);
            if (!snapshot) return;
            Object.entries(snapshot.forecasts).forEach(([week, data]) => {
                const weeklyTotal = (data.total?.po || 0) + (data.total?.fc || 0);
                currentDemand[week] = (currentDemand[week] || 0) + weeklyTotal;
            });
        });
        setWeeklyDemand(currentDemand);
    
        // 2. Set up week range for display
        const allDemandWeeks = new Set<string>();
        ordersForCc.forEach(order => order.fcVsFcDetails?.forEach(s => Object.keys(s.forecasts).forEach(w => allDemandWeeks.add(w))));
        const demandWeeks = Array.from(allDemandWeeks).map(w => parseInt(w.slice(1))).sort((a,b)=>a-b);
        const sortedWeeks: string[] = [];
        if (demandWeeks.length > 0) {
            const lastDemandWeek = demandWeeks[demandWeeks.length - 1];
            for(let w = firstSnapshotWeek; w <= lastDemandWeek; w++) {
                sortedWeeks.push(`W${w}`);
            }
        }
        setAllWeeks(sortedWeeks);
    
        // 3. Calculate historical production and inventory
        let cumulativeInventory = 0;
        let finalProducedData: Record<string, number> = {};
        for (let week = firstSnapshotWeek; week < selectedSnapshotWeek; week++) {
            const historicalSnapshot = ordersForCc[0].fcVsFcDetails?.find(s => s.snapshotWeek === week);
            if (!historicalSnapshot) continue;
    
            const historicalDemand: Record<string, number> = {};
            ordersForCc.forEach(order => {
                const snapshot = order.fcVsFcDetails?.find(s => s.snapshotWeek === week);
                if (!snapshot) return;
                Object.entries(snapshot.forecasts).forEach(([w, data]) => {
                    historicalDemand[w] = (historicalDemand[w] || 0) + ((data.total?.po || 0) + (data.total?.fc || 0));
                });
            });
    
            const { plan: historicalPlan } = calculatePlanForHorizon(week, null, historicalDemand, ordersForCc, cumulativeInventory, week);
            const productionThisWeek = historicalPlan[`W${week}`] || 0;
            const demandThisWeek = historicalDemand[`W${week}`] || 0;
    
            if (productionThisWeek > 0) {
                finalProducedData[`W${week}`] = productionThisWeek;
            }
            cumulativeInventory += productionThisWeek - demandThisWeek;
        }
    
        // 4. Run CC-level planning
        const currentPlanResult = calculatePlanForHorizon(selectedSnapshotWeek, null, currentDemand, ordersForCc, cumulativeInventory, selectedSnapshotWeek);
        setProducedData(finalProducedData);
        setPlanData(currentPlanResult.plan);
        setTrackerData(currentPlanResult.runs);
    
        // 5. Prepare model-wise data structures
        const newModelData: Record<string, ModelPlanData> = {};
        ordersForCc.forEach(order => {
            const snapshot = order.fcVsFcDetails?.find(s => s.snapshotWeek === selectedSnapshotWeek);
            if (!snapshot) return;
            const modelPoFc: Record<string, number> = {};
            sortedWeeks.forEach(week => {
                const weekForecast = snapshot.forecasts[week];
                let totalModelDemand = 0;
                if(weekForecast) {
                    SIZES.forEach(size => {
                        totalModelDemand += weekForecast[size]?.po || 0;
                        totalModelDemand += weekForecast[size]?.fc || 0;
                    })
                }
                modelPoFc[week] = totalModelDemand;
            });
            newModelData[order.id] = { poFc: modelPoFc, fgci: {}, plan: {}, produced: {} };
        });
    
        // 6. Allocate CC plan to models using a single source of truth for inventory
        const modelPlanAllocation: Record<string, Record<string, number>> = {};
        ordersForCc.forEach(order => modelPlanAllocation[order.id] = {});
    
        const calculateModelFgci = (
            modelId: string,
            weeks: string[],
            demand: Record<string, number>,
            plan: Record<string, number>
        ): Record<string, number> => {
            const fgci: Record<string, number> = {};
            let lastWeekPci = 0;
            let lastWeekProduction = 0;
    
            for (const week of weeks) {
                const weekNum = parseInt(week.slice(1));
                const openingInventory = lastWeekPci + lastWeekProduction;
                const demandThisWeek = demand[week] || 0;
                const supplyThisWeek = plan[week] || 0;
                const currentPci = openingInventory - demandThisWeek;
                fgci[week] = currentPci;
                lastWeekPci = currentPci;
                lastWeekProduction = supplyThisWeek;
            }
            return fgci;
        };
    
        const ccPlanWeeks = Object.keys(currentPlanResult.plan).sort((a, b) => parseInt(a.slice(1)) - parseInt(b.slice(1)));
    
        for (const planWeek of ccPlanWeeks) {
            const planQty = currentPlanResult.plan[planWeek];
            if (planQty <= 0) continue;
    
            let bestModelId = '';
            let minFgci = Infinity;
    
            for (const order of ordersForCc) {
                const tempModelPlan = { ...modelPlanAllocation[order.id] };
                const modelDemand = newModelData[order.id].poFc;
                
                // Calculate FG CI *as if no production is happening this week*
                const projectedFgci = calculateModelFgci(order.id, sortedWeeks, modelDemand, tempModelPlan);
                
                // Find the first future week with demand to break ties
                let lookaheadWeek = planWeek;
                let foundFutureDemand = false;
                for (let w = parseInt(planWeek.slice(1)); w <= parseInt(sortedWeeks[sortedWeeks.length-1].slice(1)); w++) {
                     if((modelDemand[`W${w}`] || 0) > 0) {
                         lookaheadWeek = `W${w}`;
                         foundFutureDemand = true;
                         break;
                     }
                }
                if (!foundFutureDemand) {
                    lookaheadWeek = planWeek;
                }

                const fgciForComparison = projectedFgci[lookaheadWeek] || 0;
    
                if (fgciForComparison < minFgci) {
                    minFgci = fgciForComparison;
                    bestModelId = order.id;
                }
            }
    
            if (bestModelId) {
                modelPlanAllocation[bestModelId][planWeek] = (modelPlanAllocation[bestModelId][planWeek] || 0) + planQty;
            }
        }
    
        // 7. Set final model data after all allocations are done
        ordersForCc.forEach(order => {
            newModelData[order.id].plan = modelPlanAllocation[order.id];
            const finalFgci = calculateModelFgci(order.id, sortedWeeks, newModelData[order.id].poFc, newModelData[order.id].plan);
            newModelData[order.id].fgci = finalFgci;
            // TODO: Populate `produced` data from a historical model-wise plan log
            newModelData[order.id].produced = {};
        });
    
        setModelData(newModelData);
    };


    const fgciData = useMemo(() => {
        if (allWeeks.length === 0) return {};
        
        const data: Record<string, number> = {};
        const sortedWeeks = [...allWeeks].sort((a, b) => parseInt(a.slice(1)) - parseInt(b.slice(1)));

        let lastWeekPci = 0;
        let lastWeekProduction = 0;

        for (let i = 0; i < sortedWeeks.length; i++) {
            const week = sortedWeeks[i];
            const weekNum = parseInt(week.slice(1));
            const demand = weeklyDemand[week] || 0;
            const supplyThisWeek = (planData[week] || 0) + (producedData[week] || 0);

            const openingInventory = lastWeekPci;
            const currentPci = openingInventory + supplyThisWeek - demand;
            
            data[week] = currentPci;
            lastWeekPci = currentPci;
        }

        return data;
    }, [allWeeks, weeklyDemand, planData, producedData]);

    
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
                    {selectedCc && selectedSnapshotWeek !== null && allWeeks.length > 0 && (
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
                     {selectedCc && allWeeks.length === 0 && (
                        <div className="border rounded-lg p-10 text-center text-muted-foreground">
                           <p>No PO+FC demand data available for the selected CC and snapshot week.</p>
                        </div>
                    )}
                </div>

                {selectedCc && (
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

