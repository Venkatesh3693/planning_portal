
'use client';

import { Suspense, useMemo, useState } from 'react';
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
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { getWeek } from 'date-fns';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { runTentativePlanForHorizon } from '@/lib/tna-calculator';

function NewCutOrderForm({ orderId }: { orderId: string }) {
    const { orders, cutOrderRecords } = useSchedule();
    const [startWeek, setStartWeek] = useState<number | null>(null);
    const [endWeek, setEndWeek] = useState<number | null>(null);

    const order = useMemo(() => {
        return orders.find(o => o.id === orderId);
    }, [orderId, orders]);

    const currentWeek = useMemo(() => getWeek(new Date()), []);
    
    const coNumber = useMemo(() => {
        if (!order) return '';
        const orderCutOrders = cutOrderRecords.filter(co => co.orderId === orderId);
        return `CO-${order.ocn}-${(orderCutOrders.length + 1).toString().padStart(2, '0')}`;
    }, [order, orderId, cutOrderRecords]);

    const productionWeeks = useMemo(() => {
        if (!order?.fcVsFcDetails || order.fcVsFcDetails.length === 0) return [];
        
        // Find the earliest snapshot to generate a full tentative plan
        const firstSnapshot = order.fcVsFcDetails.reduce((earliest, current) => 
            earliest.snapshotWeek < current.snapshotWeek ? earliest : current
        );

        const weeklyTotals: Record<string, number> = {};
        Object.entries(firstSnapshot.forecasts).forEach(([week, data]) => {
            weeklyTotals[week] = (data.total?.po || 0) + (data.total?.fc || 0);
        });

        // Run the tentative plan based on the earliest forecast
        const { plan } = runTentativePlanForHorizon(firstSnapshot.snapshotWeek, null, weeklyTotals, order, 0);

        const allPlanWeeks = Object.keys(plan)
            .filter(w => plan[w] > 0)
            .map(w => parseInt(w.slice(1)));

        if (allPlanWeeks.length === 0) return [];
        
        const firstProdWeek = Math.min(...allPlanWeeks);
        const lastProdWeek = Math.max(...allPlanWeeks);
        
        // Also consider all forecast weeks to create a full range to the end of the season
        const allForecastWeeks = new Set<number>();
        order.fcVsFcDetails.forEach(snapshot => {
            Object.keys(snapshot.forecasts).forEach(weekStr => {
                allForecastWeeks.add(parseInt(weekStr.replace('W', ''), 10));
            });
        });
        const lastFcWeek = Math.max(...Array.from(allForecastWeeks));
        const endOfWeekRange = Math.max(lastProdWeek, lastFcWeek);

        const weeks: number[] = [];
        for (let i = firstProdWeek; i <= endOfWeekRange; i++) {
            weeks.push(i);
        }

        return weeks;
    }, [order]);

    const availableEndWeeks = useMemo(() => {
        if (startWeek === null) return [];
        return productionWeeks.filter(week => week >= startWeek);
    }, [startWeek, productionWeeks]);

    if (!order) {
        return <div className="flex items-center justify-center h-full">Order not found. Please go back and select an order.</div>;
    }

    return (
        <Card>
            <CardContent className="p-6">
                <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="space-y-2">
                            <Label>CO #</Label>
                            <p className="font-semibold text-lg">{coNumber}</p>
                        </div>
                        <div className="space-y-2">
                            <Label>Current Week</Label>
                             <p className="font-semibold text-lg">W{currentWeek}</p>
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
                </div>
            </CardContent>
        </Card>
    );
}


function NewCutOrderPageContent() {
    const searchParams = useSearchParams();
    const orderId = searchParams.get('orderId');
    const { isScheduleLoaded } = useSchedule();

    if (!isScheduleLoaded) {
        return <div className="flex items-center justify-center h-full">Loading order data...</div>;
    }
    
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

export default function NewCutOrderPage() {
    return (
        <Suspense fallback={<div className="flex h-screen w-full items-center justify-center">Loading...</div>}>
            <NewCutOrderPageContent />
        </Suspense>
    );
}
