
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
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { SIZES } from '@/lib/data';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

type ViewType = 'total' | 'grn' | 'poReleased' | 'notReleasedLate' | 'notReleasedEarly';

const breakdownColors: Record<Exclude<ViewType, 'total'>, string> = {
  grn: '#22c55e', // Green
  poReleased: '#3b82f6', // Blue
  notReleasedLate: '#ef4444', // Red
  notReleasedEarly: '#6b7280', // Gray
};

const QuantityBreakdownBar = ({ detail, size }: { detail: ProjectionDetail, size: Size | 'total' }) => {
    const total = detail.total[size] || 0;
    if (total === 0) {
        return <div className="h-2 w-full bg-muted rounded-full"></div>;
    }

    const breakdowns = [
        { key: 'grn', value: detail.grn[size] || 0, color: breakdownColors.grn, label: 'GRN' },
        { key: 'poReleased', value: detail.poReleased[size] || 0, color: breakdownColors.poReleased, label: 'PO Released' },
        { key: 'notReleasedLate', value: detail.notReleasedLate[size] || 0, color: breakdownColors.notReleasedLate, label: 'Not Released (Late)' },
        { key: 'notReleasedEarly', value: detail.notReleasedEarly[size] || 0, color: breakdownColors.notReleasedEarly, label: 'Not Released (Early)' },
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
                                    style={{ width: `${percentage}%`, backgroundColor: item.color }}
                                />
                            );
                        })}
                    </div>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                    <div className="space-y-1">
                       {breakdowns.map(item => {
                           if (item.value === 0) return null;
                           return (
                               <div key={item.key} className="flex items-center justify-between text-xs gap-4">
                                   <div className="flex items-center gap-2">
                                       <div className="h-2 w-2 rounded-full" style={{ backgroundColor: item.color }}></div>
                                       <span>{item.label}</span>
                                   </div>
                                   <span className="font-semibold">{item.value.toLocaleString()}</span>
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
    const [selectedView, setSelectedView] = useState<ViewType>('total');

    const viewLabels: Record<ViewType, string> = {
        total: 'Total Qty',
        grn: 'GRN',
        poReleased: 'PO Released',
        notReleasedLate: 'PO Not Released (Late)',
        notReleasedEarly: 'PO Not Released (Early)',
    };

    const order = useMemo(() => {
        if (!isScheduleLoaded || !orderId) return null;
        return orders.find(o => o.id === orderId);
    }, [orderId, orders, isScheduleLoaded]);
    
    const totals = useMemo(() => {
        if (!order?.projectionDetails) {
            return {
                sizeTotals: SIZES.reduce((acc, size) => ({...acc, [size]: 0}), {} as Record<Size, number>),
                grandTotal: 0
            };
        }
    
        const sizeTotals = SIZES.reduce((acc, size) => {
            acc[size] = order.projectionDetails.reduce((sum, detail) => {
                const viewData = detail[selectedView];
                return sum + (viewData?.[size] || 0);
            }, 0);
            return acc;
        }, {} as Record<Size, number>);
    
        const grandTotal = order.projectionDetails.reduce((sum, detail) => {
            const viewData = detail[selectedView];
            return sum + (viewData?.total || 0);
        }, 0);
    
        return { sizeTotals, grandTotal };
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
                    <div className="flex items-center gap-2">
                        <Label htmlFor="view-select" className="text-sm font-medium">Show:</Label>
                         <Select value={selectedView} onValueChange={(value) => setSelectedView(value as ViewType)} >
                            <SelectTrigger id="view-select" className="w-[220px]">
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
                            {(order.projectionDetails || []).map((detail) => (
                                <TableRow key={detail.projectionNumber}>
                                    <TableCell className="font-medium whitespace-nowrap">
                                        {detail.projectionNumber}
                                    </TableCell>
                                    <TableCell>{format(new Date(detail.projectionDate), 'dd/MM/yy')}</TableCell>
                                    <TableCell>{format(new Date(detail.receiptDate), 'dd/MM/yy')}</TableCell>
                                    
                                    {SIZES.map(size => (
                                        <TableCell key={`${detail.projectionNumber}-${size}`} className="text-right tabular-nums">
                                            <div>
                                                <span className="font-medium">{(detail[selectedView]?.[size] || 0).toLocaleString()}</span>
                                                {selectedView === 'total' ? (
                                                  (detail.total[size] || 0) > 0 && <QuantityBreakdownBar detail={detail} size={size} />
                                                ) : (
                                                    <div className="text-xs text-muted-foreground">
                                                        {(detail.total[size] || 0).toLocaleString()}
                                                    </div>
                                                )}
                                            </div>
                                        </TableCell>
                                    ))}

                                    <TableCell className="text-right font-bold tabular-nums">
                                        <div>
                                            <span className="font-bold">{(detail[selectedView]?.total || 0).toLocaleString()}</span>
                                            {selectedView === 'total' ? (
                                               detail.total.total > 0 && <QuantityBreakdownBar detail={detail} size='total' />
                                            ) : (
                                                <div className="text-xs text-muted-foreground font-normal">
                                                    {(detail.total.total).toLocaleString()}
                                                </div>
                                            )}
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))}
                            {(!order.projectionDetails || order.projectionDetails.length === 0) && (
                                <TableRow>
                                    <TableCell colSpan={SIZES.length + 4} className="h-24 text-center">
                                        No projection details available for this order.
                                    </TableCell>
                                </TableRow>
                            )}
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
