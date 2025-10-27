
'use client';

import { Suspense, useMemo, useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
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
import { useSchedule } from '@/context/schedule-provider';
import { getWeek } from 'date-fns';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { runTentativePlanForHorizon } from '@/lib/tna-calculator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

function NewProjectionForm({ orderId }: { orderId: string }) {
    const { orders, isScheduleLoaded } = useSchedule();
    const [selectedProjectionWeek, setSelectedProjectionWeek] = useState<number>(getWeek(new Date()));

    const order = useMemo(() => {
        if (!isScheduleLoaded) return null;
        return orders.find(o => o.id === orderId);
    }, [orderId, orders, isScheduleLoaded]);

    const availableSnapshotWeeks = useMemo(() => {
        if (!order?.fcVsFcDetails) return [];
        return [...order.fcVsFcDetails]
            .map(s => s.snapshotWeek)
            .sort((a, b) => a - b);
    }, [order]);
    
    useEffect(() => {
        if(availableSnapshotWeeks.length > 0) {
            const currentWeek = getWeek(new Date());
            if (availableSnapshotWeeks.includes(currentWeek)) {
                setSelectedProjectionWeek(currentWeek);
            } else {
                // select latest available snapshot if current is not available
                setSelectedProjectionWeek(availableSnapshotWeeks[availableSnapshotWeeks.length - 1]);
            }
        }
    }, [availableSnapshotWeeks]);


    const projectionNumber = useMemo(() => {
        if (!order) return '';
        const existingProjections = order.projectionDetails?.length || 0;
        return `PRJ-${order.ocn}-${(existingProjections + 1).toString().padStart(2, '0')}`;
    }, [order]);

    const { maxLeadTime, ckWeek, coverageStartWeek, coverageEndWeek } = useMemo(() => {
        if (!order || !order.bom) return { maxLeadTime: 0, ckWeek: 0, coverageStartWeek: 0, coverageEndWeek: 0 };
        
        const projectionComponents = order.bom.filter(item => item.forecastType === 'Projection');
        const maxLeadTimeDays = Math.max(...projectionComponents.map(item => item.leadTime), 0);
        const maxLeadTimeWeeks = Math.ceil(maxLeadTimeDays / 7);

        const calculatedCkWeek = selectedProjectionWeek + maxLeadTimeWeeks;
        const startWeek = calculatedCkWeek + 1;
        const endWeek = calculatedCkWeek + 4;

        return { maxLeadTime: maxLeadTimeWeeks, ckWeek: calculatedCkWeek, coverageStartWeek: startWeek, coverageEndWeek: endWeek };
    }, [order, selectedProjectionWeek]);

    const projectionQty = useMemo(() => {
        if (!order || !order.fcVsFcDetails || coverageStartWeek === 0) return 0;
        
        const snapshotForProjectionWeek = order.fcVsFcDetails.find(s => s.snapshotWeek === selectedProjectionWeek);
        if (!snapshotForProjectionWeek) return 0;

        const weeklyTotals: Record<string, number> = {};
        Object.entries(snapshotForProjectionWeek.forecasts).forEach(([week, data]) => {
            weeklyTotals[week] = (data.total?.po || 0) + (data.total?.fc || 0);
        });

        const { plan } = runTentativePlanForHorizon(selectedProjectionWeek, null, weeklyTotals, order, 0);

        let totalQty = 0;
        for (let w = coverageStartWeek; w <= coverageEndWeek; w++) {
            totalQty += plan[`W${w}`] || 0;
        }

        return Math.round(totalQty);
    }, [order, selectedProjectionWeek, coverageStartWeek, coverageEndWeek]);


    if (!order) {
        return (
            <div className="flex-1 rounded-lg border border-dashed shadow-sm flex items-center justify-center">
                <p className="text-muted-foreground">Order data could not be loaded.</p>
            </div>
        );
    }

    return (
        <Card>
            <CardContent className="p-6 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
                    <div className="space-y-2">
                        <Label>PRJ #</Label>
                        <p className="font-semibold text-lg">{projectionNumber}</p>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="projection-week">Projection Week</Label>
                        <Select
                            value={String(selectedProjectionWeek)}
                            onValueChange={(value) => setSelectedProjectionWeek(Number(value))}
                        >
                            <SelectTrigger id="projection-week" className="w-[180px]">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {availableSnapshotWeeks.map(week => (
                                    <SelectItem key={week} value={String(week)}>
                                        W{week}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-2">
                        <Label>Max Lead Time (Projection)</Label>
                        <p className="font-semibold text-lg">{maxLeadTime} weeks</p>
                    </div>
                    <div className="space-y-2">
                        <Label>CK Week</Label>
                        <p className="font-semibold text-lg">W{ckWeek}</p>
                    </div>
                     <div className="space-y-2">
                        <Label>Projection Coverage Weeks</Label>
                        <p className="font-semibold text-lg">W{coverageStartWeek}-W{coverageEndWeek}</p>
                    </div>
                </div>

                 <div className="border-t pt-6">
                    <Label className="text-base">Calculated Projection Quantity</Label>
                    {projectionQty > 0 ? (
                        <p className="font-semibold text-3xl text-primary mt-1">
                            {projectionQty.toLocaleString()}
                        </p>
                    ) : (
                        <p className="text-muted-foreground mt-2">
                            No projection is needed for this period based on the current production plan.
                        </p>
                    )}
                </div>
            </CardContent>
            <CardFooter className="flex justify-end">
                <Button disabled={projectionQty <= 0}>Save Projection</Button>
            </CardFooter>
        </Card>
    );
}


function NewProjectionPageContent() {
    const searchParams = useSearchParams();
    const orderId = searchParams.get('orderId');

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
                                <Link href={`/material-planning?orderId=${orderId}`}>Material Planning</Link>
                            </BreadcrumbLink>
                        </BreadcrumbItem>
                        <BreadcrumbSeparator />
                        <BreadcrumbItem>
                            <BreadcrumbPage>New Projection</BreadcrumbPage>
                        </BreadcrumbItem>
                    </BreadcrumbList>
                </Breadcrumb>

                 <div className="flex justify-between items-center mb-4 flex-shrink-0">
                    <div>
                        <h1 className="text-2xl font-bold">Create New Projection</h1>
                        {orderId && (
                            <p className="text-muted-foreground">
                                For Order ID: {orderId}
                            </p>
                        )}
                    </div>
                     <Button variant="outline" asChild>
                        <Link href={`/material-planning?orderId=${orderId}`}>
                            <ArrowLeft className="mr-2 h-4 w-4" />
                            Back to Material Planning
                        </Link>
                    </Button>
                </div>
                
                {orderId ? (
                    <NewProjectionForm orderId={orderId} />
                ) : (
                     <div className="flex-1 rounded-lg border border-dashed shadow-sm flex items-center justify-center">
                        <p className="text-muted-foreground">No Order ID specified.</p>
                    </div>
                )}
            </main>
        </div>
    );
}

export default function NewProjectionPage() {
    return (
        <Suspense fallback={<div className="flex h-screen w-full items-center justify-center">Loading...</div>}>
            <NewProjectionPageContent />
        </Suspense>
    );
}
