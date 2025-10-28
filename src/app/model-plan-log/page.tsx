
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';


function ModelPlanLogPageContent() {
    const { appMode, orders, isScheduleLoaded } = useSchedule();
    const [selectedOrderId, setSelectedOrderId] = useState<string>('');
    const [snapshotWeeks, setSnapshotWeeks] = useState<number[]>([]);
    const [allWeeks, setAllWeeks] = useState<string[]>([]);

    const gutOrders = useMemo(() => {
        if (!isScheduleLoaded) return [];
        return orders.filter(o => o.orderType === 'Forecasted');
    }, [orders, isScheduleLoaded]);
    
    useEffect(() => {
        const order = gutOrders.find(o => o.id === selectedOrderId);
        if (order && order.fcVsFcDetails) {
            const snapshotWeeksSet = new Set<number>();
            const weekSet = new Set<string>();
            
            order.fcVsFcDetails.forEach(snapshot => {
                snapshotWeeksSet.add(snapshot.snapshotWeek);
                Object.keys(snapshot.forecasts).forEach(week => weekSet.add(week));
            });
            
            setSnapshotWeeks(Array.from(snapshotWeeksSet).sort((a,b) => a - b));
            setAllWeeks(Array.from(weekSet).sort((a,b) => parseInt(a.slice(1)) - parseInt(b.slice(1))));

        } else {
            setSnapshotWeeks([]);
            setAllWeeks([]);
        }
    }, [selectedOrderId, gutOrders]);

    if (appMode === 'gup') {
        return (
            <div className="flex h-screen flex-col">
              <Header />
              <main className="flex-1 p-4 sm:p-6 lg:p-8 flex items-center justify-center">
                <div className="text-center">
                  <h2 className="text-xl font-semibold">Model Plan Log Not Available</h2>
                  <p className="mt-2 text-muted-foreground">
                    This view is only applicable for GUT mode.
                  </p>
                  <Button asChild className="mt-6">
                    <Link href="/">View GUP Orders</Link>
                  </Button>
                </div>
              </main>
            </div>
        )
    }

    return (
        <div className="flex h-screen flex-col">
            <Header />
            <main className="flex-1 p-4 sm:p-6 lg:p-8">
                <Breadcrumb className="mb-4">
                    <BreadcrumbList>
                        <BreadcrumbItem>
                            <BreadcrumbLink asChild>
                                <Link href="/">Home</Link>
                            </BreadcrumbLink>
                        </BreadcrumbItem>
                        <BreadcrumbSeparator />
                        <BreadcrumbItem>
                            <BreadcrumbPage>Model Plan Log</BreadcrumbPage>
                        </BreadcrumbItem>
                    </BreadcrumbList>
                </Breadcrumb>
                <div className="space-y-4">
                    <h1 className="text-2xl font-bold">Model Plan Log</h1>
                    <p className="text-muted-foreground">
                        A historical log of all planning activities for a model.
                    </p>

                    <div className="w-full max-w-xs space-y-2">
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

                    <Card>
                        <CardContent className="p-0">
                            {selectedOrderId && allWeeks.length > 0 && snapshotWeeks.length > 0 ? (
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead className="font-bold min-w-[150px]">Snapshot Week</TableHead>
                                            {allWeeks.map(week => (
                                                <TableHead key={week} className="text-right">{week}</TableHead>
                                            ))}
                                            <TableHead className="text-right font-bold">Total</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {snapshotWeeks.map(week => (
                                            <TableRow key={week}>
                                                <TableCell className="font-medium">W{week}</TableCell>
                                                {allWeeks.map(w => (
                                                    <TableCell key={`${week}-${w}`} className="text-right">-</TableCell>
                                                ))}
                                                <TableCell className="text-right font-bold">-</TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            ) : (
                                <div className="border rounded-lg p-10 text-center text-muted-foreground">
                                    <p>
                                        {selectedOrderId 
                                            ? "No forecast data available for this order."
                                            : "Please select an order to view its plan log."
                                        }
                                    </p>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </main>
        </div>
    );
}


export default function ModelPlanLogPage() {
    return (
        <Suspense fallback={<div>Loading...</div>}>
            <ModelPlanLogPageContent />
        </Suspense>
    );
}
