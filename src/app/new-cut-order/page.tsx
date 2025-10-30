
'use client';

import { Suspense, useMemo, useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
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
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { getWeek } from 'date-fns';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { ProjectionRow, SizeBreakdown, Size, SyntheticPoRecord, CutOrderRecord } from '@/lib/types';
import { SIZES } from '@/lib/data';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { Separator } from '@/components/ui/separator';

function NewCutOrderPageContent() {
    const searchParams = useSearchParams();
    const orderId = searchParams.get('orderId');
    
    if (!orderId) {
        return <div className="flex items-center justify-center h-full">Order ID is missing. Please go back and select an order.</div>;
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
                             <BreadcrumbLink asChild>
                                <Link href={`/cut-order?orderId=${orderId}`}>Cut Order</Link>
                            </BreadcrumbLink>
                        </BreadcrumbItem>
                        <BreadcrumbSeparator />
                        <BreadcrumbItem>
                            <BreadcrumbPage>New Cut Order</BreadcrumbPage>
                        </BreadcrumbItem>
                    </BreadcrumbList>
                </Breadcrumb>

                 <div className="flex justify-between items-center mb-4 flex-shrink-0">
                    <div>
                        <h1 className="text-2xl font-bold">New Cut Order</h1>
                        <p className="text-muted-foreground">
                            For Order ID: {orderId}
                        </p>
                    </div>
                     <Button variant="outline" asChild>
                        <Link href={`/cut-order?orderId=${orderId}`}>
                            <ArrowLeft className="mr-2 h-4 w-4" />
                            Back to Cut Order
                        </Link>
                    </Button>
                </div>
                
                <NewCutOrderForm orderId={orderId} />
            </main>
        </div>
    );
}


function NewCutOrderForm({ orderId }: { orderId: string }) {
    const { orders, cutOrderRecords, addCutOrderRecord, syntheticPoRecords } = useSchedule();
    const router = useRouter();
    const [startWeek, setStartWeek] = useState<number | null>(null);
    const [endWeek, setEndWeek] = useState<number | null>(null);
    const [targetQuantity, setTargetQuantity] = useState<number>(0);
    const [projectionData, setProjectionData] = useState<ProjectionRow[]>([]);
    const [availableFrc, setAvailableFrc] = useState<SizeBreakdown | null>(null);
    const [suggestedPos, setSuggestedPos] = useState<SyntheticPoRecord[]>([]);
    const [remainingProdQty, setRemainingProdQty] = useState<number>(0);


    const order = useMemo(() => {
        return orders.find(o => o.id === orderId);
    }, [orderId, orders]);

    const currentWeek = useMemo(() => getWeek(new Date()), []);
    
    const coNumber = useMemo(() => {
        if (!order) return '';
        const orderCutOrders = cutOrderRecords.filter(co => co.orderId === orderId);
        return `CO-${order.ocn}-${(orderCutOrders.length + 1).toString().padStart(2, '0')}`;
    }, [order, orderId, cutOrderRecords]);

    const previousCarryoverQty = useMemo(() => {
        const orderCutOrders = cutOrderRecords
            .filter(co => co.orderId === orderId)
            .sort((a,b) => a.coNumber.localeCompare(b.coNumber));
        
        if (orderCutOrders.length > 0) {
            return orderCutOrders[orderCutOrders.length - 1].carryoverQty || 0;
        }
        return 0;
    }, [cutOrderRecords, orderId]);

    const productionWeeks = useMemo(() => {
        if (!order?.fcVsFcDetails || order.fcVsFcDetails.length === 0) return [];
        
        const allForecastWeeks = new Set<number>();
        order.fcVsFcDetails.forEach(snapshot => {
            Object.keys(snapshot.forecasts).forEach(weekStr => {
                allForecastWeeks.add(parseInt(weekStr.replace('W', ''), 10));
            });
        });
        const lastFcWeek = Math.max(...Array.from(allForecastWeeks));
        
        const firstProdWeek = Math.min(...allForecastWeeks);
        const endOfWeekRange = Math.max(firstProdWeek + 52, lastFcWeek);

        const weeks: number[] = [];
        for (let i = firstProdWeek; i <= endOfWeekRange; i++) {
            weeks.push(i);
        }

        return weeks.filter(week => week >= currentWeek);

    }, [order, currentWeek]);

    const availableEndWeeks = useMemo(() => {
        if (startWeek === null) return [];
        return productionWeeks.filter(week => week >= startWeek);
    }, [startWeek, productionWeeks]);

    useEffect(() => {
        if (order) {
            const firstSnapshot = order.fcVsFcDetails?.reduce((earliest, current) => 
                earliest.snapshotWeek < current.snapshotWeek ? earliest : current
            );
            if (!firstSnapshot) return;
            // The logic to calculate projections has been removed.
            setProjectionData([]);
        }
    }, [order]);

    useEffect(() => {
        if (startWeek !== null && endWeek !== null && order?.fcVsFcDetails) {
            const currentSnapshot = order.fcVsFcDetails.find(s => s.snapshotWeek === currentWeek);
            if (!currentSnapshot) { setTargetQuantity(0); return; }
            
            // This part of the logic has been simplified because runTentativePlanForHorizon was removed.
            // A more advanced calculation will be added later.
            let total = 0;
            for (let w = startWeek; w <= endWeek; w++) { 
                const weekKey = `W${w}`;
                const weekData = currentSnapshot.forecasts[weekKey];
                if(weekData) {
                    total += (weekData.total?.po || 0) + (weekData.total?.fc || 0);
                }
            }
            setTargetQuantity(Math.round(total) + previousCarryoverQty);

            // FRC Calculation
            const relevantFrcs = projectionData.filter(p => parseInt(p.ckWeek.slice(1)) < startWeek);
            const cumulativeFrc: SizeBreakdown = SIZES.reduce((acc, size) => ({ ...acc, [size]: 0 }), { total: 0 } as SizeBreakdown);
            relevantFrcs.forEach(p => {
                if(p.breakdown?.['FRC']) {
                    SIZES.forEach(size => {
                        cumulativeFrc[size] = (cumulativeFrc[size] || 0) + (p.breakdown!['FRC'][size] || 0);
                    });
                    cumulativeFrc.total += p.breakdown['FRC'].total || 0;
                }
            });

            const cumulativeCutOrders = cutOrderRecords
                .filter(co => co.orderId === orderId)
                .reduce((acc, record) => {
                    SIZES.forEach(size => {
                        acc[size] = (acc[size] || 0) + (record.quantities[size] || 0);
                    });
                    acc.total += record.quantities.total || 0;
                    return acc;
                }, SIZES.reduce((acc, size) => ({ ...acc, [size]: 0 }), { total: 0 } as SizeBreakdown));

            const finalAvailableFrc: SizeBreakdown = { total: 0 };
            SIZES.forEach(size => {
                const available = (cumulativeFrc[size] || 0) - (cumulativeCutOrders[size] || 0);
                finalAvailableFrc[size] = available > 0 ? available : 0;
            });
            finalAvailableFrc.total = SIZES.reduce((sum, size) => sum + (finalAvailableFrc[size] || 0), 0);
            
            setAvailableFrc(finalAvailableFrc);

        } else {
            setTargetQuantity(0);
            setAvailableFrc(null);
            setSuggestedPos([]);
            setRemainingProdQty(0);
        }
    }, [startWeek, endWeek, order, currentWeek, projectionData, cutOrderRecords, orderId, previousCarryoverQty]);
    
    useEffect(() => {
        if (startWeek === null || !availableFrc || targetQuantity <= 0) {
            setSuggestedPos([]);
            setRemainingProdQty(0);
            return;
        }

        const usedPoNumbers = new Set(cutOrderRecords.flatMap(co => co.poNumbers));
        
        const eligiblePos = syntheticPoRecords
            .filter(po => po.orderId === orderId && !usedPoNumbers.has(po.poNumber))
            .filter(po => parseInt(po.actualEhdWeek.replace('W','')) >= startWeek)
            .sort((a,b) => parseInt(a.actualEhdWeek.replace('W','')) - parseInt(b.actualEhdWeek.replace('W','')));

        const clubbedPos: SyntheticPoRecord[] = [];
        let cumulativePoQty = 0;
        const cumulativePoSizes: Partial<SizeBreakdown> = SIZES.reduce((acc, size) => ({...acc, [size]: 0}), {});

        for(const po of eligiblePos) {
            const newTotalQty = cumulativePoQty + po.quantities.total;
            if (newTotalQty > targetQuantity) {
                break; // Stop if total quantity exceeds target
            }

            let sizeLimitExceeded = false;
            for(const size of SIZES) {
                const newSizeQty = (cumulativePoSizes[size] || 0) + (po.quantities[size] || 0);
                if (newSizeQty > (availableFrc[size] || 0)) {
                    sizeLimitExceeded = true;
                    break;
                }
            }
            
            if (sizeLimitExceeded) {
                break; // Stop if any size exceeds available FRC
            }

            // If all checks pass, add the PO
            clubbedPos.push(po);
            cumulativePoQty = newTotalQty;
            for(const size of SIZES) {
                cumulativePoSizes[size] = (cumulativePoSizes[size] || 0) + (po.quantities[size] || 0);
            }
        }
        
        setSuggestedPos(clubbedPos);
        setRemainingProdQty(targetQuantity - cumulativePoQty);

    }, [startWeek, availableFrc, targetQuantity, syntheticPoRecords, cutOrderRecords, orderId]);

    const totalSuggestedQty = useMemo(() => {
        const totals: SizeBreakdown = { total: 0 };
        SIZES.forEach(size => totals[size] = 0);

        suggestedPos.forEach(po => {
            SIZES.forEach(size => {
                totals[size] = (totals[size] || 0) + (po.quantities[size] || 0);
            });
            totals.total += po.quantities.total;
        });
        return totals;
    }, [suggestedPos]);


    const handleSubmit = () => {
        if (!availableFrc || startWeek === null || endWeek === null) return;
        
        const newRecord: CutOrderRecord = {
            coNumber: coNumber,
            orderId: orderId,
            coWeekCoverage: `W${startWeek}-W${endWeek}`,
            quantities: totalSuggestedQty, // Use the suggested PO quantities for the cut order
            poNumbers: suggestedPos.map(po => po.poNumber),
            carryoverQty: remainingProdQty,
        };
        addCutOrderRecord(newRecord);
        router.push(`/cut-order?orderId=${orderId}`);
    }

    if (!order) {
        return <div className="flex items-center justify-center h-full">Order not found. Please go back and select an order.</div>;
    }

    return (
        <div className="space-y-6">
            <Card>
                <CardContent className="p-6 space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                        <div className="space-y-2">
                            <Label>CO #</Label>
                            <p className="font-semibold text-lg">{coNumber}</p>
                        </div>
                        <div className="space-y-2">
                            <Label>Current Week</Label>
                            <p className="font-semibold text-lg">W{currentWeek}</p>
                        </div>
                        <div className="space-y-2">
                            <Label>Previous Carryover Qty</Label>
                            <p className="font-semibold text-lg">{previousCarryoverQty.toLocaleString()}</p>
                        </div>
                    </div>
                     <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                         <div className="space-y-2">
                             <Label htmlFor="start-week">Start Week</Label>
                             <Select
                                onValueChange={(value) => {
                                    const week = parseInt(value, 10);
                                    setStartWeek(week);
                                    if (endWeek !== null && week > endWeek) {
                                        setEndWeek(null);
                                    }
                                }}
                                value={startWeek !== null ? String(startWeek) : ''}
                            >
                                <SelectTrigger id="start-week">
                                    <SelectValue placeholder="Select start week" />
                                </SelectTrigger>
                                <SelectContent>
                                    {productionWeeks.map(week => (
                                        <SelectItem key={week} value={String(week)}>
                                            W{week}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                         </div>
                         <div className="space-y-2">
                             <Label htmlFor="end-week">End Week</Label>
                             <Select
                                onValueChange={(value) => setEndWeek(parseInt(value, 10))}
                                value={endWeek !== null ? String(endWeek) : ''}
                                disabled={startWeek === null}
                            >
                                <SelectTrigger id="end-week">
                                    <SelectValue placeholder="Select end week" />
                                </SelectTrigger>
                                <SelectContent>
                                    {availableEndWeeks.map(week => (
                                        <SelectItem key={week} value={String(week)}>
                                            W{week}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                         </div>
                     </div>
                     {targetQuantity > 0 && (
                        <>
                            <Separator />
                            <div className="pt-4">
                                <Label>Target Production Quantity</Label>
                                <p className="font-semibold text-2xl text-primary">{targetQuantity.toLocaleString()}</p>
                                <p className="text-sm text-muted-foreground">Based on production plan for W{startWeek}-W{endWeek} + previous carryover</p>
                            </div>
                        </>
                     )}

                    {availableFrc && availableFrc.total > 0 && (
                        <>
                            <Separator />
                            <div className="pt-6">
                                <h3 className="text-lg font-semibold mb-4">Available FRC for Cut Order</h3>
                                <div className="overflow-x-auto">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Sizes</TableHead>
                                                {SIZES.map(size => (
                                                    <TableHead key={size} className="text-right">{size}</TableHead>
                                                ))}
                                                <TableHead className="text-right font-bold">Total</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            <TableRow>
                                                <TableCell className="font-medium">FRC Qty</TableCell>
                                                {SIZES.map(size => (
                                                    <TableCell key={size} className="text-right">
                                                        {(availableFrc[size] || 0).toLocaleString()}
                                                    </TableCell>
                                                ))}
                                                <TableCell className="text-right font-bold">
                                                    {(availableFrc.total || 0).toLocaleString()}
                                                </TableCell>
                                            </TableRow>
                                             <TableRow>
                                                <TableCell className="font-medium">Total Suggested CO Qty</TableCell>
                                                {SIZES.map(size => (
                                                    <TableCell key={size} className="text-right text-muted-foreground">
                                                        -{(totalSuggestedQty[size] || 0).toLocaleString()}
                                                    </TableCell>
                                                ))}
                                                <TableCell className="text-right font-bold text-muted-foreground">
                                                    -{(totalSuggestedQty.total || 0).toLocaleString()}
                                                </TableCell>
                                            </TableRow>
                                            <TableRow className="bg-muted/50">
                                                <TableCell className="font-bold">Projected FRC</TableCell>
                                                {SIZES.map(size => (
                                                    <TableCell key={size} className="text-right font-bold">
                                                        {((availableFrc[size] || 0) - (totalSuggestedQty[size] || 0)).toLocaleString()}
                                                    </TableCell>
                                                ))}
                                                <TableCell className="text-right font-bold">
                                                    {((availableFrc.total || 0) - (totalSuggestedQty.total || 0)).toLocaleString()}
                                                </TableCell>
                                            </TableRow>
                                        </TableBody>
                                    </Table>
                                </div>
                            </div>
                        </>
                    )}

                    {suggestedPos.length > 0 && (
                        <>
                            <Separator />
                            <div className="pt-6">
                                 <h3 className="text-lg font-semibold mb-4">Suggested POs for Cut Order</h3>
                                 <div className="overflow-x-auto">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>PO #</TableHead>
                                                <TableHead>EHD Week</TableHead>
                                                {SIZES.map(size => (
                                                    <TableHead key={size} className="text-right">{size}</TableHead>
                                                ))}
                                                <TableHead className="text-right font-bold">Total</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {suggestedPos.map(po => (
                                                <TableRow key={po.poNumber}>
                                                    <TableCell className="font-medium">{po.poNumber}</TableCell>
                                                    <TableCell>{po.actualEhdWeek}</TableCell>
                                                    {SIZES.map(size => (
                                                        <TableCell key={size} className="text-right">
                                                            {(po.quantities[size] || 0).toLocaleString()}
                                                        </TableCell>
                                                    ))}
                                                    <TableCell className="text-right font-bold">
                                                        {(po.quantities.total).toLocaleString()}
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                        <TableFooter>
                                            <TableRow>
                                                <TableCell colSpan={2} className="text-right font-bold">Total Suggested Qty</TableCell>
                                                {SIZES.map(size => {
                                                    const totalSize = suggestedPos.reduce((sum, po) => sum + (po.quantities[size] || 0), 0);
                                                    return <TableCell key={size} className="text-right font-bold">{totalSize.toLocaleString()}</TableCell>
                                                })}
                                                <TableCell className="text-right font-bold">
                                                    {suggestedPos.reduce((sum, po) => sum + po.quantities.total, 0).toLocaleString()}
                                                </TableCell>
                                            </TableRow>
                                        </TableFooter>
                                    </Table>
                                 </div>
                                <div className="pt-4 text-right">
                                    <Label>Remaining Production Target</Label>
                                    <p className="font-semibold text-2xl text-amber-600">{remainingProdQty.toLocaleString()}</p>
                                </div>
                            </div>
                        </>
                    )}
                </CardContent>
            </Card>

            {suggestedPos.length > 0 && (
                <div className="flex justify-end">
                    <Button onClick={handleSubmit}>Issue Cut Order</Button>
                </div>
            )}
        </div>
    );
}

export default function NewCutOrderPage() {
    return (
        <Suspense fallback={<div className="flex h-screen w-full items-center justify-center">Loading...</div>}>
            <NewCutOrderPageContent />
        </Suspense>
    );
}
