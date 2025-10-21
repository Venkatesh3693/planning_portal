

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
import { format, getWeek, subDays, addWeeks } from 'date-fns';
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
    const [coverageWeeks, setCoverageWeeks] = useState(4);

    const order = useMemo(() => {
        if (!isScheduleLoaded || !orderId) return null;
        return orders.find(o => o.id === orderId);
    }, [orderId, orders, isScheduleLoaded]);

    const dynamicProjection = useMemo((): (ProjectionDetail & { coverageStartWeek: number, coverageEndWeek: number }) | null => {
        if (!order || !order.bom || !productionPlans[order.id]) {
            return null;
        }

        const plan = productionPlans[order.id];
        const bom = order.bom;

        // Find the first week of production
        const productionWeeks = Object.keys(plan)
            .filter(week => plan[week] > 0)
            .sort((a, b) => parseInt(a.replace('W', '')) - parseInt(b.replace('W', '')));

        if (productionWeeks.length === 0) {
            return null;
        }

        const firstProductionWeekNum = parseInt(productionWeeks[0].replace('W', ''));
        const year = new Date().getFullYear(); 
        const firstProductionDate = addWeeks(new Date(year, 0, 1), firstProductionWeekNum - 1);


        // Find max lead time for projection components
        const maxLeadTimeDays = Math.max(0, ...bom
            .filter(item => item.forecastType === 'Projection')
            .map(item => item.leadTime)
        );

        // Calculate projection date
        const projectionDate = subDays(firstProductionDate, maxLeadTimeDays);

        // Calculate projection quantity (sum of first N weeks)
        const coveredProductionWeeks = productionWeeks.slice(0, coverageWeeks);
        const projectionQuantity = coveredProductionWeeks.reduce((sum, week) => sum + (plan[week] || 0), 0);
            
        // Calculate receipt date (end of coverage window)
        const lastCoveredWeekNum = coveredProductionWeeks.length > 0
          ? parseInt(coveredProductionWeeks[coveredProductionWeeks.length - 1].replace('W', ''))
          : firstProductionWeekNum;
        const receiptDate = addWeeks(new Date(year, 0, 1), lastCoveredWeekNum - 1);
        const ckDate = subDays(receiptDate, 7);

        const coverageStartWeek = firstProductionWeekNum;
        const coverageEndWeek = lastCoveredWeekNum;


        // Mock component status (can be improved later)
        const createComponentStatus = (items: BomItem[], totalQty: number): ComponentStatusDetail => ({
            quantities: { total: totalQty } as SizeBreakdown,
            componentCount: items.length,
        });

        const projComponents = bom.filter(b => b.forecastType === 'Projection');
        const projStatus = createComponentStatus(projComponents, projectionQuantity);


        return {
            projectionNumber: 'PROJ-DYN-01',
            projectionDate: projectionDate,
            receiptDate: receiptDate,
            frcQty: 0, // Not calculated for now
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
        };
    }, [order, productionPlans, coverageWeeks]);
    
    const projectionDetails = useMemo(() => {
       return dynamicProjection ? [dynamicProjection] : [];
    }, [dynamicProjection]);


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
                
                <Card className="mb-6">
                    <CardHeader>
                        <CardTitle>Configuration</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-center gap-4">
                            <Label htmlFor="coverage-weeks">Demand Coverage (Weeks)</Label>
                            <Input
                                id="coverage-weeks"
                                type="number"
                                min="1"
                                value={coverageWeeks}
                                onChange={(e) => setCoverageWeeks(parseInt(e.target.value, 10) || 1)}
                                className="w-24"
                            />
                        </div>
                    </CardContent>
                </Card>

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
                                const receiptDate = new Date(proj.receiptDate);
                                const ckDate = subDays(receiptDate, 7);
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
