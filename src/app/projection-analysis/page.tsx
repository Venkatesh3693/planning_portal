
'use client';

import { Suspense, useMemo, useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getWeek } from 'date-fns';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Zap } from 'lucide-react';
import type { Order } from '@/lib/types';
import { runTentativePlanForHorizon } from '@/lib/tna-calculator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';

type Projection = {
  projectionNumber: string;
  projectionWeek: number;
  coverageStartWeek: number;
  coverageEndWeek: number;
  ckWeek: number;
  projectionQty: number;
  frcNumber: string;
  frcWeek: number;
  frcCoverageStartWeek: number;
  frcCovarageEndWeek: number;
  frcQty: number;
  cutOrderQty: number;
  pendingCutOrder: number;
};

const generateRollingProjections = (order: Order, currentWeek: number): Projection[] => {
    if (!order.fcVsFcDetails || order.fcVsFcDetails.length === 0) return [];
    
    // Find the earliest forecast data to establish a baseline
    const snapshotOptions = order.fcVsFcDetails.map(s => s.snapshotWeek).sort((a, b) => a - b);
    if (snapshotOptions.length === 0) return [];
    
    const earliestSnapshotWeek = snapshotOptions[0];
    const earliestSnapshot = order.fcVsFcDetails.find(s => s.snapshotWeek === earliestSnapshotWeek)!;
    
    const earliestDemand = Object.keys(earliestSnapshot.forecasts).reduce((acc, week) => {
        const weekData = earliestSnapshot.forecasts[week]?.total;
        if(weekData) acc[week] = weekData.po + weekData.fc;
        return acc;
    }, {} as Record<string, number>);

    // Run baseline to find when production actually starts
    const baselineResult = runTentativePlanForHorizon(earliestSnapshotWeek, null, earliestDemand, order, 0);
    const firstProdWeekStr = Object.keys(baselineResult.plan).find(w => (baselineResult.plan[w] || 0) > 0);
    
    if (!firstProdWeekStr) return [];
    const firstProdWeekNum = parseInt(firstProdWeekStr.slice(1));
    
    const maxLeadTimeDays = Math.max(0, ...(order.bom || []).filter(item => item.forecastType === 'Projection').map(item => item.leadTime));
    const maxLeadTimeWeeks = Math.ceil(maxLeadTimeDays / 7);

    let projections: Projection[] = [];
    let projIndex = 1;
    let keepGoing = true;

    while(keepGoing) {
        const firstCkWeek = firstProdWeekNum - 1;
        const firstProjWeek = firstCkWeek - maxLeadTimeWeeks;

        // Determine current projection's week
        const projectionWeek = firstProjWeek + ((projIndex - 1) * 4);

        if (projectionWeek >= currentWeek) {
            keepGoing = false;
            continue;
        }
        
        const ckForThisProjection = projectionWeek + maxLeadTimeWeeks;
        const coverageStartWeek = ckForThisProjection + 1;
        const coverageEndWeek = coverageStartWeek + 3;

        // Get the demand data for the current projection's snapshot week
        const currentSnapshot = order.fcVsFcDetails.find(s => s.snapshotWeek === projectionWeek) || order.fcVsFcDetails[order.fcVsFcDetails.length - 1];
        const currentDemand = Object.keys(currentSnapshot.forecasts).reduce((acc, week) => {
             const weekData = currentSnapshot.forecasts[week]?.total;
             if(weekData) acc[week] = weekData.po + weekData.fc;
             return acc;
        }, {} as Record<string, number>);
        
        // We run a fresh simulation from the projection week itself, with zero inventory.
        // This isolates the calculation for this specific projection.
        const simResult = runTentativePlanForHorizon(projectionWeek, null, currentDemand, order, 0);
        const simulatedPlan = simResult.plan;

        let projectionQty = 0;
        for (let w = coverageStartWeek; w <= coverageEndWeek; w++) {
            projectionQty += simulatedPlan[`W${w}`] || 0;
        }

        if (projectionQty <= 0 && projIndex > 1) {
            keepGoing = false;
            continue;
        }
        
        const frcQty = Math.round(projectionQty * 0.8);
        const cutOrderQty = Math.round(frcQty * 0.75);
        
        const frcWeek = ckForThisProjection + 2;

        const frcMaxLeadTimeDays = Math.max(0, ...(order.bom || []).filter(item => item.forecastType === 'FRC').map(item => item.leadTime));
        const frcMaxLeadTimeWeeks = Math.ceil(frcMaxLeadTimeDays / 7);

        const frcCKWeek = frcWeek + frcMaxLeadTimeWeeks;
        const frcCoverageStart = frcCKWeek + 1;

        projections.push({
            projectionNumber: `PROJ-DYN-${String(projIndex).padStart(2, '0')}`,
            projectionWeek: projectionWeek,
            coverageStartWeek: coverageStartWeek,
            coverageEndWeek: coverageEndWeek,
            ckWeek: ckForThisProjection,
            projectionQty: Math.round(projectionQty),
            frcNumber: `FRC-DYN-${String(projIndex).padStart(2, '0')}`,
            frcWeek: frcWeek,
            frcCoverageStartWeek: frcCoverageStart,
            frcCovarageEndWeek: frcCoverageStart + 3,
            frcQty,
            cutOrderQty,
            pendingCutOrder: frcQty - cutOrderQty,
        });

        projIndex++;
        if (projIndex > 50) keepGoing = false; // Safety break
    }

    return projections;
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

    const totalPoFc = useMemo(() => Object.values(weeklyData).reduce((sum, data) => sum + (data.poFc || 0), 0), [weeklyData]);
    const totalProduced = useMemo(() => Object.values(producedData).reduce((sum, qty) => sum + qty, 0), [producedData]);
    const totalPlan = useMemo(() => Object.values(planData).reduce((sum, qty) => sum + qty, 0), [planData]);


    if (!latestSnapshot) {
        return <div className="p-4 text-muted-foreground">No forecast snapshot data available for the selected week.</div>;
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>Tentative Plan for Snapshot Week {selectedSnapshotWeek}</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="w-[200px] font-bold">Dimension</TableHead>
                            {weeks.map(week => (
                                <TableHead key={week} className="text-right">{week}</TableHead>
                            ))}
                            <TableHead className="text-right font-bold">Total</TableHead>
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
                            <TableCell className="text-right font-bold">
                                {totalPoFc.toLocaleString()}
                            </TableCell>
                        </TableRow>
                        <TableRow>
                            <TableCell className="font-medium">Produced</TableCell>
                            {weeks.map(week => (
                                <TableCell key={week} className="text-right text-green-600 font-semibold">
                                    {(producedData[week] || 0) > 0 ? (producedData[week] || 0).toLocaleString() : '-'}
                                </TableCell>
                            ))}
                            <TableCell className="text-right font-bold text-green-600">
                                {totalProduced > 0 ? totalProduced.toLocaleString() : '-'}
                            </TableCell>
                        </TableRow>
                        <TableRow>
                            <TableCell className="font-medium">Plan</TableCell>
                            {weeks.map(week => (
                                <TableCell key={week} className="text-right font-semibold">
                                    {(planData[week] || 0) > 0 ? (planData[week] || 0).toLocaleString() : '-'}
                                </TableCell>
                            ))}
                             <TableCell className="text-right font-bold">
                                {totalPlan > 0 ? totalPlan.toLocaleString() : '-'}
                            </TableCell>
                        </TableRow>
                         <TableRow>
                            <TableCell className="font-medium">FG CI</TableCell>
                            {weeks.map(week => (
                                <TableCell key={week} className="text-right">
                                    {pciData[week] !== undefined ? pciData[week].toLocaleString() : '-'}
                                </TableCell>
                            ))}
                            <TableCell></TableCell>
                        </TableRow>
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    );
};


