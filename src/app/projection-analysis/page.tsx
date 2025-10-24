

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
import { ArrowLeft } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import type { FrcDetail, ComponentStatusDetail, BomItem, SizeBreakdown } from '@/lib/types';
import { SIZES } from '@/lib/data';
import { cn } from '@/lib/utils';
import { runTentativePlanForHorizon } from '@/lib/tna-calculator';


type Projection = {
  projectionNumber: string;
  projectionWeek: number;
  coverageStartWeek: number;
  coverageEndWeek: number;
  ckWeek: number;
  projectionQty: number;
  frcQty: number;
};

type ComponentBreakdown = {
  grn: ComponentStatusDetail;
  openPo: ComponentStatusDetail;
  noPo: ComponentStatusDetail;
  totalComponents: number;
}

const QuantityBreakdownBar = ({ breakdown }: { breakdown: ComponentBreakdown }) => {
  const { grn, openPo, noPo, totalComponents } = breakdown;
  if (!totalComponents || totalComponents === 0) {
    return <div className="h-6 w-full bg-muted rounded-md" />;
  }
  
  const grnPercentage = (grn.componentCount / totalComponents) * 100;
  const openPoPercentage = (openPo.componentCount / totalComponents) * 100;
  const noPoPercentage = (noPo.componentCount / totalComponents) * 100;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger className="w-full">
          <div className="flex h-6 w-full rounded-md overflow-hidden border">
            <div className="bg-slate-400" style={{ width: `${noPoPercentage}%` }} />
            <div className="bg-blue-500" style={{ width: `${openPoPercentage}%` }} />
            <div className="bg-blue-800" style={{ width: `${grnPercentage}%` }} />
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <div className="space-y-1 text-sm">
            <div className="font-bold">Component Status Breakdown:</div>
             <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-full bg-slate-400" />
              <span>No PO: {noPo.componentCount} component(s)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-full bg-blue-500" />
              <span>Open PO: {openPo.componentCount} component(s)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-full bg-blue-800" />
              <span>GRN: {grn.componentCount} component(s)</span>
            </div>
            <hr className="my-1"/>
            <div className="font-semibold">Total: {totalComponents} component(s)</div>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

const FrcDetailsTable = ({ frcDetails, projectionNumber }: { frcDetails: FrcDetail[], projectionNumber: string }) => {
  if (!frcDetails || frcDetails.length === 0) return null;

  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle>FRC Details for {projectionNumber}</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>FRC Number</TableHead>
              <TableHead>FRC Date</TableHead>
              <TableHead>FRC Week</TableHead>
              <TableHead>Coverage</TableHead>
              <TableHead>CK Date</TableHead>
              <TableHead>CK Week</TableHead>
              {SIZES.map(s => <TableHead key={s} className="text-right">{s}</TableHead>)}
              <TableHead className="text-right font-bold">Total Qty</TableHead>
              <TableHead className="w-[200px]">BOM Component Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {frcDetails.map(frc => {
              const frcWeek = getWeek(frc.frcDate);
              const receiptWeek = getWeek(frc.receiptDate);
              const ckWeek = receiptWeek - 1;
              const componentBreakdown = { grn: frc.grn, openPo: frc.openPo, noPo: frc.noPo, totalComponents: frc.totalComponents };

              return (
                <TableRow key={frc.frcNumber}>
                  <TableCell className="font-medium">{frc.frcNumber.replace(`${projectionNumber}-`, '')}</TableCell>
                  <TableCell>W{frcWeek}</TableCell>
                  <TableCell>W{frcWeek}</TableCell>
                  <TableCell>W{frcWeek} - W{receiptWeek}</TableCell>
                  <TableCell>W{ckWeek}</TableCell>
                  <TableCell>W{ckWeek}</TableCell>
                  {SIZES.map(s => <TableCell key={s} className="text-right">{(frc.quantities[s] || 0).toLocaleString()}</TableCell>)}
                  <TableCell className="text-right font-bold">{frc.quantities.total.toLocaleString()}</TableCell>
                  <TableCell><QuantityBreakdownBar breakdown={componentBreakdown} /></TableCell>
                </TableRow>
              );
            })}
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
    const [selectedProjection, setSelectedProjection] = useState<Projection | null>(null);

    const order = useMemo(() => {
        if (!isScheduleLoaded || !orderId) return null;
        return orders.find(o => o.id === orderId);
    }, [orderId, orders, isScheduleLoaded]);

    const projectionDetails = useMemo((): Projection[] => {
        if (!order) return [];
        
        const snapshotOptions = (order.fcVsFcDetails || []).map(s => s.snapshotWeek).sort((a,b) => a-b);
        if (snapshotOptions.length === 0) return [];
        const earliestSnapshotWeek = snapshotOptions[0];

        const earliestSnapshot = order.fcVsFcDetails!.find(s => s.snapshotWeek === earliestSnapshotWeek)!;
        const demand = Object.keys(earliestSnapshot.forecasts).reduce((acc, week) => {
            acc[week] = (earliestSnapshot.forecasts[week]?.total?.po || 0) + (earliestSnapshot.forecasts[week]?.total?.fc || 0);
            return acc;
        }, {} as Record<string, number>);

        const baselineResult = runTentativePlanForHorizon(earliestSnapshotWeek, null, demand, order, 0);
        const baselinePlan = baselineResult.plan;
        
        const firstProdWeekNum = parseInt(Object.keys(baselinePlan).find(w => baselinePlan[w] > 0)?.slice(1) || '0');
        const totalProductionTarget = Object.values(baselinePlan).reduce((sum, qty) => sum + qty, 0);

        if (firstProdWeekNum === 0 || totalProductionTarget === 0) return [];

        const maxLeadTimeDays = Math.max(0, ...(order.bom || [])
            .filter(item => item.forecastType === 'Projection')
            .map(item => item.leadTime)
        );
        const maxLeadTimeWeeks = Math.ceil(maxLeadTimeDays / 7);
        const ckWeek = firstProdWeekNum - 1;
        
        let currentProjWeek = ckWeek - maxLeadTimeWeeks;
        let cumulativeProjectedQty = 0;
        let projIndex = 1;
        const allProjections: Projection[] = [];
        let weeksCovered = 0;

        while(cumulativeProjectedQty < totalProductionTarget && projIndex < 50) {
            const currentSnapshot = order.fcVsFcDetails!.find(s => s.snapshotWeek === currentProjWeek) || earliestSnapshot;
            const currentDemand = Object.keys(currentSnapshot.forecasts).reduce((acc, week) => {
                acc[week] = (currentSnapshot.forecasts[week]?.total?.po || 0) + (currentSnapshot.forecasts[week]?.total?.fc || 0);
                return acc;
            }, {} as Record<string, number>);
            const { plan: currentPlan } = runTentativePlanForHorizon(currentProjWeek, null, currentDemand, order, 0);

            const planWeeks = Object.keys(currentPlan).map(w => parseInt(w.slice(1))).sort((a,b) => a-b);
            const coverageStartWeek = planWeeks.find(w => w >= firstProdWeekNum + weeksCovered);

            if (!coverageStartWeek) break;

            const coverageEndWeek = coverageStartWeek + 3;
            let projectionQty = 0;
            for (let w = coverageStartWeek; w <= coverageEndWeek; w++) {
                projectionQty += currentPlan[`W${w}`] || 0;
            }

            const projection: Projection = {
                projectionNumber: `PROJ-DYN-${String(projIndex).padStart(2, '0')}`,
                projectionWeek: currentProjWeek,
                coverageStartWeek,
                coverageEndWeek,
                ckWeek: currentProjWeek + maxLeadTimeWeeks,
                projectionQty,
                frcQty: Math.round(projectionQty * (0.6 + Math.random() * 0.1)), // Mock FRC
            };

            allProjections.push(projection);

            cumulativeProjectedQty += projectionQty;
            weeksCovered += 4;
            currentProjWeek += 4;
            projIndex++;
        }

        return allProjections;
    }, [order]);


    const handleProjectionClick = (projection: Projection) => {
      setSelectedProjection(prev => prev?.projectionNumber === projection.projectionNumber ? null : projection);
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
                                <TableHead>Projection No.</TableHead>
                                <TableHead>Projection Week</TableHead>
                                <TableHead>Coverage Weeks</TableHead>
                                <TableHead>CK Week</TableHead>
                                <TableHead className="text-right">Projection Qty</TableHead>
                                <TableHead className="text-right">FRC Qty</TableHead>
                                <TableHead className="text-right">FRC Pending</TableHead>
                                {/* <TableHead className="w-[200px]">BOM Comp. Status (Proj.)</TableHead> */}
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {projectionDetails.map((proj) => {
                                const frcPending = proj.projectionQty - proj.frcQty;
                                
                                return (
                                    <TableRow 
                                      key={proj.projectionNumber} 
                                      data-state={selectedProjection?.projectionNumber === proj.projectionNumber ? 'selected' : 'unselected'}
                                      className="data-[state=selected]:bg-blue-100/60 dark:data-[state=selected]:bg-blue-900/60"
                                    >
                                        <TableCell 
                                          className="font-medium text-primary cursor-pointer hover:underline"
                                          onClick={() => handleProjectionClick(proj)}
                                        >
                                          {proj.projectionNumber}
                                        </TableCell>
                                        <TableCell>W{proj.projectionWeek}</TableCell>
                                        <TableCell>W{proj.coverageStartWeek} - W{proj.coverageEndWeek}</TableCell>
                                        <TableCell>W{proj.ckWeek}</TableCell>
                                        <TableCell className="text-right font-semibold">{proj.projectionQty.toLocaleString()}</TableCell>
                                        <TableCell className="text-right">{proj.frcQty.toLocaleString()}</TableCell>
                                        <TableCell className="text-right font-semibold">{frcPending.toLocaleString()}</TableCell>
                                        {/* <TableCell>
                                            <QuantityBreakdownBar breakdown={componentBreakdown} />
                                        </TableCell> */}
                                    </TableRow>
                                )
                            })}
                                {(!projectionDetails || projectionDetails.length === 0) && (
                                <TableRow>
                                    <TableCell colSpan={8} className="h-24 text-center">
                                        No production plan found for this order. Please generate a plan on the Tentative Plan page first.
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                        </Table>
                    </CardContent>
                </Card>
                
                {/* {selectedProjection && <FrcDetailsTable frcDetails={selectedProjection.frcDetails || []} projectionNumber={selectedProjection.projectionNumber} />} */}
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

