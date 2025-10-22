
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { SIZES } from '@/lib/data';
import type { SyntheticPoRecord } from '@/lib/types';
import { format, getWeek } from 'date-fns';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

function PoStatusPageContent() {
    const searchParams = useSearchParams();
    const orderId = searchParams.get('orderId');
    const { orders, isScheduleLoaded, syntheticPoRecords, updatePoEhd } = useSchedule();
    const [currentSnapshotWeek, setCurrentSnapshotWeek] = useState(0);

    useEffect(() => {
        setCurrentSnapshotWeek(getWeek(new Date()));
    }, []);
    
    const order = useMemo(() => {
        if (!isScheduleLoaded || !orderId) return null;
        return orders.find(o => o.id === orderId);
    }, [orderId, orders, isScheduleLoaded]);

    const poRecordsForOrder = useMemo(() => {
        if (!orderId) return [];
        return syntheticPoRecords.filter(r => r.orderId === orderId);
    }, [orderId, syntheticPoRecords]);

    const handleEhdChange = (poNumber: string, newWeek: string) => {
        if (!orderId) return;
        updatePoEhd(orderId, poNumber, newWeek);
    };

    const generateWeekOptions = (startWeek: number) => {
        const options: number[] = [];
        for (let i = 0; i < 26; i++) { // Show next 6 months
            options.push(startWeek + i);
        }
        return options;
    };


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
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>PO Number</TableHead>
                                <TableHead>Issue date</TableHead>
                                {SIZES.map(size => (
                                    <TableHead key={size} className="text-right">{size}</TableHead>
                                ))}
                                <TableHead className="text-right font-bold">Total Qty</TableHead>
                                <TableHead>Destination</TableHead>
                                <TableHead>Original EHD</TableHead>
                                <TableHead>Actual EHD</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {poRecordsForOrder.length > 0 ? (
                                poRecordsForOrder.map(po => {
                                    const startWeekNum = parseInt(po.originalEhdWeek.replace('W', ''), 10);
                                    const weekOptions = generateWeekOptions(startWeekNum);
                                    return (
                                        <TableRow key={po.poNumber}>
                                            <TableCell className="font-medium">{po.poNumber}</TableCell>
                                            <TableCell>{format(po.issueDate, 'dd/MM/yy')}</TableCell>
                                            {SIZES.map(size => (
                                                <TableCell key={size} className="text-right">
                                                    {(po.quantities[size] || 0).toLocaleString()}
                                                </TableCell>
                                            ))}
                                            <TableCell className="text-right font-bold">
                                                {(po.quantities.total || 0).toLocaleString()}
                                            </TableCell>
                                            <TableCell>{po.destination}</TableCell>
                                            <TableCell>{po.originalEhdWeek}</TableCell>
                                            <TableCell>
                                                <Select
                                                    value={po.actualEhdWeek}
                                                    onValueChange={(newWeek) => handleEhdChange(po.poNumber, newWeek)}
                                                >
                                                    <SelectTrigger className="w-24">
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {weekOptions.map(week => (
                                                            <SelectItem key={week} value={`W${week}`}>
                                                                W{week}
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </TableCell>
                                        </TableRow>
                                    );
                                })
                            ) : (
                                <TableRow>
                                    <TableCell colSpan={SIZES.length + 5} className="h-24 text-center">
                                        No PO data to display.
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
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
