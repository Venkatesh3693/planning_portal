

'use client';

import { Suspense, useMemo, useState } from 'react';
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
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableFooter,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { SIZES } from '@/lib/data';
import type { Order, Size, BomItem, FcSnapshot, SizeBreakdown } from '@/lib/types';
import { runTentativePlanForHorizon } from '@/lib/tna-calculator';


type ProjectionRow = {
    prjNumber: string;
    prjWeek: string;
    prjCoverage: string;
    ckWeek: string;
    prjQty: number;
    frcNumber: string;
    frcWeek: string;
    frcCoverage: string;
    frcQty: number;
    cutOrderQty: number;
    cutOrderPending: number;
    breakdown?: Record<string, Record<Size, number> & { total: number }>;
};


const FrcBreakdownTable = ({ breakdown, coverage }: { breakdown?: ProjectionRow['breakdown'], coverage: string }) => {
    if (!breakdown || Object.keys(breakdown).length === 0) {
        return (
            <Card className="mt-4">
                <CardHeader>
                    <CardTitle>FRC Breakdown</CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-muted-foreground">No size breakdown available for this FRC. This may be due to missing forecast snapshot data for the calculated FRC week.</p>
                </CardContent>
            </Card>
        );
    }
    
    const breakdownData = breakdown['FRC'];
    if (!breakdownData) return null;


    return (
        <Card className="mt-4">
            <CardHeader>
                <CardTitle>FRC Breakdown for {coverage}</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Breakdown</TableHead>
                            {SIZES.map(size => (
                                <TableHead key={size} className="text-right">{size}</TableHead>
                            ))}
                            <TableHead className="text-right font-bold">Total</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        <TableRow>
                            <TableCell className="font-medium">Quantity</TableCell>
                            {SIZES.map(size => (
                               <TableCell key={size} className="text-right">
                                    {(breakdownData[size] || 0).toLocaleString()}
                                </TableCell>
                            ))}
                            <TableCell className="text-right font-bold">
                                {(breakdownData.total || 0).toLocaleString()}
                            </TableCell>
                        </TableRow>
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    );
};

