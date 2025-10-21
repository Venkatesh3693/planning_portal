

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
import { format, getWeek, subDays, addWeeks, addDays } from 'date-fns';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import type { ProjectionDetail, FrcDetail, ComponentStatusDetail, BomItem, SizeBreakdown } from '@/lib/types';
import { SIZES } from '@/lib/data';
import { cn } from '@/lib/utils';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';

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
              const frcDate = new Date(frc.frcDate);
              const receiptDate = new Date(frc.receiptDate);
              const ckDate = subDays(receiptDate, 7);
              const componentBreakdown = { grn: frc.grn, openPo: frc.openPo, noPo: frc.noPo, totalComponents: frc.totalComponents };

              return (
                <TableRow key={frc.frcNumber}>
                  <TableCell className="font-medium">{frc.frcNumber.replace(`${projectionNumber}-`, '')}</TableCell>
                  <TableCell>{format(frcDate, 'dd/MM/yy')}</TableCell>
                  <TableCell>W{getWeek(frcDate)}</TableCell>
                  <TableCell>W{getWeek(frcDate)} - W{getWeek(receiptDate)}</TableCell>
                  <TableCell>{format(ckDate, 'dd/MM/yy')}</TableCell>
                  <TableCell>W{getWeek(ckDate)}</TableCell>
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
    const { orders, isScheduleLoaded, productionPlans } = useSchedule();
    const [selectedProjection, setSelectedProjection] = useState<ProjectionDetail | null>(null);

    const order = useMemo(() => {
        if (!isScheduleLoaded || !orderId) return null;
        return orders.find(o => o.id === orderId);
    }, [orderId, orders, isScheduleLoaded]);

    const projectionDetails = useMemo((): (ProjectionDetail & { coverageStartWeek: number, coverageEndWeek: number })[] => {
        if (!order || !order.bom || !order.poFcQty || !productionPlans[order.id]) {
            return [];
        }

        const plan = productionPlans[order.id];
        const bom = order.bom;
        const totalPoFcQty = order.poFcQty;
        const coverageWeeks = 6;
        const projectionCadenceWeeks = 4;
        const year = new Date().getFullYear(); 

        const allProductionWeeks = Object.keys(plan)
            .map(weekStr => ({ weekNum: parseInt(weekStr.replace('W', '')), quantity: plan[weekStr] || 0 }))
            .sort((a, b) => a.weekNum - b.weekNum);
        
        if (allProductionWeeks.length === 0) return [];
        
        const maxLeadTimeDays = Math.max(0, ...bom
            .filter(item => item.forecastType === 'Projection')
            .map(item => item.leadTime)
        );
        const maxLeadTimeWeeks = Math.ceil(maxLeadTimeDays / 7);

        const createComponentStatus = (items: BomItem[], totalQty: number): ComponentStatusDetail => ({
            quantities: { total: totalQty } as SizeBreakdown,
            componentCount: items.length,
        });

        const projComponents = bom.filter(b => b.forecastType === 'Projection');
        
        const generatedProjections: (ProjectionDetail & { coverageStartWeek: number, coverageEndWeek: number })[] = [];
        let cumulativeProjectedQty = 0;
        let projectionIndex = 0;
        let lastProjectionWeek = 0;
        let lastCoveredProductionWeek = 0;

        while (cumulativeProjectedQty < totalPoFcQty) {
            let currentProjectionWeek: number;
            
            if (projectionIndex === 0) {
                const firstProdWeekEntry = allProductionWeeks.find(p => p.quantity > 0);
                if (!firstProdWeekEntry) break;
                currentProjectionWeek = firstProdWeekEntry.weekNum - maxLeadTimeWeeks;
            } else {
                currentProjectionWeek = lastProjectionWeek + projectionCadenceWeeks;
            }

            if (currentProjectionWeek <= 0) currentProjectionWeek = 1;

            const productionStartWeekForThisProj = currentProjectionWeek + maxLeadTimeWeeks;
            
            const relevantProductionEntries = allProductionWeeks.filter(p => p.weekNum >= productionStartWeekForThisProj && p.quantity > 0);
            
            const productionWindow = relevantProductionEntries.slice(0, coverageWeeks);
            
            if (productionWindow.length === 0) break;

            const projectionQuantity = productionWindow.reduce((sum, week) => sum + week.quantity, 0);

            if (projectionQuantity <= 0) break;

            const coverageStartWeek = productionWindow[0].weekNum;
            const coverageEndWeek = productionWindow[productionWindow.length - 1].weekNum;
            const projectionDate = addWeeks(new Date(year, 0, 1), currentProjectionWeek - 1);
            
            const ckDate = addDays(projectionDate, maxLeadTimeDays);

            const projStatus = createComponentStatus(projComponents, Math.round(projectionQuantity));

            generatedProjections.push({
                projectionNumber: `PROJ-DYN-${String(projectionIndex + 1).padStart(2, '0')}`,
                projectionDate: projectionDate,
                receiptDate: ckDate, // Using ckDate as receipt date for consistency
                frcQty: 0,
                total: {
                  quantities: { total: Math.round(projectionQuantity) } as SizeBreakdown,
                  componentCount: projComponents.length,
                },
                grn: createComponentStatus([], 0),
                openPo: createComponentStatus([], 0),
                noPo: projStatus,
                totalComponents: projComponents.length,
                frcDetails: [],
                coverageStartWeek,
                coverageEndWeek,
            });

            cumulativeProjectedQty += projectionQuantity;
            lastProjectionWeek = currentProjectionWeek;
            lastCoveredProductionWeek = coverageEndWeek;
            projectionIndex++;

            if(projectionIndex > 50) break;
        }

        return generatedProjections;
    }, [order, productionPlans]);


    const handleProjectionClick = (projection: ProjectionDetail) => {
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
                                <TableHead>Projection Date</TableHead>
                                <TableHead>Projection Week</TableHead>
                                <TableHead>Coverage Weeks</TableHead>
                                <TableHead>CK Date</TableHead>
                                <TableHead>CK Week</TableHead>
                                <TableHead className="text-right">Projection Qty</TableHead>
                                <TableHead className="text-right">FRC Qty</TableHead>
                                <TableHead className="text-right">FRC Pending</TableHead>
                                <TableHead className="w-[200px]">BOM Comp. Status (Proj.)</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {projectionDetails.map((proj) => {
                                const projDate = new Date(proj.projectionDate);
                                const ckDate = new Date(proj.receiptDate);
                                const frcPending = proj.total.quantities.total - proj.frcQty;
                                const componentBreakdown = { grn: proj.grn, openPo: proj.openPo, noPo: proj.noPo, totalComponents: proj.totalComponents };

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
                                        <TableCell>{format(projDate, 'dd/MM/yy')}</TableCell>
                                        <TableCell>W{getWeek(projDate)}</TableCell>
                                        <TableCell>W{proj.coverageStartWeek} - W{proj.coverageEndWeek}</TableCell>
                                        <TableCell>{format(ckDate, 'dd/MM/yy')}</TableCell>
                                        <TableCell>W{getWeek(ckDate)}</TableCell>
                                        <TableCell className="text-right font-semibold">{proj.total.quantities.total.toLocaleString()}</TableCell>
                                        <TableCell className="text-right">{proj.frcQty.toLocaleString()}</TableCell>
                                        <TableCell className="text-right font-semibold">{frcPending.toLocaleString()}</TableCell>
                                        <TableCell>
                                            <QuantityBreakdownBar breakdown={componentBreakdown} />
                                        </TableCell>
                                    </TableRow>
                                )
                            })}
                                {(!projectionDetails || projectionDetails.length === 0) && (
                                <TableRow>
                                    <TableCell colSpan={10} className="h-24 text-center">
                                        No production plan found for this order. Please generate a plan on the Production Plan page first.
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                        </Table>
                    </CardContent>
                </Card>
                
                {selectedProjection && <FrcDetailsTable frcDetails={selectedProjection.frcDetails || []} projectionNumber={selectedProjection.projectionNumber} />}
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

    