

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
  TableFooter
} from '@/components/ui/table';
import { SIZES } from '@/lib/data';
import type { Size } from '@/lib/types';
import { format, getWeek } from 'date-fns';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

const statusConfig = {
    production: {
        'not-started': { label: 'Not Started', color: 'bg-red-500' },
        'in-progress': { label: 'In Progress', color: 'bg-yellow-500' },
        'completed': { label: 'Completed', color: 'bg-green-500' },
    },
    inspection: {
        'not-started': { label: 'Not Started', color: 'bg-red-500' },
        'in-progress': { label: 'In Progress', color: 'bg-yellow-500' },
        'completed': { label: 'Completed', color: 'bg-green-500' },
    },
    shipping: {
        'not-shipped': { label: 'Not Shipped', color: 'bg-red-500' },
        'shipped-late': { label: 'Shipped Late', color: 'bg-yellow-500' },
        'shipped-on-time': { label: 'Shipped On Time', color: 'bg-green-500' },
    }
}

const StatusIndicator = ({ status, type }: { status: keyof typeof statusConfig.production | keyof typeof statusConfig.shipping; type: 'production' | 'inspection' | 'shipping' }) => {
    const config = statusConfig[type][status as 'not-started'];
    if (!config) return null;

    return (
        <TooltipProvider>
            <Tooltip>
                <TooltipTrigger>
                    <div className={cn("h-3 w-3 rounded-full mx-auto", config.color)} />
                </TooltipTrigger>
                <TooltipContent>
                    <p>{config.label}</p>
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
    )
}


function PoStatusPageContent() {
    const searchParams = useSearchParams();
    const orderId = searchParams.get('orderId');
    const { orders, isScheduleLoaded } = useSchedule();
    
    const order = useMemo(() => {
        if (!isScheduleLoaded || !orderId) return null;
        return orders.find(o => o.id === orderId);
    }, [orderId, orders, isScheduleLoaded]);

    const totals = useMemo(() => {
        if (!order?.poDetails) return { total: 0 };
        const sizeTotals = SIZES.reduce((acc, size) => {
            acc[size] = (order.poDetails || []).reduce((sum, po) => sum + (po.quantities[size] || 0), 0);
            return acc;
        }, {} as Record<Size, number>);

        const grandTotal = (order.poDetails || []).reduce((sum, po) => sum + po.quantities.total, 0);
        return { ...sizeTotals, total: grandTotal };
    }, [order]);


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
                
                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader className="sticky top-0 bg-background">
                      <TableRow>
                        <TableHead>PO Number</TableHead>
                        <TableHead>EHD</TableHead>
                        <TableHead>EHD Week</TableHead>
                        <TableHead>CHD</TableHead>
                        <TableHead>Destination</TableHead>
                        {SIZES.map(size => (
                          <TableHead key={size} className="text-right">{size}</TableHead>
                        ))}
                        <TableHead className="text-right font-bold">Total</TableHead>
                        <TableHead className="text-center">Produced</TableHead>
                        <TableHead className="text-center">Inspection</TableHead>
                        <TableHead className="text-center">Shipped</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(order.poDetails || []).map((po) => (
                        <TableRow key={po.poNumber}>
                          <TableCell className="font-medium whitespace-nowrap">{po.poNumber}</TableCell>
                          <TableCell>{format(po.ehd, 'dd/MM/yy')}</TableCell>
                          <TableCell>{getWeek(po.ehd, { weekStartsOn: 1 })}</TableCell>
                          <TableCell>{format(po.chd, 'dd/MM/yy')}</TableCell>
                          <TableCell>{po.destination}</TableCell>
                          {SIZES.map(size => (
                            <TableCell key={size} className="text-right">
                              {(po.quantities[size] || 0).toLocaleString()}
                            </TableCell>
                          ))}
                          <TableCell className="text-right font-bold">
                            {po.quantities.total.toLocaleString()}
                          </TableCell>
                           <TableCell className="text-center">
                            <StatusIndicator type="production" status={po.productionStatus} />
                          </TableCell>
                          <TableCell className="text-center">
                            <StatusIndicator type="inspection" status={po.inspectionStatus} />
                          </TableCell>
                          <TableCell className="text-center">
                            <StatusIndicator type="shipping" status={po.shippingStatus} />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                    <TableFooter className="sticky bottom-0 bg-background">
                      <TableRow>
                        <TableCell colSpan={5} className="font-bold">Total</TableCell>
                         {SIZES.map(size => (
                            <TableCell key={`total-${size}`} className="text-right font-bold">
                              {(totals[size as Size] || 0).toLocaleString()}
                            </TableCell>
                          ))}
                        <TableCell className="text-right font-bold">
                          {totals.total.toLocaleString()}
                        </TableCell>
                        <TableCell colSpan={3}></TableCell>
                      </TableRow>
                    </TableFooter>
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
