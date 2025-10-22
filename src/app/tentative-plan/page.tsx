
'use client';

import { Suspense, useMemo, useState, useEffect } from 'react';
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { getWeek } from 'date-fns';
import type { FcComposition, Size } from '@/lib/types';


const TentativePlanTable = ({ order }: { order: any }) => {
    const [selectedSnapshotWeek, setSelectedSnapshotWeek] = useState<number | null>(null);

    const snapshotOptions = useMemo(() => {
        if (!order?.fcVsFcDetails) return [];
        return [...order.fcVsFcDetails]
            .map(s => s.snapshotWeek)
            .sort((a, b) => b - a);
    }, [order]);
    
    useEffect(() => {
        // Set default snapshot week when options are available
        if (snapshotOptions.length > 0 && selectedSnapshotWeek === null) {
            setSelectedSnapshotWeek(snapshotOptions[0]);
        }
    }, [snapshotOptions, selectedSnapshotWeek]);

    const latestSnapshot = useMemo(() => {
        if (!order?.fcVsFcDetails || order.fcVsFcDetails.length === 0 || selectedSnapshotWeek === null) return null;

        return order.fcVsFcDetails.find((s: any) => s.snapshotWeek === selectedSnapshotWeek);
    }, [order, selectedSnapshotWeek]);

    const { weeks, weeklyData } = useMemo(() => {
        if (!latestSnapshot) return { weeks: [], weeklyData: {} };

        const allWeeks = Object.keys(latestSnapshot.forecasts).sort((a, b) => {
            const weekA = parseInt(a.replace('W', ''));
            const weekB = parseInt(b.replace('W', ''));
            return weekA - weekB;
        });
        
        const data: Record<string, { poFc: number }> = {};
        allWeeks.forEach(week => {
            const forecast = latestSnapshot.forecasts[week]?.total;
            if (forecast) {
                data[week] = {
                    poFc: (forecast.po || 0) + (forecast.fc || 0),
                };
            }
        });

        return { weeks: allWeeks, weeklyData: data };
    }, [latestSnapshot]);

    const pciData = useMemo(() => {
        let pci = 0;
        const data: Record<string, number> = {};
        weeks.forEach(week => {
            const poFc = weeklyData[week]?.poFc || 0;
            // PCI[w] = PCI[w-1] + Plan[w-1] + Produced[w-1] - PO+FC[w]
            // For now, Plan and Produced are 0, so PCI[w] = PCI[w-1] - PO+FC[w].
            pci = pci - poFc;
            data[week] = pci;
        });
        return data;
    }, [weeks, weeklyData]);

    if (!latestSnapshot) {
        return <div className="p-4 text-muted-foreground">No forecast snapshot data available for the selected week.</div>;
    }

    return (
        <Card className="mt-6">
            <CardContent className="p-0">
                 <div className="p-4 border-b">
                    <div className="max-w-xs space-y-2">
                        <Label htmlFor="snapshot-select">Select Snapshot Week</Label>
                        <Select value={String(selectedSnapshotWeek)} onValueChange={(val) => setSelectedSnapshotWeek(Number(val))}>
                            <SelectTrigger id="snapshot-select">
                                <SelectValue placeholder="Select a snapshot..." />
                            </SelectTrigger>
                            <SelectContent>
                                {snapshotOptions.map(week => (
                                    <SelectItem key={week} value={String(week)}>
                                        Snapshot Week {week}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </div>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="w-[200px] font-bold">Dimension</TableHead>
                            {weeks.map(week => (
                                <TableHead key={week} className="text-right">{week}</TableHead>
                            ))}
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        <TableRow>
                            <TableCell className="font-medium">PO + FC</TableCell>
                            {weeks.map(week => (
                                <TableCell key={week} className="text-right">
                                    {(weeklyData[week]?.poFc || 0).toLocaleString()}
                                </TableCell>
                            ))}
                        </TableRow>
                        <TableRow>
                            <TableCell className="font-medium">Produced</TableCell>
                            {weeks.map(week => (
                                <TableCell key={week} className="text-right text-muted-foreground">-</TableCell>
                            ))}
                        </TableRow>
                        <TableRow>
                            <TableCell className="font-medium">Plan</TableCell>
                            {weeks.map(week => (
                                <TableCell key={week} className="text-right text-muted-foreground">-</TableCell>
                            ))}
                        </TableRow>
                         <TableRow>
                            <TableCell className="font-medium">FG CI</TableCell>
                            {weeks.map(week => (
                                <TableCell key={week} className="text-right">
                                    {pciData[week]?.toLocaleString() || '0'}
                                </TableCell>
                            ))}
                        </TableRow>
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    );
};


function TentativePlanPageContent() {
    const { appMode, orders, isScheduleLoaded } = useSchedule();
    const [selectedOrderId, setSelectedOrderId] = useState<string>('');

    const gutOrders = useMemo(() => {
        if (!isScheduleLoaded) return [];
        return orders.filter(o => o.orderType === 'Forecasted');
    }, [orders, isScheduleLoaded]);

    const selectedOrder = useMemo(() => {
        if (!selectedOrderId) return null;
        return gutOrders.find(o => o.id === selectedOrderId);
    }, [selectedOrderId, gutOrders]);

    if (appMode === 'gup') {
        return (
            <div className="flex h-screen flex-col">
              <Header />
              <main className="flex-1 p-4 sm:p-6 lg:p-8 flex items-center justify-center">
                <div className="text-center">
                  <h2 className="text-xl font-semibold">Tentative Plan Not Available</h2>
                  <p className="mt-2 text-muted-foreground">
                    This view is only applicable for GUP mode.
                  </p>
                  <Button asChild className="mt-6">
                    <Link href="/orders">View GUP Orders</Link>
                  </Button>
                </div>
              </main>
            </div>
        )
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
                            <BreadcrumbPage>Tentative Plan</BreadcrumbPage>
                        </BreadcrumbItem>
                    </BreadcrumbList>
                </Breadcrumb>

                 <div className="flex justify-between items-center mb-4 flex-shrink-0">
                    <div>
                        <h1 className="text-2xl font-bold">Tentative Plan</h1>
                        <p className="text-muted-foreground">
                            A high-level overview of the tentative production plan.
                        </p>
                    </div>
                </div>
                
                <div className="space-y-4">
                    <div className="max-w-xs space-y-2">
                        <Label htmlFor="order-select">Select Order ID</Label>
                        <Select value={selectedOrderId} onValueChange={setSelectedOrderId}>
                            <SelectTrigger id="order-select">
                                <SelectValue placeholder="Select an order..." />
                            </SelectTrigger>
                            <SelectContent>
                                {gutOrders.map(order => (
                                    <SelectItem key={order.id} value={order.id}>
                                        {order.id} ({order.style})
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    
                    {selectedOrder && <TentativePlanTable order={selectedOrder} />}
                </div>
            </main>
        </div>
    );
}

export default function TentativePlanPage() {
    return (
        <Suspense fallback={<div>Loading...</div>}>
            <TentativePlanPageContent />
        </Suspense>
    );
}
