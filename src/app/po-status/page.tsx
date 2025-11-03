
'use client';

import { Suspense, useMemo, useState, useEffect } from 'react';
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
import type { SyntheticPoRecord, Size, SizeBreakdown } from '@/lib/types';
import { SIZES } from '@/lib/data';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';


const PoDetailsTable = ({ records }: { records: SyntheticPoRecord[] }) => {
    const totals = useMemo(() => {
        const sizeTotals = SIZES.reduce((acc, size) => {
            acc[size] = 0;
            return acc;
        }, {} as Record<Size, number>);

        let grandTotal = 0;

        records.forEach(record => {
            grandTotal += record.quantities.total || 0;
            SIZES.forEach(size => {
                sizeTotals[size] += record.quantities[size] || 0;
            });
        });

        return { sizeTotals, grandTotal };
    }, [records]);


    if (records.length === 0) {
        return (
            <div className="flex items-center justify-center h-48 text-muted-foreground border rounded-lg">
                No released POs found for this order based on the current criteria.
            </div>
        );
    }
    
    return (
        <Table>
            <TableHeader>
                <TableRow>
                    <TableHead>PO #</TableHead>
                    <TableHead>Destination</TableHead>
                    <TableHead>Snapshot Week</TableHead>
                    <TableHead>EHD Week</TableHead>
                    {SIZES.map(size => (
                        <TableHead key={size} className="text-right">{size}</TableHead>
                    ))}
                    <TableHead className="text-right font-bold">Total</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {records.map(record => (
                    <TableRow key={record.poNumber}>
                        <TableCell className="font-medium whitespace-nowrap">{record.poNumber}</TableCell>
                        <TableCell>{record.destination}</TableCell>
                        <TableCell>{record.issueWeek}</TableCell>
                        <TableCell>{record.originalEhdWeek}</TableCell>
                        {SIZES.map(size => (
                             <TableCell key={size} className="text-right">
                                {(record.quantities[size] || 0).toLocaleString()}
                            </TableCell>
                        ))}
                        <TableCell className="text-right font-bold">
                            {(record.quantities.total || 0).toLocaleString()}
                        </TableCell>
                    </TableRow>
                ))}
            </TableBody>
            <TableFooter>
                <TableRow>
                    <TableCell colSpan={4} className="font-bold text-right">Total</TableCell>
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
    )
}


function PoStatusPageContent() {
    const searchParams = useSearchParams();
    const orderId = searchParams.get('orderId');
    const { orders, isScheduleLoaded, syntheticPoRecords, updatePoEhd } = useSchedule();
    
    const order = useMemo(() => {
        if (!isScheduleLoaded || !orderId) return null;
        return orders.find(o => o.id === orderId);
    }, [orderId, orders, isScheduleLoaded]);

    const filteredRecords = useMemo(() => {
        if (!orderId) return [];
        return syntheticPoRecords.filter(r => r.orderId === orderId);
    }, [orderId, syntheticPoRecords]);


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
                        <h1 className="text-2xl font-bold">PO Status</h1>
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
                   <PoDetailsTable records={filteredRecords} />
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
