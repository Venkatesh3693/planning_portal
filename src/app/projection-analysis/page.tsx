
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
} from '@/components/ui/table';
import { SIZES } from '@/lib/data';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';

type ViewType = 'total' | 'noPo' | 'openPo' | 'grn' | 'cut';


const ProjectionDetailsTable = ({ order }: { order: Order }) => {
  const [selectedView, setSelectedView] = useState<ViewType>('total');

  if (!order.projectionDetails || order.projectionDetails.length === 0) {
    return <div className="text-center text-muted-foreground p-8">No projection details available for this order.</div>;
  }
  
  const viewLabels: Record<ViewType, string> = {
    total: 'Total Qty',
    noPo: 'No PO Qty',
    openPo: 'Open PO Qty',
    grn: 'GRN Qty',
    cut: 'Cut Qty'
  };

  return (
    <div className="space-y-4">
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
            <TableBody>
            {order.projectionDetails.map((detail) => {
                const dataToShow: SizeBreakdown = detail[selectedView];

                return (
                    <TableRow key={detail.projectionNumber}>
                        <TableCell className="font-medium whitespace-nowrap">
                            {detail.projectionNumber}
                        </TableCell>
                        <TableCell>{format(new Date(detail.projectionDate), 'dd/MM/yy')}</TableCell>
                        <TableCell>{format(new Date(detail.receiptDate), 'dd/MM/yy')}</TableCell>
                        {SIZES.map(size => (
                            <TableCell key={`total-${size}`} className="text-right tabular-nums">
                                {(dataToShow[size] || 0).toLocaleString()}
                            </TableCell>
                        ))}
                        <TableCell className="text-right font-bold tabular-nums">
                            {dataToShow.total.toLocaleString()}
                        </TableCell>
                    </TableRow>
                )
            })}
            </TableBody>
        </Table>
        </div>
    </div>
  );
};


function ProjectionAnalysisPageContent() {
    const searchParams = useSearchParams();
    const orderId = searchParams.get('orderId');
    const { orders, isScheduleLoaded } = useSchedule();
    const [selectedView, setSelectedView] = useState<ViewType>('total');

    const viewLabels: Record<ViewType, string> = {
        total: 'Total Qty',
        noPo: 'No PO Qty',
        openPo: 'Open PO Qty',
        grn: 'GRN Qty',
        cut: 'Cut Qty'
    };

    const order = useMemo(() => {
        if (!isScheduleLoaded || !orderId) return null;
        return orders.find(o => o.id === orderId);
    }, [orderId, orders, isScheduleLoaded]);
    
    const filteredOrder = useMemo(() => {
        if (!order || !order.projectionDetails) return null;

        const newDetails = order.projectionDetails.map(detail => {
            const dataToShow: SizeBreakdown = detail[selectedView];
            return {
                ...detail,
                displayData: dataToShow,
            };
        });

        return { ...order, displayDetails: newDetails };

    }, [order, selectedView]);


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
                    <div className="flex items-center gap-2 max-w-xs">
                        <Label htmlFor="view-select" className="text-sm font-medium">Show:</Label>
                         <Select value={selectedView} onValueChange={(value) => setSelectedView(value as ViewType)} >
                            <SelectTrigger id="view-select" className="w-[180px]">
                                <SelectValue placeholder="Select a view" />
                            </SelectTrigger>
                            <SelectContent>
                                {Object.entries(viewLabels).map(([key, label]) => (
                                    <SelectItem key={key} value={key}>{label}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </div>
                
                <div className="flex-1 min-h-0">
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
                            <TableBody>
                            {(filteredOrder?.displayDetails || []).map((detail) => (
                                <TableRow key={detail.projectionNumber}>
                                    <TableCell className="font-medium whitespace-nowrap">
                                        {detail.projectionNumber}
                                    </TableCell>
                                    <TableCell>{format(new Date(detail.projectionDate), 'dd/MM/yy')}</TableCell>
                                    <TableCell>{format(new Date(detail.receiptDate), 'dd/MM/yy')}</TableCell>
                                    {SIZES.map(size => (
                                        <TableCell key={`total-${size}`} className="text-right tabular-nums">
                                            {(detail.displayData[size] || 0).toLocaleString()}
                                        </TableCell>
                                    ))}
                                    <TableCell className="text-right font-bold tabular-nums">
                                        {detail.displayData.total.toLocaleString()}
                                    </TableCell>
                                </TableRow>
                            ))}
                            {(!filteredOrder?.displayDetails || filteredOrder.displayDetails.length === 0) && (
                                <TableRow>
                                    <TableCell colSpan={SIZES.length + 4} className="h-24 text-center">
                                        No projection details available for this order.
                                    </TableCell>
                                </TableRow>
                            )}
                            </TableBody>
                        </Table>
                    </div>
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
