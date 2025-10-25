
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

    const firstDemandWeekStr = Object.keys(earliestDemand).find(w => (earliestDemand[w] || 0) > 0);
    if (!firstDemandWeekStr) return [];
    
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
        
        const firstTrueDemandWeek = Object.keys(currentDemand).filter(w => currentDemand[w] > 0).map(w => parseInt(w.slice(1))).sort((a,b)=> a-b)[0] || projectionWeek;

        const simResult = runTentativePlanForHorizon(firstTrueDemandWeek, null, currentDemand, order, 0);
        const simulatedPlan = simResult.plan;

        let projectionQty = 0;
        for (let w = coverageStartWeek; w <= coverageEndWeek; w++) {
            projectionQty += simulatedPlan[`W${w}`] || 0;
        }

        if (projectionQty <= 0 && projIndex > 1) {
             const anyFutureDemand = Object.keys(currentDemand).some(w => parseInt(w.slice(1)) > coverageEndWeek && currentDemand[w] > 0);
             if(!anyFutureDemand) {
                keepGoing = false;
                continue;
             }
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

const TentativePlanTable = ({
  order,
  planData,
  selectedProjection,
}: {
  order: Order;
  planData: Record<string, number>;
  selectedProjection: Projection | null;
}) => {
  const { weeks, weeklyData, displayWeeks } = useMemo(() => {
    if (!order?.fcVsFcDetails || !selectedProjection) return { weeks: [], weeklyData: {}, displayWeeks: [] };

    const snapshot = order.fcVsFcDetails.find(
      (s) => s.snapshotWeek === selectedProjection.projectionWeek
    );
    if (!snapshot) return { weeks: [], weeklyData: {}, displayWeeks: [] };

    const allWeeksInSnapshot = Object.keys(snapshot.forecasts).sort((a, b) => parseInt(a.slice(1)) - parseInt(b.slice(1)));

    const data: Record<string, { poFc: number }> = {};
    allWeeksInSnapshot.forEach((week) => {
      const forecast = snapshot.forecasts[week]?.total;
      data[week] = {
        poFc: (forecast?.po || 0) + (forecast?.fc || 0),
      };
    });

    const displayWeekSubset = Array.from(
      {
        length:
          selectedProjection.coverageEndWeek -
          selectedProjection.coverageStartWeek +
          1,
      },
      (_, i) => `W${selectedProjection.coverageStartWeek + i}`
    );

    return { weeks: allWeeksInSnapshot, weeklyData: data, displayWeeks: displayWeekSubset };
  }, [order, selectedProjection]);

  const totalPlan = useMemo(
    () => displayWeeks.reduce((sum, week) => sum + (planData[week] || 0), 0),
    [planData, displayWeeks]
  );

  if (!selectedProjection) {
    return (
      <div className="p-4 text-muted-foreground">
        Select a projection to view the plan details.
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          Tentative Plan for Projection Week {selectedProjection.projectionWeek}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[200px] font-bold">Dimension</TableHead>
              {displayWeeks.map((week) => (
                <TableHead key={week} className="text-right">
                  {week}
                </TableHead>
              ))}
              <TableHead className="text-right font-bold">Total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableCell className="font-medium">Plan</TableCell>
              {displayWeeks.map((week) => (
                <TableCell key={week} className="text-right font-semibold">
                  {(planData[week] || 0) > 0
                    ? (planData[week] || 0).toLocaleString()
                    : '-'}
                </TableCell>
              ))}
              <TableCell className="text-right font-bold">
                {totalPlan > 0 ? totalPlan.toLocaleString() : '-'}
              </TableCell>
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
    const [selectedProjection, setSelectedProjection] = useState<Projection | null>(null);
    const [planData, setPlanData] = useState<Record<string, number>>({});
    
    useEffect(() => {
        setCurrentWeek(getWeek(new Date()));
    }, []);

    const order = useMemo(() => {
        if (!isScheduleLoaded || !orderId) return null;
        return orders.find(o => o.id === orderId);
    }, [orderId, orders, isScheduleLoaded]);

    useEffect(() => {
        if (order && projectionDetails.length > 0) {
            setSelectedProjection(projectionDetails[0]);
        } else {
            setSelectedProjection(null);
        }
        setPlanData({});
    }, [order, projectionDetails]);
    
    const handleGenerateProjections = () => {
        if (!order || currentWeek === 0) return;
        const projections = generateRollingProjections(order, currentWeek);
        setProjectionDetails(projections);
    };

    const handleRunTentativePlan = () => {
        if (!order || !selectedProjection) return;

        const snapshot = order.fcVsFcDetails?.find(s => s.snapshotWeek === selectedProjection.projectionWeek);
        if (!snapshot) return;

        const weeklyTotals: Record<string, number> = {};
        const allWeeks = Object.keys(snapshot.forecasts).sort((a, b) => parseInt(a.slice(1)) - parseInt(b.slice(1)));
        allWeeks.forEach(week => {
            const total = snapshot.forecasts[week]?.total;
            weeklyTotals[week] = (total?.po || 0) + (total?.fc || 0);
        });

        const firstPoFcWeekStr = allWeeks.find(w => (weeklyTotals[w] || 0) > 0);
        
        let closingInventoryOfPreviousWeek = 0;
        
        if (firstPoFcWeekStr) {
            const firstPoFcWeekNum = parseInt(firstPoFcWeekStr.slice(1));
            
            const baselineStartWeek = Math.min(selectedProjection.projectionWeek, firstPoFcWeekNum);

            const baselinePlanResult = runTentativePlanForHorizon(baselineStartWeek, null, weeklyTotals, order, 0);
            const baselinePlan = baselinePlanResult.plan;
            
            let inventory = 0;
            const pastWeeks = allWeeks.filter(w => parseInt(w.slice(1)) < selectedProjection.projectionWeek);
            
            for (const weekKey of pastWeeks) {
                const supplyThisWeek = baselinePlan[weekKey] || 0;
                const demandThisWeek = weeklyTotals[weekKey] || 0;
                inventory += supplyThisWeek - demandThisWeek;
            }
            closingInventoryOfPreviousWeek = inventory;
        }
        
        const currentPlanResult = runTentativePlanForHorizon(selectedProjection.projectionWeek, null, weeklyTotals, order, closingInventoryOfPreviousWeek);
        
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
                            <CardTitle>Rolling Projections &amp; FRC</CardTitle>
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
                        {projectionDetails.length > 0 && (
                            <div className="w-full max-w-xs space-y-2">
                                <Label htmlFor="snapshot-select">Select Projection Week</Label>
                                <Select
                                  value={selectedProjection?.projectionNumber || ''}
                                  onValueChange={(projNumber) => {
                                    const proj = projectionDetails.find(p => p.projectionNumber === projNumber);
                                    setSelectedProjection(proj || null);
                                  }}
                                >
                                    <SelectTrigger id="snapshot-select">
                                        <SelectValue placeholder="Select a projection..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {projectionDetails.map(proj => (
                                            <SelectItem key={proj.projectionNumber} value={proj.projectionNumber}>
                                                Week {proj.projectionWeek} ({proj.projectionNumber})
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        )}
                        <Button onClick={handleRunTentativePlan} disabled={!selectedProjection}>
                            <Zap className="mr-2 h-4 w-4" />
                            Run Tentative Plan
                        </Button>
                    </div>

                    {Object.keys(planData).length > 0 ? (
                        <TentativePlanTable
                          order={order}
                          planData={planData}
                          selectedProjection={selectedProjection}
                        />
                    ) : (
                         <div className="text-center text-muted-foreground pt-10">Select a projection and click "Run Tentative Plan" to view details.</div>
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
