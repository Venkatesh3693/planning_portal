

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
import type { Order, Size } from '@/lib/types';
import CcPlanTable from '@/components/cc-plan/plan-table';
import { CcProdPlanner, calculateFgoiForSingleScenario } from '@/lib/tna-calculator';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { SIZES } from '@/lib/data';

type ModelPlanQuantities = {
    produced: Record<string, number>;
    plan: Record<string, number>;
};

const allocateProduction = (
    mainPlan: CcWisePlanResult,
    modelDemands: Record<string, Record<string, number>>,
    allWeeks: string[]
): Record<string, ModelPlanQuantities> => {
    const modelNames = Object.keys(modelDemands);
    
    // Initialize results
    const modelQuantities: Record<string, ModelPlanQuantities> = {};
    modelNames.forEach(name => {
        modelQuantities[name] = { produced: {}, plan: {} };
    });

    const calculateAllModelFgoi = () => {
        const allFgoi: Record<string, Record<string, number>> = {};
        modelNames.forEach(name => {
            const demand = modelDemands[name] || {};
            const { produced, plan } = modelQuantities[name];
            allFgoi[name] = calculateFgoiForSingleScenario(allWeeks, demand, plan, produced, 0);
        });
        return allFgoi;
    };

    const findWinningModel = (weekIndex: number, allModelFgoi: Record<string, Record<string, number>>): string | null => {
        let potentialWinners = [...modelNames];
        
        for (let i = weekIndex; i < allWeeks.length; i++) {
            const currentWeek = allWeeks[i];
            
            let lowestFgoi = Infinity;
            potentialWinners.forEach(name => {
                const fgoi = allModelFgoi[name][currentWeek] ?? 0;
                if (fgoi < lowestFgoi) {
                    lowestFgoi = fgoi;
                }
            });

            const winners = potentialWinners.filter(name => (allModelFgoi[name][currentWeek] ?? 0) === lowestFgoi);

            if (winners.length === 1) {
                return winners[0];
            }
            potentialWinners = winners; // For the next iteration of tie-breaking
        }
        return potentialWinners.length > 0 ? potentialWinners[0] : null; // Default to first if tie persists
    };


    allWeeks.forEach((week, weekIndex) => {
        const ccProducedQty = mainPlan.producedData[week] || 0;
        const ccPlanQty = mainPlan.planData[week] || 0;

        // Allocate Produced Qty
        if (ccProducedQty > 0) {
            const currentFgoiState = calculateAllModelFgoi();
            const winner = findWinningModel(weekIndex, currentFgoiState);
            if (winner) {
                modelQuantities[winner].produced[week] = (modelQuantities[winner].produced[week] || 0) + ccProducedQty;
            }
        }
        
        // Allocate Plan Qty if no Produced Qty was allocated this week
        else if (ccPlanQty > 0) {
             const currentFgoiState = calculateAllModelFgoi();
             const winner = findWinningModel(weekIndex, currentFgoiState);
             if (winner) {
                modelQuantities[winner].plan[week] = (modelQuantities[winner].plan[week] || 0) + ccPlanQty;
            }
        }
    });

    return modelQuantities;
};

const ModelWisePlanTable = ({ planResult }: { planResult: any }) => {
    const { allWeeks, modelWiseDemand } = planResult;
    const modelNames = Object.keys(modelWiseDemand || {});
    
    const modelProduction = useMemo(() => {
        if (!planResult || !modelWiseDemand) return {};
        return allocateProduction(planResult, modelWiseDemand, allWeeks);
    }, [planResult, modelWiseDemand, allWeeks]);


    if (!modelNames || modelNames.length === 0) {
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
                                {modelNames.map((modelName, modelIndex) => {
                                    const weeklyDemand = planResult.modelWiseDemand[modelName] || {};
                                    const poFcTotal = Object.values(weeklyDemand).reduce((sum: number, val: any) => sum + val, 0);

                                    const producedQty = modelProduction[modelName]?.produced || {};
                                    const planQty = modelProduction[modelName]?.plan || {};
                                    
                                    const producedQtyTotal = Object.values(producedQty).reduce((sum: number, val: any) => sum + val, 0);
                                    const planQtyTotal = Object.values(planQty).reduce((sum: number, val: any) => sum + val, 0);


                                    const fgoiData = calculateFgoiForSingleScenario(allWeeks, weeklyDemand, planQty, producedQty, 0);
                                    const fgOiMin = useMemo(() => {
                                        const fgoiValues = Object.values(fgoiData);
                                        return fgoiValues.length > 0 ? Math.min(...fgoiValues) : 0;
                                    }, [fgoiData]);
                                    
                                    const metrics = [
                                        { name: 'PO + FC', data: weeklyDemand, total: poFcTotal },
                                        { name: 'Produced Qty', data: producedQty, total: producedQtyTotal },
                                        { name: 'Plan Qty', data: planQty, total: planQtyTotal },
                                        { name: 'FG OI', data: fgoiData, total: fgOiMin, isMin: true },
                                    ];

                                    return (
                                        <React.Fragment key={modelName}>
                                            {metrics.map((metric, metricIndex) => (
                                                 <TableRow key={`${modelName}-${metric.name}`} className={modelIndex > 0 && metricIndex === 0 ? 'border-t-4 border-border' : ''}>
                                                    <TableCell className={cn("sticky left-0 z-10 font-medium", metricIndex > 0 ? 'bg-muted' : 'bg-background')}>
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
                                                     <TableCell className={cn("sticky right-0 z-10 text-center font-bold", metricIndex > 0 ? 'bg-muted' : 'bg-background', metric.name === 'FG OI' && (metric.total || 0) < 0 && 'text-destructive')}>
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
