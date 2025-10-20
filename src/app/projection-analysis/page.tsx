
'use client';

import { Suspense, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useSchedule } from '@/context/schedule-provider';
import type { Order, ProjectionDetail, Size, StatusDetail } from '@/lib/types';
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

type ViewType = 'total' | 'grn' | 'poReleased' | 'notReleasedLate' | 'notReleasedEarly';

const breakdownColors: Record<Exclude<ViewType, 'total'>, string> = {
  grn: '#22c55e', 
  poReleased: '#3b82f6', 
  notReleasedLate: '#ef4444', 
  notReleasedEarly: '#6b7280',
};

const viewLabels: Record<ViewType, string> = {
  total: 'Total Qty',
  grn: 'GRN',
  poReleased: 'PO Released',
  notReleasedLate: 'Not Released (Late)',
  notReleasedEarly: 'Not Released (Early)',
};


const QuantityBreakdownBar = ({ detail }: { detail: ProjectionDetail }) => {
    const total = detail.total.quantities.total || 0;
    if (total === 0) {
        return <div className="h-2 w-full bg-muted rounded-full"></div>;
    }

    const breakdowns = [
        { key: 'grn', value: detail.grn.quantities.total || 0, color: breakdownColors.grn, label: 'GRN' },
        { key: 'poReleased', value: detail.poReleased.quantities.total || 0, color: breakdownColors.poReleased, label: 'PO Released' },
        { key: 'notReleasedLate', value: detail.notReleasedLate.quantities.total || 0, color: breakdownColors.notReleasedLate, label: 'Not Released (Late)' },
        { key: 'notReleasedEarly', value: detail.notReleasedEarly.quantities.total || 0, color: breakdownColors.notReleasedEarly, label: 'Not Released (Early)' },
    ].sort((a,b) => {
        const order = ['grn', 'poReleased', 'notReleasedLate', 'notReleasedEarly'];
        return order.indexOf(a.key) - order.indexOf(b.key);
    });

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
                    <div className="space-y-1 text-xs">
                        <div className="font-bold mb-1 pb-1 border-b">Component Status</div>
                       {breakdowns.map(item => {
                           if (item.value === 0) return null;
                           const statusDetail = detail[item.key as Exclude<ViewType, 'total'>];
                           return (
                               <div key={item.key} className="flex items-center justify-between gap-4">
                                   <div className="flex items-center gap-2">
                                       <div className="h-2 w-2 rounded-full" style={{ backgroundColor: item.color }}></div>
                                       <span>{item.label}</span>
                                   </div>
                                   <div className="flex items-center gap-2">
                                       <span className="font-semibold">{statusDetail.quantities.total.toLocaleString()}</span>
                                       <span className="text-muted-foreground">({statusDetail.componentCount}/{detail.totalComponents})</span>
                                   </div>
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

    const order = useMemo(() => {
        if (!isScheduleLoaded || !orderId) return null;
        return orders.find(o => o.id === orderId);
    }, [orderId, orders, isScheduleLoaded]);
    
    const totals = useMemo(() => {
        if (!order?.projectionDetails) {
            const emptyTotals = SIZES.reduce((acc, size) => ({...acc, [size]: 0}), {} as Record<Size, number>);
            return {
                sizeTotals: emptyTotals,
                grandTotal: 0,
                componentCount: 0,
                totalComponents: 0,
            };
        }
    
        const sizeTotals = SIZES.reduce((acc, size) => {
            acc[size] = order.projectionDetails.reduce((sum, detail) => {
                const viewData = detail[selectedView] as StatusDetail;
                return sum + (viewData?.quantities?.[size] || 0);
            }, 0);
            return acc;
        }, {} as Record<Size, number>);
    
        const grandTotal = order.projectionDetails.reduce((sum, detail) => {
            const viewData = detail[selectedView] as StatusDetail;
            return sum + (viewData?.quantities?.total || 0);
        }, 0);

        const componentCount = order.projectionDetails[0]?.[selectedView]?.componentCount ?? 0;
        const totalComponents = order.projectionDetails[0]?.totalComponents ?? 0;
    
        return { sizeTotals, grandTotal, componentCount, totalComponents };
    }, [order, selectedView]);

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
                    <div className="flex items-center gap-2">
                        <Label htmlFor="view-select" className="text-sm font-medium">Show:</Label>
                         <Select value={selectedView} onValueChange={(value) => setSelectedView(value as ViewType)} >
                            <SelectTrigger id="view-select" className="w-[240px]">
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
                            {(order.projectionDetails || []).map((detail) => {
                                const currentViewData = detail[selectedView] as StatusDetail;

                                return (
                                <TableRow key={detail.projectionNumber}>
                                    <TableCell className="font-medium whitespace-nowrap">
                                        {detail.projectionNumber}
                                    </TableCell>
                                    <TableCell>{format(new Date(detail.projectionDate), 'dd/MM/yy')}</TableCell>
                                    <TableCell>{format(new Date(detail.receiptDate), 'dd/MM/yy')}</TableCell>
                                    
                                    {SIZES.map(size => (
                                        <TableCell key={`${detail.projectionNumber}-${size}`} className="text-right tabular-nums">
                                            {selectedView === 'total' ? (
                                                <div>
                                                    <span className="font-medium">{(currentViewData.quantities[size] || 0).toLocaleString()}</span>
                                                    {(detail.total.quantities[size] || 0) > 0 && <QuantityBreakdownBar detail={detail} />}
                                                </div>
                                            ) : (
                                                <div className="font-medium text-muted-foreground">
                                                  ({currentViewData.componentCount}/{detail.totalComponents})
                                                </div>
                                            )}
                                        </TableCell>
                                    ))}

                                    <TableCell className="text-right font-bold tabular-nums">
                                        <div>
                                            <span className="font-bold">{(currentViewData.quantities.total).toLocaleString()}</span>
                                            {selectedView === 'total' ? (
                                               detail.total.quantities.total > 0 && <QuantityBreakdownBar detail={detail} />
                                            ) : (
                                                <div className="text-xs text-muted-foreground font-normal">
                                                    ({currentViewData.componentCount}/{detail.totalComponents})
                                                </div>
                                            )}
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
                                            {selectedView === 'total' ? (
                                              (totals.sizeTotals[size] || 0).toLocaleString()
                                            ) : (
                                                <div className="font-medium text-muted-foreground">
                                                    ({totals.componentCount}/{totals.totalComponents})
                                                </div>
                                            )}
                                        </TableCell>
                                    ))}
                                    <TableCell className="text-right font-bold">
                                        {totals.grandTotal.toLocaleString()}
                                        {selectedView !== 'total' && (
                                            <div className="text-xs text-muted-foreground font-normal">
                                                ({totals.componentCount}/{totals.totalComponents})
                                            </div>
                                        )}
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
