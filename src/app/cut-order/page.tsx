

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
import { ArrowLeft, Info } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableFooter,
} from "@/components/ui/table";
import { Card, CardContent } from '@/components/ui/card';
import { SIZES } from '@/lib/data';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import type { CutOrderRecord, SizeBreakdown, SyntheticPoRecord } from '@/lib/types';
import { Badge } from '@/components/ui/badge';


type MockCutOrderRecord = CutOrderRecord & {
    producedQuantities?: SizeBreakdown;
};

function CutOrderPageContent() {
    const searchParams = useSearchParams();
    const orderId = searchParams.get('orderId');
    const { orders, isScheduleLoaded, appMode, syntheticPoRecords } = useSchedule();
    
    const order = useMemo(() => {
        if (!isScheduleLoaded || !orderId) return null;
        return orders.find(o => o.id === orderId);
    }, [orderId, orders, isScheduleLoaded]);

    const filteredCutOrders: MockCutOrderRecord[] = useMemo(() => {
        if (!orderId) return [];

        const allPosForOrder = syntheticPoRecords.filter(po => po.orderId === orderId);
        
        if(allPosForOrder.length === 0) return [];

        const calculateQuantities = (poNumbers: string[]): SizeBreakdown => {
            const quantities: SizeBreakdown = SIZES.reduce((acc, size) => ({...acc, [size]: 0}), { total: 0 });
            allPosForOrder.forEach(po => {
                if (poNumbers.includes(po.poNumber)) {
                    SIZES.forEach(size => {
                        quantities[size] = (quantities[size] || 0) + (po.quantities[size] || 0);
                    });
                    quantities.total += po.quantities.total;
                }
            });
            return quantities;
        };
        
        const numPosToInclude = Math.ceil(allPosForOrder.length / 2);
        const poChunks = [];
        for (let i = 0; i < numPosToInclude; i += 2) {
          const chunk = allPosForOrder.slice(i, i + 2);
          if (chunk.length > 0) {
            poChunks.push(chunk.map(p => p.poNumber));
          }
        }
        
        const mockRecords: MockCutOrderRecord[] = poChunks.map((chunk, index) => {
            const firstPo = allPosForOrder.find(p => p.poNumber === chunk[0]);
            const firstPoWeek = firstPo ? parseInt(firstPo.originalEhdWeek.replace('W', ''), 10) : 0;
            const quantities = calculateQuantities(chunk);
            const status = index < poChunks.length - 2 ? 'Produced' : 'In Progress'; // Make last two 'In Progress'

            let producedQuantities: SizeBreakdown | undefined = undefined;
            if (status === 'In Progress') {
                producedQuantities = SIZES.reduce((acc, size) => ({...acc, [size]: 0}), { total: 0 });
                const productionProgress = 0.5 + Math.random() * 0.4; // 50% to 90%
                SIZES.forEach(size => {
                    const produced = Math.floor((quantities[size] || 0) * productionProgress);
                    producedQuantities![size] = produced;
                    producedQuantities!.total += produced;
                });
            }
            
            return {
                coNumber: `CO-7890${12 + index}`,
                orderId: orderId,
                coWeekCoverage: `W${firstPoWeek}-W${firstPoWeek + 1}`,
                poNumbers: chunk,
                quantities: quantities,
                status: status,
                producedQuantities: producedQuantities,
            }
        });
        
        return mockRecords.filter(co => co.orderId === orderId);
    }, [orderId, syntheticPoRecords]);


    const totals = useMemo(() => {
        const sizeTotals = SIZES.reduce((acc, size) => {
            acc[size] = 0;
            return acc;
        }, {} as Record<string, number>);

        let grandTotal = 0;

        filteredCutOrders.forEach(record => {
            grandTotal += record.quantities.total || 0;
            SIZES.forEach(size => {
                sizeTotals[size] += record.quantities[size] || 0;
            });
        });

        return { sizeTotals, grandTotal };
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
                                    <TableHead>Status</TableHead>
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
                                                    {co.status === 'In Progress' && co.producedQuantities ? (
                                                        <span>
                                                            {(co.producedQuantities[size] || 0).toLocaleString()} / {(co.quantities[size] || 0).toLocaleString()}
                                                        </span>
                                                    ) : (
                                                        (co.quantities[size] || 0) > 0 ? (co.quantities[size] || 0).toLocaleString() : '-'
                                                    )}
                                                </TableCell>
                                            ))}
                                            <TableCell className="text-right font-bold">
                                                {co.status === 'In Progress' && co.producedQuantities ? (
                                                    <span>
                                                        {(co.producedQuantities.total || 0).toLocaleString()} / {co.quantities.total.toLocaleString()}
                                                    </span>
                                                ) : (
                                                    co.quantities.total.toLocaleString()
                                                )}
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
                                            <TableCell>
                                                <Badge variant={co.status === 'Produced' ? 'default' : 'secondary'} className={co.status === 'Produced' ? 'bg-green-600' : 'bg-yellow-500'}>
                                                    {co.status}
                                                </Badge>
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
                                        <TableCell colSpan={2}></TableCell>
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
