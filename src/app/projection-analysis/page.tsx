
'use client';

import { Suspense, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useSchedule } from '@/context/schedule-provider';
import type { Order, ProjectionDetail, Size, SizeBreakdown } from '@/lib/types';
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
import { ArrowLeft, ChevronDown, ChevronRight } from 'lucide-react';
import { SIZES } from '@/lib/data';
import { cn } from '@/lib/utils';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";


const SubRow = ({ label, data, isTotal = false }: { label: string, data: SizeBreakdown, isTotal?: boolean }) => (
    <TableRow className={cn(isTotal ? "bg-muted/50 hover:bg-muted/50" : "bg-muted/20 hover:bg-muted/30")}>
        <TableCell className="pl-12 font-medium">{label}</TableCell>
        <TableCell></TableCell>
        <TableCell></TableCell>
        {SIZES.map(size => (
            <TableCell key={`${label}-${size}`} className="text-right tabular-nums">
                {(data[size] || 0).toLocaleString()}
            </TableCell>
        ))}
        <TableCell className="text-right font-bold tabular-nums">
            {data.total.toLocaleString()}
        </TableCell>
    </TableRow>
);


const ProjectionRow = ({ detail }: { detail: ProjectionDetail }) => {
    const [isOpen, setIsOpen] = useState(true);

    return (
        <>
            <CollapsibleTrigger asChild>
                <TableRow 
                    onClick={() => setIsOpen(prev => !prev)} 
                    className="cursor-pointer"
                    data-state={isOpen ? 'open' : 'closed'}
                >
                    <TableCell className="font-medium whitespace-nowrap">
                        <div className="flex items-center gap-2">
                             <ChevronRight className={cn("h-4 w-4 transition-transform", isOpen && "rotate-90")} />
                            {detail.projectionNumber}
                        </div>
                    </TableCell>
                    <TableCell>{format(detail.projectionDate, 'dd/MM/yy')}</TableCell>
                    <TableCell>{format(detail.receiptDate, 'dd/MM/yy')}</TableCell>
                    {SIZES.map(size => (
                         <TableCell key={`total-${size}`} className="text-right tabular-nums font-bold">
                            {(detail.total[size] || 0).toLocaleString()}
                        </TableCell>
                    ))}
                    <TableCell className="text-right font-bold tabular-nums">
                        {detail.total.total.toLocaleString()}
                    </TableCell>
                </TableRow>
            </CollapsibleTrigger>
            <CollapsibleContent asChild>
                <>
                    <SubRow label="No PO Qty" data={detail.noPo} />
                    <SubRow label="Open PO Qty" data={detail.openPo} />
                    <SubRow label="GRN Qty" data={detail.grn} />
                    <SubRow label="Cut Qty" data={detail.cut} />
                </>
            </CollapsibleContent>
        </>
    )
}


const ProjectionDetailsTable = ({ order }: { order: Order }) => {
  if (!order.projectionDetails || order.projectionDetails.length === 0) {
    return <div className="text-center text-muted-foreground p-8">No projection details available for this order.</div>;
  }

  return (
     <div className="border rounded-lg overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[200px]">Projection Number</TableHead>
            <TableHead>Projection Date</TableHead>
            <TableHead>Receipt Date</TableHead>
            {SIZES.map(size => (
                <TableHead key={size} className="text-right">{size}</TableHead>
            ))}
            <TableHead className="text-right">Total</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody asChild>
            <Collapsible asChild>
                <>
                    {order.projectionDetails.map((detail) => (
                        <ProjectionRow key={detail.projectionNumber} detail={detail} />
                    ))}
                </>
            </Collapsible>
        </TableBody>
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
