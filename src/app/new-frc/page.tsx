
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
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { runTentativePlanForHorizon } from '@/lib/tna-calculator';
import type { ProjectionRow, Size, Order, SizeBreakdown } from '@/lib/types';
import { getWeek } from 'date-fns';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell, TableFooter as TableFoot } from '@/components/ui/table';
import { SIZES } from '@/lib/data';

function NewFrcForm({ orderId }: { orderId: string }) {
    const { orders, isScheduleLoaded } = useSchedule();
    const [projections, setProjections] = useState<ProjectionRow[]>([]);
    const [selectedPrjNumber, setSelectedPrjNumber] = useState<string>('');
    const [selectedFrcWeek, setSelectedFrcWeek] = useState<number | null>(null);
    const [frcBreakdown, setFrcBreakdown] = useState<{ coverage: string; weeklyBreakdown: Record<string, SizeBreakdown> } | null>(null);


    const order = useMemo(() => {
        if (!isScheduleLoaded) return null;
        return orders.find(o => o.id === orderId);
    }, [orderId, orders, isScheduleLoaded]);

    const maxFrcLeadTimeWeeks = useMemo(() => {
        if (!order || !order.bom) return 0;
        const frcComponents = order.bom.filter(item => item.forecastType === 'FRC');
        const maxLeadTimeDays = Math.max(...frcComponents.map(item => item.leadTime), 0);
        return Math.ceil(maxLeadTimeDays / 7);
    }, [order]);

    const availableFrcWeeks = useMemo(() => {
        if (!order?.fcVsFcDetails) return [];
        const allWeeks = new Set<number>();
        order.fcVsFcDetails.forEach(snapshot => {
            allWeeks.add(snapshot.snapshotWeek);
        });
        return Array.from(allWeeks).sort((a,b) => a - b);
    }, [order]);


    useEffect(() => {
        if (!order || !order.fcVsFcDetails || order.fcVsFcDetails.length === 0) {
            setProjections([]);
            return;
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

        if (!firstProductionWeek) {
            setProjections([]);
            return;
        }

        const firstCkWeek = firstProductionWeek - 1;
        const projectionBomItems = (order.bom || []).filter(item => item.forecastType === 'Projection');
        const maxPrjLeadTimeWeeks = Math.ceil(Math.max(...projectionBomItems.map(item => item.leadTime), 0) / 7);
        const firstProjectionWeek = firstCkWeek - maxPrjLeadTimeWeeks;

        const calculatedProjections: ProjectionRow[] = [];
        let currentProjectionWeek = firstProjectionWeek;
        let projectionIndex = 1;

        while (currentProjectionWeek < 52) {
            const currentCkWeek = currentProjectionWeek + maxPrjLeadTimeWeeks;
            const coverageStart = currentCkWeek + 1;
            const coverageEnd = currentCkWeek + 4;
            
            let projectionQty = 0;
            for (let w = coverageStart; w <= coverageEnd; w++) {
                projectionQty += plan[`W${w}`] || 0;
            }
            
            projectionQty = Math.round(projectionQty);

            if (projectionQty > 0) {
                calculatedProjections.push({
                    prjNumber: `PRJ-${order.ocn}-${projectionIndex.toString().padStart(2, '0')}`,
                    prjWeek: `W${currentProjectionWeek}`,
                    prjCoverage: `W${coverageStart}-W${coverageEnd}`,
                    ckWeek: `W${currentCkWeek}`,
                    prjQty: projectionQty,
                    frcNumber: '',
                    frcWeek: '',
                    frcCoverage: '',
                    frcQty: 0,
                    cutOrderQty: 0,
                    cutOrderPending: 0
                });
            }

            projectionIndex++;
            const hasMorePlan = Object.keys(plan).some(w => parseInt(w.slice(1)) > coverageEnd && plan[w] > 0);
            if (!hasMorePlan || currentProjectionWeek > 52) break;

            currentProjectionWeek += 4;
        }

        setProjections(calculatedProjections);
        if (calculatedProjections.length > 0) {
            setSelectedPrjNumber(calculatedProjections[0].prjNumber);
        }

    }, [order]);
    
    const selectedProjection = useMemo(() => {
        return projections.find(p => p.prjNumber === selectedPrjNumber);
    }, [selectedPrjNumber, projections]);

    useEffect(() => {
        if(selectedProjection) {
            const ckWeekNum = parseInt(selectedProjection.ckWeek.replace('W', ''), 10);
            const frcWeekNum = ckWeekNum - maxFrcLeadTimeWeeks;
            if(availableFrcWeeks.includes(frcWeekNum)){
                setSelectedFrcWeek(frcWeekNum);
            } else if (availableFrcWeeks.length > 0) {
                const closest = availableFrcWeeks.reduce((prev, curr) => 
                  (Math.abs(curr - frcWeekNum) < Math.abs(prev - frcWeekNum) ? curr : prev)
                );
                setSelectedFrcWeek(closest);
            }
        }
    }, [selectedProjection, maxFrcLeadTimeWeeks, availableFrcWeeks]);

     useEffect(() => {
        if (!selectedProjection || !selectedFrcWeek || !order?.fcVsFcDetails) {
            setFrcBreakdown(null);
            return;
        }

        const snapshotForFrc = order.fcVsFcDetails.find(s => s.snapshotWeek === selectedFrcWeek);
        if (!snapshotForFrc) {
            setFrcBreakdown(null);
            return;
        }
        
        const coverageStartWeekNum = selectedFrcWeek + maxFrcLeadTimeWeeks + 1;
        
        const poFcWeeks = Object.keys(snapshotForFrc.forecasts)
            .sort((a, b) => parseInt(a.slice(1)) - parseInt(b.slice(1)))
            .filter(w => parseInt(w.slice(1)) >= coverageStartWeekNum);

        if (poFcWeeks.length === 0) {
            setFrcBreakdown(null);
            return;
        }

        const coverageStartWeekStr = poFcWeeks[0];
        let cumulativeQty = 0;
        let endCoverageWeek = '';
        const weeklyBreakdown: Record<string, SizeBreakdown> = {};

        for (const week of poFcWeeks) {
            if (cumulativeQty >= selectedProjection.prjQty) break;

            const weeklyDemand: SizeBreakdown = { total: 0 };
            SIZES.forEach(s => weeklyDemand[s] = 0);
            
            const weekForecast = snapshotForFrc.forecasts[week];
            if (!weekForecast) continue;
            
            for (const size of SIZES) {
                const demand = (weekForecast[size]?.po || 0) + (weekForecast[size]?.fc || 0);

                if (cumulativeQty + demand >= selectedProjection.prjQty) {
                    const needed = selectedProjection.prjQty - cumulativeQty;
                    weeklyDemand[size] = (weeklyDemand[size] || 0) + needed;
                    weeklyDemand.total += needed;
                    cumulativeQty += needed;
                    endCoverageWeek = week;
                    break;
                } else {
                    weeklyDemand[size] = (weeklyDemand[size] || 0) + demand;
                    weeklyDemand.total += demand;
                    cumulativeQty += demand;
                }
            }
            
            if(weeklyDemand.total > 0) {
                 weeklyBreakdown[week] = weeklyDemand;
            }
            if (cumulativeQty >= selectedProjection.prjQty) {
                if (!endCoverageWeek) endCoverageWeek = week;
                break;
            }
        }
        
        if (Object.keys(weeklyBreakdown).length > 0) {
            setFrcBreakdown({
                coverage: `${coverageStartWeekStr}-${endCoverageWeek}`,
                weeklyBreakdown: weeklyBreakdown,
            });
        } else {
            setFrcBreakdown(null);
        }

    }, [selectedProjection, selectedFrcWeek, order, maxFrcLeadTimeWeeks]);
    
    const breakdownTotals = useMemo(() => {
        if (!frcBreakdown) return null;
        const totals: SizeBreakdown = { total: 0 };
        SIZES.forEach(s => totals[s] = 0);

        Object.values(frcBreakdown.weeklyBreakdown).forEach(weeklyData => {
            SIZES.forEach(s => {
                totals[s] = (totals[s] || 0) + (weeklyData[s] || 0);
            });
            totals.total += weeklyData.total;
        });
        return totals;
    }, [frcBreakdown]);

    const frcNumber = useMemo(() => {
        if (!selectedProjection) return '';
        return selectedProjection.prjNumber.replace('PRJ-', 'FRC-');
    }, [selectedProjection]);

    if (!order) {
        return (
            <div className="flex-1 rounded-lg border border-dashed shadow-sm flex items-center justify-center">
                <p className="text-muted-foreground">Order data could not be loaded.</p>
            </div>
        );
    }
    
    return (
        <div className="space-y-6">
            <Card>
                <CardContent className="p-6 space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 items-end">
                        <div className="space-y-2">
                            <Label>FRC #</Label>
                            <p className="font-semibold text-lg">{frcNumber || 'N/A'}</p>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="projection-select">Projection #</Label>
                            <Select value={selectedPrjNumber} onValueChange={setSelectedPrjNumber}>
                                <SelectTrigger id="projection-select" className="w-[250px]">
                                    <SelectValue placeholder="Select a projection" />
                                </SelectTrigger>
                                <SelectContent>
                                    {projections.map(proj => (
                                        <SelectItem key={proj.prjNumber} value={proj.prjNumber}>
                                            {proj.prjNumber} ({proj.prjCoverage})
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                         <div className="space-y-2">
                            <Label htmlFor="frc-week-select">FRC Week</Label>
                            <Select
                                value={selectedFrcWeek !== null ? String(selectedFrcWeek) : ''}
                                onValueChange={(val) => setSelectedFrcWeek(Number(val))}
                            >
                                <SelectTrigger id="frc-week-select" className="w-[180px]">
                                    <SelectValue placeholder="Select FRC Week" />
                                </SelectTrigger>
                                <SelectContent>
                                    {availableFrcWeeks.map(week => (
                                        <SelectItem key={week} value={String(week)}>
                                            W{week}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                         <div className="space-y-2">
                            <Label>Max Lead Time (FRC)</Label>
                            <p className="font-semibold text-lg">{maxFrcLeadTimeWeeks} weeks</p>
                        </div>
                        {selectedProjection && (
                            <div className="space-y-2">
                                <Label>Projection Quantity</Label>
                                <p className="font-semibold text-lg">{selectedProjection.prjQty.toLocaleString()}</p>
                            </div>
                        )}
                    </div>
                </CardContent>
                <CardFooter className="flex justify-end">
                    <Button disabled={!selectedProjection}>Save FRC</Button>
                </CardFooter>
            </Card>

            {frcBreakdown && breakdownTotals && (
                <Card>
                    <CardContent className="p-6">
                        <h3 className="text-lg font-semibold mb-2">FRC Breakdown for {frcBreakdown.coverage}</h3>
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
                                {Object.entries(frcBreakdown.weeklyBreakdown).map(([week, breakdown]) => (
                                    <TableRow key={week}>
                                        <TableCell className="font-medium">{week}</TableCell>
                                        {SIZES.map(size => (
                                            <TableCell key={size} className="text-right">
                                                {(breakdown[size] || 0).toLocaleString()}
                                            </TableCell>
                                        ))}
                                        <TableCell className="text-right font-bold">
                                            {(breakdown.total || 0).toLocaleString()}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                            <TableFoot>
                                <TableRow>
                                    <TableCell className="font-bold">Total</TableCell>
                                    {SIZES.map(size => (
                                        <TableCell key={size} className="text-right font-bold">
                                            {(breakdownTotals[size] || 0).toLocaleString()}
                                        </TableCell>
                                    ))}
                                    <TableCell className="text-right font-bold">
                                        {breakdownTotals.total.toLocaleString()}
                                    </TableCell>
                                </TableRow>
                            </TableFoot>
                        </Table>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}


function NewFrcPageContent() {
    const searchParams = useSearchParams();
    const orderId = searchParams.get('orderId');

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
                             <BreadcrumbLink asChild>
                                <Link href={`/material-planning?orderId=${orderId}`}>Material Planning</Link>
                            </BreadcrumbLink>
                        </BreadcrumbItem>
                        <BreadcrumbSeparator />
                        <BreadcrumbItem>
                            <BreadcrumbPage>New FRC</BreadcrumbPage>
                        </BreadcrumbItem>
                    </BreadcrumbList>
                </Breadcrumb>

                 <div className="flex justify-between items-center mb-4 flex-shrink-0">
                    <div>
                        <h1 className="text-2xl font-bold">Create New FRC</h1>
                        {orderId && (
                            <p className="text-muted-foreground">
                                For Order ID: {orderId}
                            </p>
                        )}
                    </div>
                     <Button variant="outline" asChild>
                        <Link href={`/material-planning?orderId=${orderId}`}>
                            <ArrowLeft className="mr-2 h-4 w-4" />
                            Back to Material Planning
                        </Link>
                    </Button>
                </div>
                
                {orderId ? (
                   <NewFrcForm orderId={orderId} />
                ) : (
                     <div className="flex-1 rounded-lg border border-dashed shadow-sm flex items-center justify-center">
                        <p className="text-muted-foreground">No Order ID specified.</p>
                    </div>
                )}
            </main>
        </div>
    );
}

export default function NewFrcPage() {
    return (
        <Suspense fallback={<div className="flex h-screen w-full items-center justify-center">Loading...</div>}>
            <NewFrcPageContent />
        </Suspense>
    );
}

    