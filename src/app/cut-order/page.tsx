

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
import { ArrowLeft, PlusCircle, Info } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableFooter,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { SIZES } from '@/lib/data';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';


function CutOrderPageContent() {
    const searchParams = useSearchParams();
    const orderId = searchParams.get('orderId');
    const { orders, isScheduleLoaded, appMode, cutOrderRecords } = useSchedule();
    
    const order = useMemo(() => {
        if (!isScheduleLoaded || !orderId) return null;
        return orders.find(o => o.id === orderId);
    }, [orderId, orders, isScheduleLoaded]);

    const filteredCutOrders = useMemo(() => {
        if (!orderId) return [];
        return cutOrderRecords.filter(co => co.orderId === orderId);
    }, [orderId, cutOrderRecords])

    const totals = useMemo(() => {
        const sizeTotals = SIZES.reduce((acc, size) => {
            acc[size] = 0;
            return acc;
        }, {} as Record<string, number>);

        let grandTotal = 0;
        let carryoverTotal = 0;

        filteredCutOrders.forEach(record => {
            grandTotal += record.quantities.total || 0;
            carryoverTotal += record.carryoverQty || 0;
            SIZES.forEach(size => {
                sizeTotals[size] += record.quantities[size] || 0;
            });
        });

        return { sizeTotals, grandTotal, carryoverTotal };
    }, [filteredCutOrders]);

    if (!isScheduleLoaded) {
        return <div className="flex items-center justify-center h-full">Loading data...</div>;
    }

    if (appMode === 'gup') {
        return (
            <div className="flex h-screen flex-col">
              <Header />
              <main className="flex-1 p-4 sm:p-6 lg:p-8 flex items-center justify-center">
                <div className="text-center">
                  <h2 className="text-xl font-semibold">Cut Order Not Available</h2>
                  <p className="mt-2 text-muted-foreground">
                    This view is only applicable for GUT mode.
                  </p>
                  <Button asChild className="mt-6">
                    <Link href="/">View GUP Schedule</Link>
                  </Button>
                </div>
              </main>
            </div>
        )
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
                            <BreadcrumbPage>Cut Order</BreadcrumbPage>
                        </BreadcrumbItem>
                    </BreadcrumbList>
                </Breadcrumb>

                 <div className="flex justify-between items-center mb-4 flex-shrink-0">
                    <div>
                        <h1 className="text-2xl font-bold">Cut Order Issued</h1>
                        <p className="text-muted-foreground">
                            Order ID: {order.id}
                        </p>
                    </div>
                     <div className="flex items-center gap-2">
                        <Button asChild>
                           <Link href={`/new-cut-order?orderId=${orderId}`}>
                                <PlusCircle className="mr-2 h-4 w-4" />
                                New CO
                           </Link>
                        </Button>
                        <Button variant="outline" asChild>
                            <Link href="/orders">
                                <ArrowLeft className="mr-2 h-4 w-4" />
                                Back to Orders
                            </Link>
                        </Button>
                    </div>
                </div>
                
                <Card>
                    <CardContent className="p-0">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>CO #</TableHead>
                                    <TableHead>CO Week Coverage</TableHead>
                                    {SIZES.map(size => (
                                      <TableHead key={size} className="text-right">{size}</TableHead>
                                    ))}
                                    <TableHead className="text-right font-bold">Total</TableHead>
                                    <TableHead className="text-center">POs</TableHead>
                                    <TableHead className="text-right">Carryover Qty</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredCutOrders.length > 0 ? (
                                    filteredCutOrders.map(co => (
                                        <TableRow key={co.coNumber}>
                                            <TableCell className="font-medium">{co.coNumber}</TableCell>
                                            <TableCell>{co.coWeekCoverage}</TableCell>
                                            {SIZES.map(size => (
                                                <TableCell key={size} className="text-right">
                                                    {(co.quantities[size] || 0).toLocaleString()}
                                                </TableCell>
                                            ))}
                                            <TableCell className="text-right font-bold">
                                                {co.quantities.total.toLocaleString()}
                                            </TableCell>
                                            <TableCell className="text-center">
                                                {co.poNumbers && co.poNumbers.length > 0 && (
                                                    <TooltipProvider>
                                                        <Tooltip>
                                                            <TooltipTrigger>
                                                                <Info className="h-4 w-4 text-muted-foreground mx-auto" />
                                                            </TooltipTrigger>
                                                            <TooltipContent>
                                                                <div className="flex flex-col gap-1 p-2">
                                                                {co.poNumbers.map(po => <span key={po}>{po}</span>)}
                                                                </div>
                                                            </TooltipContent>
                                                        </Tooltip>
                                                    </TooltipProvider>
                                                )}
                                            </TableCell>
                                             <TableCell className="text-right font-medium">
                                                {(co.carryoverQty || 0).toLocaleString()}
                                             </TableCell>
                                        </TableRow>
                                    ))
                                ) : (
                                    <TableRow>
                                        <TableCell colSpan={SIZES.length + 5} className="h-24 text-center">
                                            No cut orders issued yet for this order.
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                            {filteredCutOrders.length > 0 && (
                                <TableFooter>
                                    <TableRow>
                                        <TableCell colSpan={2} className="font-bold text-right">Total</TableCell>
                                        {SIZES.map(size => (
                                            <TableCell key={`total-${size}`} className="text-right font-bold">
                                                {(totals.sizeTotals[size] || 0).toLocaleString()}
                                            </TableCell>
                                        ))}
                                        <TableCell className="text-right font-bold">
                                            {totals.grandTotal.toLocaleString()}
                                        </TableCell>
                                        <TableCell></TableCell>
                                        <TableCell className="text-right font-bold">
                                            {totals.carryoverTotal.toLocaleString()}
                                        </TableCell>
                                    </TableRow>
                                </TableFooter>
                            )}
                        </Table>
                    </CardContent>
                </Card>
            </main>
        </div>
    );
}

export default function CutOrderPage() {
    return (
        <Suspense fallback={<div>Loading...</div>}>
            <CutOrderPageContent />
        </Suspense>
    );
}
