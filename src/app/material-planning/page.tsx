

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
import type { Order, Size, BomItem } from '@/lib/types';
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


const FrcBreakdownTable = ({ breakdown, coverage }: { breakdown: ProjectionRow['breakdown'], coverage: string }) => {
    if (!breakdown) return null;

    const [startWeekStr, endWeekStr] = coverage.split('-');
    const startWeek = parseInt(startWeekStr.replace('W', ''));
    const endWeek = parseInt(endWeekStr.replace('W', ''));

    const weeks = Object.keys(breakdown).filter(weekKey => {
        const weekNum = parseInt(weekKey.replace('W', ''));
        return weekNum >= startWeek && weekNum <= endWeek;
    });

    const sizeTotals = SIZES.reduce((acc, size) => {
        acc[size] = 0;
        return acc;
    }, {} as Record<Size, number>);

    weeks.forEach(week => {
        SIZES.forEach(size => {
            sizeTotals[size] += breakdown[week as keyof typeof breakdown]?.[size as Size] || 0;
        });
    });

    const grandTotal = Object.values(sizeTotals).reduce((sum, val) => sum + val, 0);

    return (
        <Card className="mt-4">
            <CardHeader>
                <CardTitle>FRC Breakdown</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Week</TableHead>
                            {SIZES.map(size => (
                                <TableHead key={size} className="text-right">{size}</TableHead>
                            ))}
                            <TableHead className="text-right font-bold">Total</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {weeks.map(week => {
                            const weekData = breakdown[week as keyof typeof breakdown];
                            const weekTotal = Object.values(weekData).reduce((s, v) => s + (typeof v === 'number' ? v : 0), 0);
                            return (
                                <TableRow key={week}>
                                    <TableCell className="font-medium">{week}</TableCell>
                                    {SIZES.map(size => (
                                        <TableCell key={`${week}-${size}`} className="text-right">
                                            {(weekData[size as Size] || 0).toLocaleString()}
                                        </TableCell>
                                    ))}
                                    <TableCell className="text-right font-bold">{weekTotal.toLocaleString()}</TableCell>
                                </TableRow>
                            );
                        })}
                    </TableBody>
                    <TableFooter>
                        <TableRow>
                            <TableCell className="font-bold">Total</TableCell>
                            {SIZES.map(size => (
                                <TableCell key={`total-${size}`} className="text-right font-bold">
                                    {(sizeTotals[size] || 0).toLocaleString()}
                                </TableCell>
                            ))}
                            <TableCell className="text-right font-bold">{grandTotal.toLocaleString()}</TableCell>
                        </TableRow>
                    </TableFooter>
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
        const maxLeadTimeDays = Math.max(...projectionBomItems.map(item => item.leadTime), 0);
        const maxLeadTimeWeeks = Math.ceil(maxLeadTimeDays / 7);

        const firstProjectionWeek = firstCkWeek - maxLeadTimeWeeks;

        const projections: ProjectionRow[] = [];
        let currentProjectionWeek = firstProjectionWeek;
        let projectionIndex = 1;

        while (currentProjectionWeek < 52) {
            const currentCkWeek = currentProjectionWeek + maxLeadTimeWeeks;
            const coverageStart = currentCkWeek + 1;
            const coverageEnd = currentCkWeek + 4;
            
            let projectionQty = 0;
            for (let w = coverageStart; w <= coverageEnd; w++) {
                projectionQty += plan[`W${w}`] || 0;
            }

            if (projectionQty > 0 || projections.length > 0) {
                 projections.push({
                    prjNumber: `PRJ-${order.ocn}-${projectionIndex.toString().padStart(2, '0')}`,
                    prjWeek: `W${currentProjectionWeek}`,
                    prjCoverage: `W${coverageStart}-W${coverageEnd}`,
                    ckWeek: `W${currentCkWeek}`,
                    prjQty: Math.round(projectionQty),
                    // Dummy data for now
                    frcNumber: `FRC-${order.ocn}-${projectionIndex.toString().padStart(2, '0')}`,
                    frcWeek: `W${currentProjectionWeek + 2}`,
                    frcCoverage: `W${coverageStart}-W${coverageEnd + 2}`, // Example dummy coverage
                    frcQty: Math.round(projectionQty * 0.8),
                    cutOrderQty: Math.round(projectionQty * 0.7),
                    cutOrderPending: Math.round(projectionQty * 0.1),
                    breakdown: {} // will be filled with dummy data
                });
                projectionIndex++;
            }
            
            if (Object.keys(plan).filter(w => parseInt(w.slice(1)) > coverageEnd).length === 0) break;

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
                                        <TableCell className="text-right font-bold">{projectionTotals.frcQty.toLocaleString()}</TableCell>
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
