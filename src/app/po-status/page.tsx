
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
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableFooter,
} from '@/components/ui/table';
import { SIZES } from '@/lib/data';
import type { Size } from '@/lib/types';


type SyntheticPoRecord = {
    poNumber: string;
    ehdWeek: string;
    destination: string;
    quantities: Record<Size, number>;
    total: number;
};

function PoStatusPageContent() {
    const searchParams = useSearchParams();
    const orderId = searchParams.get('orderId');
    const { orders, isScheduleLoaded } = useSchedule();
    
    const order = useMemo(() => {
        if (!isScheduleLoaded || !orderId) return null;
        return orders.find(o => o.id === orderId);
    }, [orderId, orders, isScheduleLoaded]);

    const poRecords: SyntheticPoRecord[] = useMemo(() => {
        if (!order || !order.fcVsFcDetails || order.fcVsFcDetails.length === 0 || !order.demandDetails) {
            return [];
        }

        const latestSnapshot = [...order.fcVsFcDetails].sort((a, b) => b.snapshotWeek - a.snapshotWeek)[0];
        if (!latestSnapshot) return [];

        const totalSelectionQty = order.demandDetails.reduce((sum, d) => sum + d.selectionQty, 0);
        if (totalSelectionQty === 0) return [];
        
        const generatedRecords: SyntheticPoRecord[] = [];

        const currentWeek = new Date().getFullYear();

        Object.entries(latestSnapshot.forecasts).forEach(([weekKey, sizeBreakdown]) => {
            const weekNumber = parseInt(weekKey.replace('W', ''));
            if(weekNumber > currentWeek) return;

            const totalPoInWeek = sizeBreakdown.total?.po || 0;

            if (totalPoInWeek > 0) {
                order.demandDetails?.forEach(destDetail => {
                    const destinationFactor = destDetail.selectionQty / totalSelectionQty;
                    if (destinationFactor === 0) return;

                    const record: SyntheticPoRecord = {
                        poNumber: `PO-${destDetail.destination.substring(0,3).toUpperCase()}-${weekKey}`,
                        ehdWeek: weekKey,
                        destination: destDetail.destination,
                        quantities: {} as Record<Size, number>,
                        total: 0,
                    };
                    
                    let recordTotal = 0;
                    SIZES.forEach(size => {
                        const sizePoQty = sizeBreakdown[size]?.po || 0;
                        const destSizeQty = Math.round(sizePoQty * destinationFactor);
                        record.quantities[size] = destSizeQty;
                        recordTotal += destSizeQty;
                    });
                    
                    record.total = recordTotal;
                    if(record.total > 0) {
                        generatedRecords.push(record);
                    }
                });
            }
        });
        
        return generatedRecords;

    }, [order]);
    
    const totals = useMemo(() => {
        const sizeTotals: Record<Size, number> = SIZES.reduce((acc, size) => ({...acc, [size]: 0}), {} as Record<Size, number>);
        let grandTotal = 0;
        
        poRecords.forEach(record => {
            grandTotal += record.total;
            SIZES.forEach(size => {
                sizeTotals[size] += record.quantities[size] || 0;
            });
        });
        
        return { sizeTotals, grandTotal };
    }, [poRecords]);


    if (!isScheduleLoaded) {
        return <div className="flex items-center justify-center h-full">Loading data...</div>;
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
                            <BreadcrumbPage>PO Status</BreadcrumbPage>
                        </BreadcrumbItem>
                    </BreadcrumbList>
                </Breadcrumb>

                 <div className="flex justify-between items-center mb-4 flex-shrink-0">
                    <div>
                        <h1 className="text-2xl font-bold">Confirmed Purchase Orders</h1>
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
                
                <div className="border rounded-lg overflow-auto flex-1">
                    {poRecords.length > 0 ? (
                        <Table>
                            <TableHeader className="sticky top-0 bg-background">
                                <TableRow>
                                    <TableHead>PO Number</TableHead>
                                    <TableHead>Destination</TableHead>
                                    <TableHead>EHD Week</TableHead>
                                    {SIZES.map(s => <TableHead key={s} className="text-right">{s}</TableHead>)}
                                    <TableHead className="text-right font-bold">Total Qty</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {poRecords.map(po => (
                                    <TableRow key={po.poNumber}>
                                        <TableCell className="font-medium">{po.poNumber}</TableCell>
                                        <TableCell>{po.destination}</TableCell>
                                        <TableCell>{po.ehdWeek}</TableCell>
                                        {SIZES.map(s => <TableCell key={s} className="text-right">{(po.quantities[s] || 0).toLocaleString()}</TableCell>)}
                                        <TableCell className="text-right font-bold">{po.total.toLocaleString()}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                            <TableFooter className="sticky bottom-0 bg-background">
                                <TableRow>
                                    <TableCell colSpan={3} className="font-bold">Total</TableCell>
                                    {SIZES.map(s => (
                                        <TableCell key={`total-${s}`} className="text-right font-bold">
                                            {(totals.sizeTotals[s] || 0).toLocaleString()}
                                        </TableCell>
                                    ))}
                                    <TableCell className="text-right font-bold">{totals.grandTotal.toLocaleString()}</TableCell>
                                </TableRow>
                            </TableFooter>
                        </Table>
                    ) : (
                        <div className="flex items-center justify-center h-full text-muted-foreground">
                            <p>No confirmed PO data found in the latest forecast for this order.</p>
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
}

export default function PoStatusPage() {
    return (
        <Suspense fallback={<div>Loading...</div>}>
            <PoStatusPageContent />
        </Suspense>
    );
}
