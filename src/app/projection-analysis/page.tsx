
'use client';

import { Suspense, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { useSchedule } from '@/context/schedule-provider';
import type { Order, ProjectionDetail } from '@/lib/types';
import { format } from 'date-fns';
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
  TableFooter
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';


const ProjectionDetailsTable = ({ order }: { order: Order }) => {
  const totals = useMemo(() => {
    if (!order.projectionDetails) {
      return { projectionQty: 0, poQty: 0, grnQty: 0 };
    }
    return order.projectionDetails.reduce(
      (acc, detail) => {
        acc.projectionQty += detail.projectionQty;
        acc.poQty += detail.poQty;
        acc.grnQty += detail.grnQty;
        return acc;
      },
      { projectionQty: 0, poQty: 0, grnQty: 0 }
    );
  }, [order.projectionDetails]);

  if (!order.projectionDetails || order.projectionDetails.length === 0) {
    return <div className="text-center text-muted-foreground p-8">No projection details available for this order.</div>;
  }

  return (
     <div className="border rounded-lg">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Projection Number</TableHead>
            <TableHead>Projection Date</TableHead>
            <TableHead className="text-right">Projection Qty</TableHead>
            <TableHead className="text-right">PO Qty</TableHead>
            <TableHead className="text-right">GRN Qty</TableHead>
            <TableHead>Receipt Date</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {(order.projectionDetails || []).map((detail) => (
            <TableRow key={detail.projectionNumber}>
              <TableCell className="font-medium whitespace-nowrap">{detail.projectionNumber}</TableCell>
              <TableCell>{format(detail.projectionDate, 'dd/MM/yy')}</TableCell>
              <TableCell className="text-right">{detail.projectionQty.toLocaleString()}</TableCell>
              <TableCell className="text-right">{detail.poQty.toLocaleString()}</TableCell>
              <TableCell className="text-right">{detail.grnQty.toLocaleString()}</TableCell>
              <TableCell>{format(detail.receiptDate, 'dd/MM/yy')}</TableCell>
            </TableRow>
          ))}
        </TableBody>
        <TableFooter>
          <TableRow>
            <TableCell colSpan={2} className="font-bold">Total</TableCell>
            <TableCell className="text-right font-bold">
              {totals.projectionQty.toLocaleString()}
            </TableCell>
            <TableCell className="text-right font-bold">
              {totals.poQty.toLocaleString()}
            </TableCell>
            <TableCell className="text-right font-bold">
              {totals.grnQty.toLocaleString()}
            </TableCell>
            <TableCell></TableCell>
          </TableRow>
        </TableFooter>
      </Table>
    </div>
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
                     <Button variant="outline" asChild>
                        <Link href="/orders">
                            <ArrowLeft className="mr-2 h-4 w-4" />
                            Back to Orders
                        </Link>
                    </Button>
                </div>
                
                <div className="flex-1 min-h-0">
                    <ProjectionDetailsTable order={order} />
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
