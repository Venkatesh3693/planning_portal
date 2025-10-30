

'use client';

import React, { Suspense, useMemo, useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
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
import type { Order } from '@/lib/types';
import CcPlanTable from '@/components/cc-plan/plan-table';
import { CcProdPlanner, calculateFgoiForSingleScenario } from '@/lib/tna-calculator';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';

const ModelWisePlanTable = ({ planResult }: { planResult: any }) => {
    const { allWeeks, modelWiseDemand } = planResult;
    const models = Object.keys(modelWiseDemand || {});

    if (!models || models.length === 0) {
        return null;
    }

    return (
        <div className="mt-8">
            <h2 className="text-xl font-bold mb-4">Model-wise Plan</h2>
            <Card>
                <CardContent className="p-0">
                    <div className="overflow-x-auto">
                        <Table className="whitespace-nowrap">
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="sticky left-0 z-20 bg-muted w-[200px]">Color / Metric</TableHead>
                                    {allWeeks.map((week: string) => (
                                        <TableHead key={week} className="text-center">{week}</TableHead>
                                    ))}
                                    <TableHead className="sticky right-0 z-20 bg-muted text-center font-bold w-[120px]">Total / Min</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {models.map((modelName, modelIndex) => {
                                    const weeklyDemand = planResult.modelWiseDemand[modelName] || {};
                                    const poFcTotal = Object.values(weeklyDemand).reduce((sum: number, val: any) => sum + val, 0);

                                    const producedQty: Record<string, number> = {};
                                    const planQty: Record<string, number> = {};
                                    const fgoiData = calculateFgoiForSingleScenario(allWeeks, weeklyDemand, planQty, producedQty, 0);
                                    const fgOiMin = useMemo(() => {
                                        const fgoiValues = Object.values(fgoiData);
                                        return fgoiValues.length > 0 ? Math.min(...fgoiValues) : 0;
                                    }, [fgoiData]);
                                    
                                    const metrics = [
                                        { name: 'PO + FC', data: weeklyDemand, total: poFcTotal },
                                        { name: 'Produced Qty', data: {}, total: 0 },
                                        { name: 'Plan Qty', data: {}, total: 0 },
                                        { name: 'FG OI', data: fgoiData, total: fgOiMin, isMin: true },
                                    ];

                                    return (
                                        <React.Fragment key={modelName}>
                                            {metrics.map((metric, metricIndex) => (
                                                 <TableRow key={`${modelName}-${metric.name}`} className={modelIndex > 0 && metricIndex === 0 ? 'border-t-4 border-border' : ''}>
                                                    <TableCell className={cn("sticky left-0 z-10 font-medium", metricIndex > 0 ? 'bg-muted/50' : 'bg-background')}>
                                                        {metricIndex === 0 ? (
                                                          <div className='font-semibold'>{modelName}</div>
                                                        ) : (
                                                          <div className='pl-4'>{metric.name}</div>
                                                        )}
                                                         {metricIndex === 0 && <div className='text-xs font-normal text-muted-foreground pl-4'>{metric.name}</div>}
                                                    </TableCell>
                                                    {allWeeks.map((week: string) => (
                                                        <TableCell key={`${week}-${metric.name}`} className={cn("text-center", metric.name === 'FG OI' && (metric.data[week] || 0) < 0 && 'text-destructive font-semibold')}>
                                                          { (metric.data[week] !== undefined && metric.data[week] !== 0)
                                                            ? (metric.isMin ? Math.round(metric.data[week]) : metric.data[week]).toLocaleString() 
                                                            : '-'
                                                          }
                                                        </TableCell>
                                                    ))}
                                                     <TableCell className={cn("sticky right-0 z-10 text-center font-bold", metricIndex > 0 ? 'bg-muted/50' : 'bg-background', metric.name === 'FG OI' && (metric.total || 0) < 0 && 'text-destructive')}>
                                                        {metric.isMin ? Math.round(metric.total).toLocaleString() : metric.total.toLocaleString()}
                                                    </TableCell>
                                                 </TableRow>
                                            ))}
                                        </React.Fragment>
                                    );
                                })}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
};


function CcPlanPageContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const selectedCc = searchParams.get('cc');
    const [selectedSnapshotWeek, setSelectedSnapshotWeek] = useState<number | null>(null);

    const { orders, isScheduleLoaded, appMode } = useSchedule();
    
    const ccOptions = useMemo(() => {
        if (!isScheduleLoaded) return [];
        const ccSet = new Set<string>();
        orders.forEach(o => {
            if (o.orderType === 'Forecasted' && o.ocn) {
                ccSet.add(o.ocn);
            }
        });
        return Array.from(ccSet).sort();
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
        return Array.from(weekSet).sort((a,b) => b-a); // descending
    }, [ordersForCc]);
    
    useEffect(() => {
        if (selectedCc && snapshotOptions.length > 0) {
            const latestSnapshot = snapshotOptions[0];
            if (selectedSnapshotWeek !== latestSnapshot) {
                setSelectedSnapshotWeek(latestSnapshot);
            }
        } else {
            setSelectedSnapshotWeek(null);
        }
    }, [selectedCc, snapshotOptions]);

    const handleCcChange = (cc: string) => {
        router.push(`/cc-plan?cc=${cc}`);
    };

    const planData = useMemo(() => {
        if (!selectedCc || !selectedSnapshotWeek || ordersForCc.length === 0) {
            return null;
        }
        return CcProdPlanner({
            ordersForCc: ordersForCc,
            snapshotWeek: selectedSnapshotWeek,
            producedData: {}, // Passing empty for now as per logic
        });
    }, [selectedCc, selectedSnapshotWeek, ordersForCc]);

    if (appMode === 'gup') {
        return (
            <div className="flex h-screen flex-col">
              <Header />
              <main className="flex-1 p-4 sm:p-6 lg:p-8 flex items-center justify-center">
                <div className="text-center">
                  <h2 className="text-xl font-semibold">CC Plan Not Available</h2>
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
                            <BreadcrumbPage>CC Plan</BreadcrumbPage>
                        </BreadcrumbItem>
                    </BreadcrumbList>
                </Breadcrumb>

                 <div className="flex justify-between items-center mb-4 flex-shrink-0">
                    <div>
                        <h1 className="text-2xl font-bold">CC Plan</h1>
                         <div className="flex items-center gap-4 mt-2">
                            <div className="flex items-center gap-2">
                                <Label htmlFor="cc-select" className="text-muted-foreground">CC No:</Label>
                                 <Select value={selectedCc || ''} onValueChange={handleCcChange}>
                                    <SelectTrigger className="w-[180px]" id="cc-select">
                                        <SelectValue placeholder="Select a CC" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {ccOptions.map(cc => (
                                            <SelectItem key={cc} value={cc}>{cc}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            {selectedCc && snapshotOptions.length > 0 && (
                                <div className="flex items-center gap-2">
                                    <Label htmlFor="snapshot-select" className="text-muted-foreground">Snapshot Week:</Label>
                                     <Select 
                                        value={selectedSnapshotWeek !== null ? String(selectedSnapshotWeek) : ''}
                                        onValueChange={(val) => setSelectedSnapshotWeek(Number(val))}
                                     >
                                        <SelectTrigger className="w-[180px]" id="snapshot-select">
                                            <SelectValue placeholder="Select a Snapshot" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {snapshotOptions.map(week => (
                                                <SelectItem key={week} value={String(week)}>Week {week}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {planData && (
                    <Card className="mb-4">
                        <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm p-4">
                            <div className="p-3 bg-muted rounded-md">
                                <div className="font-medium text-muted-foreground text-xs">Earliest Start Week</div>
                                <div className="font-semibold text-base">W{planData.earliestProductionStartWeek ?? 'N/A'}</div>
                            </div>
                             <div className="p-3 bg-muted rounded-md">
                                <div className="font-medium text-muted-foreground text-xs">Production Start Week</div>
                                <div className="font-semibold text-base">W{planData.productionStartWeek ?? 'N/A'}</div>
                            </div>
                             <div className="p-3 bg-muted rounded-md">
                                <div className="font-medium text-muted-foreground text-xs">Offset</div>
                                <div className="font-semibold text-base">{planData.offset ?? 0} weeks</div>
                            </div>
                            <div className="p-3 bg-muted rounded-md">
                                <div className="font-medium text-muted-foreground text-xs">Lines</div>
                                <div className="font-semibold text-base">{planData.lines ?? 0}</div>
                            </div>
                        </CardContent>
                    </Card>
                )}
                
                <div className="space-y-8 overflow-y-auto">
                    {selectedCc && selectedSnapshotWeek !== null && planData ? (
                        <>
                            <CcPlanTable planResult={planData} />
                            <ModelWisePlanTable planResult={planData} />
                        </>
                    ) : (
                         <div className="h-48 flex items-center justify-center text-center text-muted-foreground border rounded-lg">
                            <p>{selectedCc ? "Select a snapshot week to view the plan." : "Please select a CC to view the plan."}</p>
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
}

export default function CcPlanPage() {
    return (
        <Suspense fallback={<div>Loading...</div>}>
            <CcPlanPageContent />
        </Suspense>
    );
}
