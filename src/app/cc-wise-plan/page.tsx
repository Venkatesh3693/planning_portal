
'use client';

import { Suspense, useState, useMemo, useEffect } from 'react';
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { Card, CardContent } from '@/components/ui/card';
import type { Order } from '@/lib/types';


function CcWisePlanPageContent() {
    const { isScheduleLoaded, orders, appMode } = useSchedule();
    const [selectedCc, setSelectedCc] = useState<string>('');
    const [selectedSnapshotWeek, setSelectedSnapshotWeek] = useState<number | null>(null);
    const [weeklyDemand, setWeeklyDemand] = useState<Record<string, number>>({});
    const [allWeeks, setAllWeeks] = useState<string[]>([]);
    
    const ccOptions = useMemo(() => {
        if (!isScheduleLoaded) return [];
        const gutOrders = orders.filter(o => o.orderType === 'Forecasted');
        const uniqueCcs = [...new Set(gutOrders.map(o => o.ocn))];
        return uniqueCcs.sort();
    }, [orders, isScheduleLoaded]);

    const ordersForCc = useMemo(() => {
        if (!selectedCc) return [];
        return orders.filter(o => o.ocn === selectedCc && o.orderType === 'Forecasted');
    }, [selectedCc, orders]);

    const snapshotOptions = useMemo(() => {
        if (ordersForCc.length === 0) return [];
        const weekSet = new Set<number>();
        ordersForCc.forEach(order => {
            order.fcVsFcDetails?.forEach(snapshot => {
                weekSet.add(snapshot.snapshotWeek);
            });
        });
        return Array.from(weekSet).sort((a,b) => b - a);
    }, [ordersForCc]);

    const firstSnapshotWeek = useMemo(() => {
        if (snapshotOptions.length === 0) return null;
        return Math.min(...snapshotOptions);
    }, [snapshotOptions]);
    
    useEffect(() => {
        if (snapshotOptions.length > 0) {
            setSelectedSnapshotWeek(snapshotOptions[0]);
        } else {
            setSelectedSnapshotWeek(null);
        }
    }, [snapshotOptions]);

    useEffect(() => {
        if (ordersForCc.length > 0 && selectedSnapshotWeek !== null && firstSnapshotWeek !== null) {
            const aggregatedDemand: Record<string, number> = {};
            const weekSet = new Set<number>();

            ordersForCc.forEach(order => {
                const snapshot = order.fcVsFcDetails?.find(s => s.snapshotWeek === selectedSnapshotWeek);
                if (!snapshot) return;

                Object.entries(snapshot.forecasts).forEach(([week, data]) => {
                    const weekNum = parseInt(week.slice(1));
                    const weeklyTotal = (data.total?.po || 0) + (data.total?.fc || 0);
                    if (weeklyTotal > 0) {
                        aggregatedDemand[week] = (aggregatedDemand[week] || 0) + weeklyTotal;
                        weekSet.add(weekNum);
                    }
                });
            });
            
            const demandWeeks = Array.from(weekSet).sort((a, b) => a - b);
            if (demandWeeks.length > 0) {
                const lastDemandWeek = demandWeeks[demandWeeks.length - 1];
                const startDisplayWeek = firstSnapshotWeek;
                const fullWeekRange: string[] = [];
                for(let w = startDisplayWeek; w <= lastDemandWeek; w++) {
                    fullWeekRange.push(`W${w}`);
                }
                setAllWeeks(fullWeekRange);
            } else {
                setAllWeeks([]);
            }

            setWeeklyDemand(aggregatedDemand);
        } else {
            setWeeklyDemand({});
            setAllWeeks([]);
        }
    }, [ordersForCc, selectedSnapshotWeek, firstSnapshotWeek]);

    
    if (!isScheduleLoaded) {
        return <div className="flex items-center justify-center h-full">Loading data...</div>;
    }

    if (appMode === 'gup') {
        return (
            <div className="flex h-screen flex-col">
              <Header />
              <main className="flex-1 p-4 sm:p-6 lg:p-8 flex items-center justify-center">
                <div className="text-center">
                  <h2 className="text-xl font-semibold">CC-wise Plan Not Available</h2>
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

    const grandTotal = Object.values(weeklyDemand).reduce((sum, val) => sum + val, 0);

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
                            <BreadcrumbPage>CC-wise Plan</BreadcrumbPage>
                        </BreadcrumbItem>
                    </BreadcrumbList>
                </Breadcrumb>

                 <div className="flex justify-between items-start mb-4 flex-shrink-0">
                    <div>
                        <h1 className="text-2xl font-bold">CC-wise Plan</h1>
                        <p className="text-muted-foreground">
                            A plan based on style/color code combination.
                        </p>
                    </div>
                     <Button variant="outline" asChild>
                        <Link href="/orders">
                            <ArrowLeft className="mr-2 h-4 w-4" />
                            Back to Orders
                        </Link>
                    </Button>
                </div>
                
                <div className="space-y-4">
                    <div className="flex items-end gap-4">
                        <div className="w-full max-w-xs space-y-2">
                            <Label htmlFor="cc-select">Select CC</Label>
                            <Select value={selectedCc} onValueChange={setSelectedCc}>
                                <SelectTrigger id="cc-select">
                                    <SelectValue placeholder="Select a CC..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {ccOptions.map(cc => (
                                        <SelectItem key={cc} value={cc}>
                                            {cc}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        {selectedCc && snapshotOptions.length > 0 && (
                            <div className="space-y-2">
                                <Label htmlFor="snapshot-select">Snapshot Week</Label>
                                <Select value={selectedSnapshotWeek !== null ? String(selectedSnapshotWeek) : ''} onValueChange={(v) => setSelectedSnapshotWeek(Number(v))}>
                                    <SelectTrigger id="snapshot-select" className="w-[180px]">
                                        <SelectValue placeholder="Select week..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {snapshotOptions.map(week => (
                                            <SelectItem key={week} value={String(week)}>
                                                Week {week}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        )}
                    </div>
                    {selectedCc && selectedSnapshotWeek !== null && allWeeks.length > 0 && (
                        <Card>
                            <CardContent className="p-0">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead className="min-w-[200px]">Demand</TableHead>
                                            {allWeeks.map(week => (
                                                <TableHead key={week} className="text-right">{week}</TableHead>
                                            ))}
                                            <TableHead className="text-right font-bold">Total</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        <TableRow>
                                            <TableCell className="font-medium">PO + FC</TableCell>
                                            {allWeeks.map(week => (
                                                <TableCell key={week} className="text-right">
                                                    {(weeklyDemand[week] || 0) > 0 ? (weeklyDemand[week] || 0).toLocaleString() : '-'}
                                                </TableCell>
                                            ))}
                                            <TableCell className="text-right font-bold">{grandTotal.toLocaleString()}</TableCell>
                                        </TableRow>
                                    </TableBody>
                                </Table>
                            </CardContent>
                        </Card>
                    )}
                     {selectedCc && allWeeks.length === 0 && (
                        <div className="border rounded-lg p-10 text-center text-muted-foreground">
                           <p>No PO+FC demand data available for the selected CC and snapshot week.</p>
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
}

export default function CcWisePlanPage() {
    return (
        <Suspense fallback={<div>Loading...</div>}>
            <CcWisePlanPageContent />
        </Suspense>
    );
}
