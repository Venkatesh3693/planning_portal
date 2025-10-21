

'use client';

import { Suspense, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import type { Order, ProjectionDetail, StatusDetail } from '@/lib/types';
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
import { useSchedule } from '@/context/schedule-provider';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { Card, CardContent } from '@/components/ui/card';
import { format, differenceInWeeks } from 'date-fns';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';


const QuantityBreakdownBar = ({ projection }: { projection: ProjectionDetail }) => {
  const breakdowns: {
    key: 'grn' | 'openPo' | 'noPo';
    label: string;
    color: string;
    count: number;
    qty: number;
  }[] = [
    { key: 'grn', label: 'GRN', color: 'bg-green-500', count: projection.grn.componentCount, qty: projection.grn.quantities.total },
    { key: 'openPo', label: 'Open PO', color: 'bg-blue-500', count: projection.openPo.componentCount, qty: projection.openPo.quantities.total },
    { key: 'noPo', label: 'No PO', color: 'bg-gray-400', count: projection.noPo.componentCount, qty: projection.noPo.quantities.total },
  ];

  const totalQty = projection.total.quantities.total;
  if (totalQty === 0) return <div className="h-4 w-full bg-muted rounded-full" />;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger>
          <div className="flex h-4 w-full rounded-full overflow-hidden bg-muted">
            {breakdowns.map(b => {
              if (b.qty <= 0) return null;
              const percentage = (b.qty / totalQty) * 100;
              return (
                <div
                  key={b.key}
                  className={cn("h-full", b.color)}
                  style={{ width: `${percentage}%` }}
                />
              );
            })}
          </div>
        </TooltipTrigger>
        <TooltipContent>
            <div className="space-y-1">
                {breakdowns.map(b => (
                    <div key={b.key} className="flex items-center gap-2 text-sm">
                        <div className={cn("h-3 w-3 rounded-sm", b.color)} />
                        <span>{b.label}:</span>
                        <span className="font-semibold">{b.count} of {projection.totalComponents}</span>
                    </div>
                ))}
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

    if (!isScheduleLoaded) {
        return <div className="flex items-center justify-center h-full">Loading analysis data...</div>;
    }

    if (!order) {
        return <div className="flex items-center justify-center h-full">Order not found. Please go back and select an order.</div>;
    }
    
    const projectionDetails = order.projectionDetails || [];

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
                        <h1 className="text-2xl font-bold">Projection Analysis</h1>
                        <p className="text-muted-foreground">
                            Order ID: {order.id}
                        </p>
                    </div>
                </div>

                <div className="flex-1 min-h-0">
                    <Card>
                        <CardContent className="p-0">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Projection No.</TableHead>
                                        <TableHead>Projection Date</TableHead>
                                        <TableHead>Covered Weeks</TableHead>
                                        <TableHead className="text-right">Total Qty</TableHead>
                                        <TableHead className="w-[40%]">Component Status</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {projectionDetails.length > 0 ? (
                                        projectionDetails.map((proj) => {
                                            const weeks = differenceInWeeks(proj.receiptDate, proj.projectionDate);
                                            return (
                                                <TableRow key={proj.projectionNumber}>
                                                    <TableCell className="font-medium">{proj.projectionNumber}</TableCell>
                                                    <TableCell>{format(proj.projectionDate, 'PPP')}</TableCell>
                                                    <TableCell>{weeks} weeks</TableCell>
                                                    <TableCell className="text-right">{proj.total.quantities.total.toLocaleString()}</TableCell>
                                                    <TableCell>
                                                        <QuantityBreakdownBar projection={proj} />
                                                    </TableCell>
                                                </TableRow>
                                            )
                                        })
                                    ) : (
                                        <TableRow>
                                            <TableCell colSpan={5} className="h-24 text-center">
                                                No projection details available for this order.
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
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
