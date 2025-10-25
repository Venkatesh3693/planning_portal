
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
import { Card, CardContent } from '@/components/ui/card';
import { getWeek } from 'date-fns';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Zap } from 'lucide-react';
import type { Order } from '@/lib/types';
import { SIZES } from '@/lib/data';
import { runTentativePlanForHorizon } from '@/lib/tna-calculator';


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


function ProjectionAnalysisPageContent() {
    const searchParams = useSearchParams();
    const orderId = searchParams.get('orderId');
    const { orders, isScheduleLoaded } = useSchedule();
    const [projectionDetails, setProjectionDetails] = useState<Projection[]>([]);
    
    const [currentWeek, setCurrentWeek] = useState(0);

    useEffect(() => {
        setCurrentWeek(getWeek(new Date()));
    }, []);

    const order = useMemo(() => {
        if (!isScheduleLoaded || !orderId) return null;
        return orders.find(o => o.id === orderId);
    }, [orderId, orders, isScheduleLoaded]);
    
    const handleGenerateProjections = () => {
        if (!order || currentWeek === 0) return;
        const projections = generateRollingProjections(order, currentWeek);
        setProjectionDetails(projections);
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
                            Generate
                        </Button>
                    </div>
                </div>
                
                <Card>
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
                                        Click "Generate" to create projections based on the tentative plan.
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                        </Table>
                    </CardContent>
                </Card>
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