const AllFrcBreakdownTable = ({ projectionData }: { projectionData: ProjectionRow[] }) => {
    if (!projectionData || projectionData.length === 0) return null;
    return (
        <Card className="mt-4">
            <CardHeader>
                <CardTitle>FRC Breakdown Summary</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>PRJ#</TableHead>
                            <TableHead>FRC#</TableHead>
                            <TableHead>FRC Week</TableHead>
                            <TableHead>CK Week</TableHead>
                            <TableHead>FRC Coverage</TableHead>
                            {SIZES.map(size => (
                                <TableHead key={size} className="text-right">{size}</TableHead>
                            ))}
                            <TableHead className="text-right font-bold">Total FRC Qty</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {projectionData.map((row) => (
                           <TableRow key={row.frcNumber}>
                               <TableCell>{row.prjNumber}</TableCell>
                               <TableCell>{row.frcNumber}</TableCell>
                               <TableCell>{row.frcWeek}</TableCell>
                               <TableCell>{row.ckWeek}</TableCell>
                               <TableCell>{row.frcCoverage}</TableCell>
                               {SIZES.map(size => (
                                    <TableCell key={size} className="text-right">
                                        {(row.breakdown?.['FRC']?.[size] || 0).toLocaleString()}
                                    </TableCell>
                                ))}
                               <TableCell className="text-right font-bold">{row.frcQty.toLocaleString()}</TableCell>
                           </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    );
};


function MaterialPlanningPageContent() {
    const searchParams = useSearchParams();
    const orderIdFromUrl = searchParams.get('orderId');
    const { orders, isScheduleLoaded } = useSchedule();
    const [selectedFrc, setSelectedFrc] = useState<ProjectionRow | null>(null);
    const [showFrcSummary, setShowFrcSummary] = useState(false);
    
    const order = useMemo(() => {
        if (!isScheduleLoaded || !orderIdFromUrl) return null;
        return orders.find(o => o.id === orderIdFromUrl);
    }, [orderIdFromUrl, orders, isScheduleLoaded]);

    const projectionData = useMemo(() => {
        if (!order || !order.fcVsFcDetails || order.fcVsFcDetails.length === 0) {
            return [];
        }

        const firstSnapshot = order.fcVsFcDetails.reduce((earliest, current) => 
            earliest.snapshotWeek < current.snapshotWeek ? earliest : current
        );

        const weeklyTotals: Record<string, number> = {};
        Object.entries(firstSnapshot.forecasts).forEach(([week, data]) => {
            weeklyTotals[week] = (data.total?.po || 0) + (data.total?.fc || 0);
        });

        const { plan } = runTentativePlanForHorizon(firstSnapshot.snapshotWeek, null, weeklyTotals, order, 0);
        
        const planWeeks = Object.keys(plan).map(w => parseInt(w.slice(1))).sort((a, b) => a - b);
        const firstProductionWeek = planWeeks.find(w => plan[`W${w}`] > 0);

        if (!firstProductionWeek) return [];

        const firstCkWeek = firstProductionWeek - 1;
        
        const projectionBomItems = (order.bom || []).filter(item => item.forecastType === 'Projection');
        const maxPrjLeadTimeWeeks = Math.ceil(Math.max(...projectionBomItems.map(item => item.leadTime), 0) / 7);
        const frcBomItems = (order.bom || []).filter(item => item.forecastType === 'FRC');
        const maxFrcLeadTimeWeeks = Math.ceil(Math.max(...frcBomItems.map(item => item.leadTime), 0) / 7);

        const firstProjectionWeek = firstCkWeek - maxPrjLeadTimeWeeks;

        const projections: ProjectionRow[] = [];
        let currentProjectionWeek = firstProjectionWeek;
        let projectionIndex = 1;
        
        let cumulativeFrcBreakdown: Partial<Record<Size, number>> = {};

        while (currentProjectionWeek < 52) {
            const currentCkWeek = currentProjectionWeek + maxPrjLeadTimeWeeks;
            const coverageStart = currentCkWeek + 1;
            const coverageEnd = currentCkWeek + 4;
            
            let projectionQty = 0;
            for (let w = coverageStart; w <= coverageEnd; w++) {
                projectionQty += plan[`W${w}`] || 0;
            }
            
            projectionQty = Math.round(projectionQty);

            if (projectionQty <= 0 && projections.length === 0) {
                currentProjectionWeek += 4;
                continue;
            }

            // --- FRC Calculation ---
            const frcWeekNum = currentCkWeek - maxFrcLeadTimeWeeks;
            const frcWeek = `W${frcWeekNum}`;
            const targetFrcQty = projectionQty;
            
            let frcCoverage = '-';
            let frcBreakdown: ProjectionRow['breakdown'] = {};
            
            const snapshotForFrc = order.fcVsFcDetails.find(s => s.snapshotWeek === frcWeekNum);
            
            if (snapshotForFrc) {
                const poFcWeeks = Object.keys(snapshotForFrc.forecasts).sort((a, b) => parseInt(a.slice(1)) - parseInt(b.slice(1)));
                const firstPoFcWeek = poFcWeeks.find(w => (snapshotForFrc.forecasts[w].total?.po || 0) + (snapshotForFrc.forecasts[w].total?.fc || 0) > 0);

                if (firstPoFcWeek) {
                    const cumulativeTarget = Object.values(projections).reduce((sum, p) => sum + p.prjQty, 0) + projectionQty;
                    let runningTotal = 0;
                    let endCoverageWeek = '';
                    const newCumulativeBreakdown: Partial<Record<Size, number>> = {};
                    let targetMet = false;

                    for (const week of poFcWeeks) {
                        if (targetMet) break; // Check flag at the start of the outer loop
                        if (parseInt(week.slice(1)) < parseInt(firstPoFcWeek.slice(1))) continue;

                        for (const size of SIZES) {
                            const demand = snapshotForFrc.forecasts[week]?.[size];
                            const qty = (demand?.po || 0) + (demand?.fc || 0);
                            
                            if (runningTotal + qty >= cumulativeTarget) {
                                const needed = cumulativeTarget - runningTotal;
                                newCumulativeBreakdown[size] = (newCumulativeBreakdown[size] || 0) + needed;
                                runningTotal += needed;
                                endCoverageWeek = week;
                                targetMet = true;
                                break; 
                            } else {
                                runningTotal += qty;
                                newCumulativeBreakdown[size] = (newCumulativeBreakdown[size] || 0) + qty;
                            }
                        }
                    }
                    
                    if (endCoverageWeek) {
                        frcCoverage = `${firstPoFcWeek}-${endCoverageWeek}`;
                        
                        const currentFrcBreakdown: Partial<Record<Size, number>> = {};
                        let totalInBreakdown = 0;
                        for (const size of SIZES) {
                            const newlyAdded = (newCumulativeBreakdown[size] || 0) - (cumulativeFrcBreakdown[size] || 0);
                            currentFrcBreakdown[size] = newlyAdded;
                            totalInBreakdown += newlyAdded;
                        }

                        const adjustment = targetFrcQty - totalInBreakdown;
                        if (adjustment !== 0) {
                            const lastSizeWithQty = [...SIZES].reverse().find(s => (currentFrcBreakdown[s] || 0) > 0);
                            if(lastSizeWithQty) currentFrcBreakdown[lastSizeWithQty] = (currentFrcBreakdown[lastSizeWithQty] || 0) + adjustment;
                        }
                        
                        frcBreakdown = { 'FRC': { ...currentFrcBreakdown, total: targetFrcQty } as any };
                        cumulativeFrcBreakdown = newCumulativeBreakdown;
                    }
                }
            }
            // --- End FRC Calculation ---

            projections.push({
                prjNumber: `PRJ-${order.ocn}-${projectionIndex.toString().padStart(2, '0')}`,
                prjWeek: `W${currentProjectionWeek}`,
                prjCoverage: `W${coverageStart}-W${coverageEnd}`,
                ckWeek: `W${currentCkWeek}`,
                prjQty: projectionQty,
                frcNumber: `FRC-${order.ocn}-${projectionIndex.toString().padStart(2, '0')}`,
                frcWeek: frcWeek,
                frcCoverage: frcCoverage,
                frcQty: targetFrcQty,
                cutOrderQty: Math.round(targetFrcQty * 0.7), // Dummy
                cutOrderPending: Math.round(targetFrcQty * 0.1), // Dummy
                breakdown: frcBreakdown
            });
            projectionIndex++;
            
            const hasMorePlan = Object.keys(plan).some(w => parseInt(w.slice(1)) > coverageEnd && plan[w] > 0);
            if (!hasMorePlan || currentProjectionWeek > 52) break;

            currentProjectionWeek += 4;
        }

        return projections;
    }, [order]);

    const projectionTotals = useMemo(() => {
        return projectionData.reduce(
            (acc, row) => {
                acc.prjQty += row.prjQty;
                acc.frcQty += row.frcQty;
                acc.cutOrderQty += row.cutOrderQty;
                acc.cutOrderPending += row.cutOrderPending;
                return acc;
            },
            { prjQty: 0, frcQty: 0, cutOrderQty: 0, cutOrderPending: 0 }
        );
    }, [projectionData]);


    const handleFrcClick = (frcItem: ProjectionRow) => {
        setSelectedFrc(prev => prev?.prjNumber === frcItem.prjNumber ? null : frcItem);
    };

    if (!isScheduleLoaded) {
        return <div className="flex items-center justify-center h-full">Loading data...</div>;
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
                            <BreadcrumbPage>Material Planning</BreadcrumbPage>
                        </BreadcrumbItem>
                    </BreadcrumbList>
                </Breadcrumb>
                 <div className="flex justify-between items-center mb-4 flex-shrink-0">
                    <div>
                        <h1 className="text-2xl font-bold">Material Planning for {order.id}</h1>
                        <p className="text-muted-foreground">
                            Style: {order.style} | Buyer: {order.buyer}
                        </p>
                    </div>
                    <Button variant="outline" asChild>
                        <Link href="/orders">
                            <ArrowLeft className="mr-2 h-4 w-4" />
                            Back to Orders
                        </Link>
                    </Button>
                </div>
                
                <Card>
                    <CardContent className="p-0">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>PRJ#</TableHead>
                                    <TableHead>Projection week</TableHead>
                                    <TableHead>PRJ Coverage weeks</TableHead>
                                    <TableHead>CK Week</TableHead>
                                    <TableHead className="text-right">Projection Qty</TableHead>
                                    <TableHead>FRC #</TableHead>
                                    <TableHead>FRC Week</TableHead>
                                    <TableHead>FRC Coverage weeks</TableHead>
                                    <TableHead className="text-right">FRC Qty</TableHead>
                                    <TableHead className="text-right">Cut Order Qty</TableHead>
                                    <TableHead className="text-right">Cut Order pending</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {projectionData.length > 0 ? projectionData.map((row) => (
                                    <TableRow key={row.prjNumber}>
                                        <TableCell className="font-medium">{row.prjNumber}</TableCell>
                                        <TableCell>{row.prjWeek}</TableCell>
                                        <TableCell>{row.prjCoverage}</TableCell>
                                        <TableCell>{row.ckWeek}</TableCell>
                                        <TableCell className="text-right">{row.prjQty.toLocaleString()}</TableCell>
                                        <TableCell>{row.frcNumber}</TableCell>
                                        <TableCell>{row.frcWeek}</TableCell>
                                        <TableCell>{row.frcCoverage}</TableCell>
                                        <TableCell className="text-right">
                                            <span 
                                                className="font-medium text-primary cursor-pointer hover:underline"
                                                onClick={() => handleFrcClick(row)}
                                            >
                                                {row.frcQty.toLocaleString()}
                                            </span>
                                        </TableCell>
                                        <TableCell className="text-right">{row.cutOrderQty.toLocaleString()}</TableCell>
                                        <TableCell className="text-right">{row.cutOrderPending.toLocaleString()}</TableCell>
                                    </TableRow>
                                )) : (
                                    <TableRow>
                                        <TableCell colSpan={11} className="h-24 text-center">
                                            No projection data available for this order.
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                            {projectionData.length > 0 && (
                                <TableFooter>
                                    <TableRow>
                                        <TableCell colSpan={4} className="font-bold text-right">Total</TableCell>
                                        <TableCell className="text-right font-bold">{projectionTotals.prjQty.toLocaleString()}</TableCell>
                                        <TableCell colSpan={3}></TableCell>
                                        <TableCell className="text-right font-bold">
                                            <span
                                                className="font-medium text-primary cursor-pointer hover:underline"
                                                onClick={() => setShowFrcSummary(prev => !prev)}
                                            >
                                                {projectionTotals.frcQty.toLocaleString()}
                                            </span>
                                        </TableCell>
                                        <TableCell className="text-right font-bold">{projectionTotals.cutOrderQty.toLocaleString()}</TableCell>
                                        <TableCell className="text-right font-bold">{projectionTotals.cutOrderPending.toLocaleString()}</TableCell>
                                    </TableRow>
                                </TableFooter>
                            )}
                        </Table>
                    </CardContent>
                </Card>

                {selectedFrc && (
                    <FrcBreakdownTable breakdown={selectedFrc.breakdown} coverage={selectedFrc.frcCoverage} />
                )}

                {showFrcSummary && (
                    <AllFrcBreakdownTable projectionData={projectionData} />
                )}
            </main>
        </div>
    );
}

export default function MaterialPlanningPage() {
    return (
        <Suspense fallback={<div>Loading...</div>}>
            <MaterialPlanningPageContent />
        </Suspense>
    );
}



    