function ProjectionAnalysisPageContent() {
    const searchParams = useSearchParams();
    const orderId = searchParams.get('orderId');
    const { orders, isScheduleLoaded } = useSchedule();
    const [projectionDetails, setProjectionDetails] = useState<Projection[]>([]);
    
    const [currentWeek, setCurrentWeek] = useState(0);
    const [selectedSnapshotWeek, setSelectedSnapshotWeek] = useState<number | null>(null);
    const [planData, setPlanData] = useState<Record<string, number>>({});
    const [producedData, setProducedData] = useState<Record<string, number>>({});


    useEffect(() => {
        setCurrentWeek(getWeek(new Date()));
    }, []);

    const order = useMemo(() => {
        if (!isScheduleLoaded || !orderId) return null;
        return orders.find(o => o.id === orderId);
    }, [orderId, orders, isScheduleLoaded]);

     const snapshotOptions = useMemo(() => {
        if (!order?.fcVsFcDetails) return [];
        return [...order.fcVsFcDetails]
            .map(s => s.snapshotWeek)
            .sort((a, b) => b - a);
    }, [order]);

    useEffect(() => {
        if (order && snapshotOptions.length > 0) {
            setSelectedSnapshotWeek(snapshotOptions[0]);
        } else {
            setSelectedSnapshotWeek(null);
        }
        setPlanData({});
        setProducedData({});
    }, [order, snapshotOptions]);
    
    const handleGenerateProjections = () => {
        if (!order || currentWeek === 0) return;
        const projections = generateRollingProjections(order, currentWeek);
        setProjectionDetails(projections);
    };

    const handleRunTentativePlan = () => {
        if (!order || selectedSnapshotWeek === null) return;

        const snapshot = order.fcVsFcDetails?.find(s => s.snapshotWeek === selectedSnapshotWeek);
        if (!snapshot) return;

        const weeklyTotals: Record<string, number> = {};
        const allWeeks = Object.keys(snapshot.forecasts).sort((a, b) => parseInt(a.slice(1)) - parseInt(b.slice(1)));
        allWeeks.forEach(week => {
            const total = snapshot.forecasts[week]?.total;
            weeklyTotals[week] = (total?.po || 0) + (total?.fc || 0);
        });

        const firstPoFcWeekStr = allWeeks.find(w => (weeklyTotals[w] || 0) > 0);
        
        let finalProducedData: Record<string, number> = {};
        let closingInventoryOfPreviousWeek = 0;
        
        if (firstPoFcWeekStr) {
            const firstPoFcWeekNum = parseInt(firstPoFcWeekStr.slice(1));
            const baselineStartWeek = Math.min(selectedSnapshotWeek, firstPoFcWeekNum - 4);

            const baselinePlanResult = runTentativePlanForHorizon(baselineStartWeek, null, weeklyTotals, order, 0);
            const baselinePlan = baselinePlanResult.plan;
            
            let inventory = 0;
            const pastWeeks = allWeeks.filter(w => parseInt(w.slice(1)) < selectedSnapshotWeek);
            
            for (const weekKey of pastWeeks) {
                const supplyThisWeek = baselinePlan[weekKey] || 0;
                const demandThisWeek = weeklyTotals[weekKey] || 0;
                inventory += supplyThisWeek - demandThisWeek;
                
                if (supplyThisWeek > 0) {
                  finalProducedData[weekKey] = supplyThisWeek;
                }
            }
            closingInventoryOfPreviousWeek = inventory;
        }
        
        const currentPlanResult = runTentativePlanForHorizon(selectedSnapshotWeek, null, weeklyTotals, order, closingInventoryOfPreviousWeek);
        
        setProducedData(finalProducedData);
        setPlanData(currentPlanResult.plan);
    };

    if (!isScheduleLoaded) {
        return <div className="flex items-center justify-center h-full">Loading analysis data...</div>;
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
                            <BreadcrumbPage>Projection Analysis</BreadcrumbPage>
                        </BreadcrumbItem>
                    </BreadcrumbList>
                </Breadcrumb>
                 <div className="flex justify-between items-center mb-4 flex-shrink-0">
                    <div>
                        <h1 className="text-2xl font-bold">Projection Analysis for {order.id}</h1>
                        <p className="text-muted-foreground">
                            Style: {order.style} | Buyer: {order.buyer}
                        </p>
                    </div>
                     <div className="flex gap-2">
                        <Button variant="outline" asChild>
                            <Link href="/orders">
                                <ArrowLeft className="mr-2 h-4 w-4" />
                                Back to Orders
                            </Link>
                        </Button>
                        <Button onClick={handleGenerateProjections}>
                            <Zap className="mr-2 h-4 w-4" />
                            Generate Projections
                        </Button>
                    </div>
                </div>
                
                <div className="space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Rolling Projections & FRC</CardTitle>
                        </CardHeader>
                        <CardContent className="p-0">
                            <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Projection No.</TableHead>
                                    <TableHead>Projection Week</TableHead>
                                    <TableHead>Coverage Weeks</TableHead>
                                    <TableHead>CK Week</TableHead>
                                    <TableHead className="text-right">Projection Qty</TableHead>
                                    <TableHead>FRC No.</TableHead>
                                    <TableHead>FRC Week</TableHead>
                                    <TableHead>FRC Coverage Weeks</TableHead>
                                    <TableHead className="text-right">FRC Qty</TableHead>
                                    <TableHead className="text-right">Cut Order Qty</TableHead>
                                    <TableHead className="text-right">Pending Cut Order</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {projectionDetails.map((proj) => (
                                    <TableRow key={proj.projectionNumber}>
                                        <TableCell className="font-medium text-primary">{proj.projectionNumber}</TableCell>
                                        <TableCell>W{proj.projectionWeek}</TableCell>
                                        <TableCell>W{proj.coverageStartWeek} - W{proj.coverageEndWeek}</TableCell>
                                        <TableCell>W{proj.ckWeek}</TableCell>
                                        <TableCell className="text-right font-semibold">{proj.projectionQty.toLocaleString()}</TableCell>
                                        <TableCell className="font-medium">{proj.frcNumber}</TableCell>
                                        <TableCell>W{proj.frcWeek}</TableCell>
                                        <TableCell>W{proj.frcCoverageStartWeek} - W{proj.frcCovarageEndWeek}</TableCell>
                                        <TableCell className="text-right">{proj.frcQty.toLocaleString()}</TableCell>
                                        <TableCell className="text-right">{proj.cutOrderQty.toLocaleString()}</TableCell>
                                        <TableCell className="text-right font-semibold">{proj.pendingCutOrder.toLocaleString()}</TableCell>
                                    </TableRow>
                                ))}
                                {projectionDetails.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={11} className="h-24 text-center text-muted-foreground">
                                            Click "Generate Projections" to create projections based on the tentative plan.
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                            </Table>
                        </CardContent>
                    </Card>

                    <div className="flex items-end gap-2">
                        {snapshotOptions.length > 0 && (
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
                        )}
                        <Button onClick={handleRunTentativePlan}>
                            <Zap className="mr-2 h-4 w-4" />
                            Run Tentative Plan
                        </Button>
                    </div>

                    {(planData && Object.keys(planData).length > 0) || (producedData && Object.keys(producedData).length > 0) ? (
                        <TentativePlanTable order={order} selectedSnapshotWeek={selectedSnapshotWeek} planData={planData} producedData={producedData} />
                    ) : (
                         <div className="text-center text-muted-foreground pt-10">Select a snapshot and click "Run Tentative Plan" to view details.</div>
                    )}
                </div>
            </main>
        </div>
    );
}

export default function ProjectionAnalysisPage() {
    return (
        <Suspense fallback={<div>Loading...</div>}>
            <ProjectionAnalysisPageContent />
        </Suspense>
    );
}
