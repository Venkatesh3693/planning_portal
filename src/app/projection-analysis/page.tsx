
'use client';

import { Suspense, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import type { Order, ProjectionDetail, Size, SizeBreakdown, StatusDetail } from '@/lib/types';
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
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { SIZES } from '@/lib/data';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useSchedule } from '@/context/schedule-provider';


const breakdownColors = {
  grn: '#0284c7', // Sky-500
  poReleased: '#22c55e', // Green-500
  notReleasedLate: '#ef4444', // Red-500
  notReleasedEarly: '#6b7280', // Slate-500
};

const QuantityBreakdownBar = ({ detail }: { detail: ProjectionDetail }) => {
    const total = detail.total?.quantities?.total || 0;
    if (total === 0) {
        return <div className="h-2 w-full bg-muted rounded-full"></div>;
    }

    const breakdowns: {
        key: keyof typeof breakdownColors,
        value: number,
        label: string,
        componentCount: number
    }[] = [
        { key: 'grn', value: detail.grn?.quantities?.total || 0, label: 'GRN', componentCount: detail.grn?.componentCount || 0 },
        { key: 'poReleased', value: detail.poReleased?.quantities?.total || 0, label: 'PO Released', componentCount: detail.poReleased?.componentCount || 0 },
        { key: 'notReleasedLate', value: detail.notReleasedLate?.quantities?.total || 0, label: 'Not Released (Late)', componentCount: detail.notReleasedLate?.componentCount || 0 },
        { key: 'notReleasedEarly', value: detail.notReleasedEarly?.quantities?.total || 0, label: 'Not Released (Early)', componentCount: detail.notReleasedEarly?.componentCount || 0 },
    ];

    return (
        <TooltipProvider>
            <Tooltip>
                <TooltipTrigger asChild>
                    <div className="h-2 w-full flex rounded-full overflow-hidden bg-muted mt-1">
                        {breakdowns.map(item => {
                            if (item.value === 0) return null;
                            const percentage = (item.value / total) * 100;
                            return (
                                <div
                                    key={item.key}
                                    className="h-full"
                                    style={{ width: `${percentage}%`, backgroundColor: breakdownColors[item.key] }}
                                />
                            );
                        })}
                    </div>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                    <div className="space-y-1 text-xs">
                       {breakdowns.map(item => {
                           if (item.value === 0) return null;
                           return (
                               <div key={item.key} className="flex items-center justify-between gap-4">
                                   <div className="flex items-center gap-2">
                                       <div className="h-2 w-2 rounded-full" style={{ backgroundColor: breakdownColors[item.key] }}></div>
                                       <span>{item.label}:</span>
                                   </div>
                                   <span className="font-semibold">{item.componentCount} of {detail.totalComponents}</span>
                               </div>
                           );
                       })}
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
    
    const totals = useMemo(() => {
        if (!order?.projectionDetails) {
            const emptyTotals = SIZES.reduce((acc, size) => ({...acc, [size]: 0}), {} as Record<Size, number>);
            return {
                sizeTotals: emptyTotals,
                grandTotal: 0
            };
        }
    
        const sizeTotals = SIZES.reduce((acc, size) => {
            acc[size] = order.projectionDetails.reduce((sum, detail) => {
                return sum + (detail.total?.quantities?.[size] || 0);
            }, 0);
            return acc;
        }, {} as Record<Size, number>);
    
        const grandTotal = order.projectionDetails.reduce((sum, detail) => {
            return sum + (detail.total?.quantities?.total || 0);
        }, 0);
    
        return { sizeTotals, grandTotal };
    }, [order]);

    if (!isScheduleLoaded) {
        return <div className="flex items-center justify-center h-full">Loading analysis data...</div>;
    }

    if (!order) {
        return <div className="flex items-center justify-center h-full">Order not found. Please go back and select an order.</div>;
    }

    if (!order.projectionDetails || order.projectionDetails.length === 0) {
        return (
             <div className="flex h-screen flex-col">
                <Header />
                <main className="flex-1 p-4 sm:p-6 lg:p-8 flex flex-col">
                    <div className="flex items-center justify-center h-full text-center">
                        <p className="text-muted-foreground">No projection details available for this order.</p>
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
                    <div className="border rounded-lg overflow-auto">
                        <Table>
                            <TableHeader>
                            <TableRow>
                                <TableHead className="w-[200px]">Projection Number</TableHead>
                                <TableHead>Projection Date</TableHead>
                                <TableHead>Receipt Date</TableHead>
                                {SIZES.map(size => (
                                    <TableHead key={size} className="text-right">{size}</TableHead>
                                ))}
                                <TableHead className="text-right font-bold">Total</TableHead>
                            </TableRow>
                            </TableHeader>
                            <TableBody>
                            {(order.projectionDetails || []).map((detail) => {
                                return (
                                <TableRow key={detail.projectionNumber}>
                                    <TableCell className="font-medium whitespace-nowrap">
                                        {detail.projectionNumber}
                                    </TableCell>
                                    <TableCell>{format(new Date(detail.projectionDate), 'dd/MM/yy')}</TableCell>
                                    <TableCell>{format(new Date(detail.receiptDate), 'dd/MM/yy')}</TableCell>
                                    
                                    {SIZES.map(size => (
                                        <TableCell key={`${detail.projectionNumber}-${size}`} className="text-right tabular-nums">
                                             <div>
                                                <span className="font-medium">{(detail.total.quantities[size] || 0).toLocaleString()}</span>
                                                {(detail.total.quantities[size] || 0) > 0 && <QuantityBreakdownBar detail={detail} />}
                                            </div>
                                        </TableCell>
                                    ))}

                                    <TableCell className="text-right font-bold tabular-nums">
                                        <div>
                                            <span className="font-bold">{(detail.total.quantities.total).toLocaleString()}</span>
                                            {detail.total.quantities.total > 0 && <QuantityBreakdownBar detail={detail} />}
                                        </div>
                                    </TableCell>
                                </TableRow>
                                );
                            })}
                            </TableBody>
                             <TableFooter>
                                <TableRow>
                                    <TableCell colSpan={3} className="font-bold text-right">Total</TableCell>
                                    {SIZES.map(size => (
                                        <TableCell key={`total-${size}`} className="text-right font-bold">
                                            {(totals.sizeTotals[size] || 0).toLocaleString()}
                                        </TableCell>
                                    ))}
                                    <TableCell className="text-right font-bold">
                                        {totals.grandTotal.toLocaleString()}
                                    </TableCell>
                                </TableRow>
                            </TableFooter>
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
