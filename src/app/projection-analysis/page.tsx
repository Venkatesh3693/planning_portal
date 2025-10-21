

'use client';

import { Suspense, useMemo } from 'react';
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
import { format, getWeek, subDays } from 'date-fns';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import type { ProjectionDetail } from '@/lib/types';
import { cn } from '@/lib/utils';

const QuantityBreakdownBar = ({ projection }: { projection: ProjectionDetail }) => {
  if (!projection.totalComponents || projection.totalComponents === 0) {
    return <div className="h-6 w-full bg-muted rounded-md" />;
  }
  
  const grnPercentage = (projection.grn.componentCount / projection.totalComponents) * 100;
  const openPoPercentage = (projection.openPo.componentCount / projection.totalComponents) * 100;
  const noPoPercentage = (projection.noPo.componentCount / projection.totalComponents) * 100;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger className="w-full">
          <div className="flex h-6 w-full rounded-md overflow-hidden border">
            <div className="bg-yellow-500" style={{ width: `${noPoPercentage}%` }} />
            <div className="bg-teal-500" style={{ width: `${grnPercentage}%` }} />
            <div className="bg-blue-700" style={{ width: `${openPoPercentage}%` }} />
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <div className="space-y-1 text-sm">
            <div className="font-bold">Component Status Breakdown:</div>
             <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-full bg-yellow-500" />
              <span>No PO: {projection.noPo.componentCount} component(s)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-full bg-teal-500" />
              <span>GRN: {projection.grn.componentCount} component(s)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-full bg-blue-700" />
              <span>Open PO: {projection.openPo.componentCount} component(s)</span>
            </div>
            <hr className="my-1"/>
            <div className="font-semibold">Total: {projection.totalComponents} component(s)</div>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};


function ProjectionAnalysisPageContent() {
    const searchParams = useSearchParams();
    const orderId = searchParams.get('orderId');
    const { orders, isScheduleLoaded } = useSchedule();

    const order = useMemo(() => {
        if (!isScheduleLoaded || !orderId) return null;
        return orders.find(o => o.id === orderId);
    }, [orderId, orders, isScheduleLoaded]);

    const projectionComponentsCount = useMemo(() => {
        if (!order || !order.bom) return 0;
        return order.bom.filter(item => item.forecastType === 'Projection').length;
    }, [order]);


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
                                <TableHead className="text-right">Projection Qty</TableHead>
                                <TableHead className="text-right">FRC Qty</TableHead>
                                <TableHead className="text-right">FRC Pending</TableHead>
                                <TableHead className="w-[200px]">BOM Components Status</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {(order.projectionDetails || []).map((proj) => {
                                const projDate = new Date(proj.projectionDate);
                                const receiptDate = new Date(proj.receiptDate);
                                const ckDate = subDays(receiptDate, 7);
                                const frcPending = proj.total.quantities.total - proj.frcQty;

                                return (
                                    <TableRow key={proj.projectionNumber}>
                                        <TableCell className="font-medium">{proj.projectionNumber}</TableCell>
                                        <TableCell>{format(projDate, 'dd/MM/yy')}</TableCell>
                                        <TableCell>W{getWeek(projDate)}</TableCell>
                                        <TableCell>W{getWeek(projDate)} - W{getWeek(receiptDate)}</TableCell>
                                        <TableCell>{format(ckDate, 'dd/MM/yy')}</TableCell>
                                        <TableCell className="text-right font-semibold">{proj.total.quantities.total.toLocaleString()}</TableCell>
                                        <TableCell className="text-right">{proj.frcQty.toLocaleString()}</TableCell>
                                        <TableCell className="text-right font-semibold">{frcPending.toLocaleString()}</TableCell>
                                        <TableCell>
                                            <QuantityBreakdownBar projection={proj} />
                                        </TableCell>
                                    </TableRow>
                                )
                            })}
                                {(!order.projectionDetails || order.projectionDetails.length === 0) && (
                                <TableRow>
                                    <TableCell colSpan={9} className="h-24 text-center">
                                        No projection details available for this order.
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
