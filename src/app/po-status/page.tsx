

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
  TableFooter,
} from '@/components/ui/table';
import { SIZES } from '@/lib/data';
import type { Size, SyntheticPoRecord } from '@/lib/types';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';



function PoStatusPageContent() {
    const searchParams = useSearchParams();
    const orderId = searchParams.get('orderId');
    const { 
        orders, 
        isScheduleLoaded, 
        syntheticPoRecords, 
        setSyntheticPoRecords,
        updatePoEhd 
    } = useSchedule();
    
    const order = useMemo(() => {
        if (!isScheduleLoaded || !orderId) return null;
        return orders.find(o => o.id === orderId);
    }, [orderId, orders, isScheduleLoaded]);

    useEffect(() => {
        if (order) {
            const { poRecords: initialPoRecords } = generatePoRecords(order);
            setSyntheticPoRecords(initialPoRecords);
        } else {
            setSyntheticPoRecords([]);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [order]); // Run only when order changes


    const generatePoRecords = (order: any) => {
        if (!order || !order.fcVsFcDetails || order.fcVsFcDetails.length === 0 || !order.demandDetails) {
            return { poRecords: [], allWeeks: [] };
        }

        const latestSnapshot = [...order.fcVsFcDetails].sort((a: any, b: any) => b.snapshotWeek - a.snapshotWeek)[0];
        if (!latestSnapshot) return { poRecords: [], allWeeks: [] };

        const totalSelectionQty = order.demandDetails.reduce((sum: number, d: any) => sum + d.selectionQty, 0);
        if (totalSelectionQty === 0) return { poRecords: [], allWeeks: [] };
        
        const generatedRecords: SyntheticPoRecord[] = [];
        
        const weeksInSnapshot = Object.keys(latestSnapshot.forecasts).sort((a, b) => {
            return parseInt(a.replace('W','')) - parseInt(b.replace('W',''));
        });

        weeksInSnapshot.forEach((weekKey) => {
            const totalPoInWeek = latestSnapshot.forecasts[weekKey].total?.po || 0;

            if (totalPoInWeek > 0) {
                order.demandDetails?.forEach((destDetail: any) => {
                    const destinationFactor = destDetail.selectionQty / totalSelectionQty;
                    if (destinationFactor === 0) return;

                    const poNumber = `PO-${destDetail.destination.substring(0,3).toUpperCase()}-${weekKey}`;
                    const record: SyntheticPoRecord = {
                        poNumber: poNumber,
                        originalEhdWeek: weekKey,
                        actualEhdWeek: weekKey,
                        destination: destDetail.destination,
                        quantities: {} as Record<Size, number>,
                        total: 0,
                    };
                    
                    let recordTotal = 0;
                    SIZES.forEach(size => {
                        const sizePoQty = latestSnapshot.forecasts[weekKey][size]?.po || 0;
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
        
        return { poRecords: generatedRecords.sort((a,b) => a.poNumber.localeCompare(b.poNumber)), allWeeks: weeksInSnapshot };
    };

    const allWeeks = useMemo(() => {
        if (!order || !order.fcVsFcDetails || order.fcVsFcDetails.length === 0) return [];
        const latestSnapshot = [...order.fcVsFcDetails].sort((a, b) => b.snapshotWeek - a.snapshotWeek)[0];
        if (!latestSnapshot) return [];
        return Object.keys(latestSnapshot.forecasts).sort((a, b) => {
            return parseInt(a.replace('W','')) - parseInt(b.replace('W',''));
        });
    }, [order]);
    
    const totals = useMemo(() => {
        const sizeTotals: Record<Size, number> = SIZES.reduce((acc, size) => ({...acc, [size]: 0}), {} as Record<Size, number>);
        let grandTotal = 0;
        
        syntheticPoRecords.forEach(record => {
            grandTotal += record.total;
            SIZES.forEach(size => {
                sizeTotals[size] += record.quantities[size] || 0;
            });
        });
        
        return { sizeTotals, grandTotal };
    }, [syntheticPoRecords]);

    const handleActualEhdChange = (poNumber: string, newWeek: string) => {
        if (!order) return;
        const recordToUpdate = syntheticPoRecords.find(po => po.poNumber === poNumber);
        if (!recordToUpdate || recordToUpdate.actualEhdWeek === newWeek) return;

        // Call the central update function
        updatePoEhd(order.id, poNumber, newWeek);
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
                    {syntheticPoRecords.length > 0 ? (
                        <Table>
                            <TableHeader className="sticky top-0 bg-background">
                                <TableRow>
                                    <TableHead>PO Number</TableHead>
                                    {SIZES.map(s => <TableHead key={s} className="text-right">{s}</TableHead>)}
                                    <TableHead className="text-right font-bold">Total Qty</TableHead>
                                    <TableHead>Destination</TableHead>
                                    <TableHead>EHD Week</TableHead>
                                    <TableHead>Actual EHD</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {syntheticPoRecords.map(po => {
                                  const ehdWeekNum = parseInt(po.originalEhdWeek.replace('W',''));
                                  const futureWeeks = allWeeks.filter(w => parseInt(w.replace('W','')) >= ehdWeekNum);

                                  return (
                                    <TableRow key={po.poNumber}>
                                        <TableCell className="font-medium">{po.poNumber}</TableCell>
                                        {SIZES.map(s => <TableCell key={s} className="text-right">{(po.quantities[s] || 0).toLocaleString()}</TableCell>)}
                                        <TableCell className="text-right font-bold">{po.total.toLocaleString()}</TableCell>
                                        <TableCell>{po.destination}</TableCell>
                                        <TableCell>{po.originalEhdWeek}</TableCell>
                                        <TableCell>
                                            <Select 
                                                value={po.actualEhdWeek}
                                                onValueChange={(value) => handleActualEhdChange(po.poNumber, value)}
                                            >
                                                <SelectTrigger className="w-[120px]">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {futureWeeks.map(week => (
                                                        <SelectItem key={week} value={week}>{week}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </TableCell>
                                    </TableRow>
                                  )
                                })}
                            </TableBody>
                            <TableFooter className="sticky bottom-0 bg-background">
                                <TableRow>
                                    <TableCell colSpan={1} className="font-bold">Total</TableCell>
                                    {SIZES.map(s => (
                                        <TableCell key={`total-${s}`} className="text-right font-bold">
                                            {(totals.sizeTotals[s] || 0).toLocaleString()}
                                        </TableCell>
                                    ))}
                                    <TableCell className="text-right font-bold">{totals.grandTotal.toLocaleString()}</TableCell>
                                    <TableCell colSpan={3}></TableCell>
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
