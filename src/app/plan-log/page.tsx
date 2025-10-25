
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { Order } from '@/lib/types';
import { runTentativePlanForHorizon } from '@/lib/tna-calculator';
import { Button } from '@/components/ui/button';


type PlanLogRow = {
    snapshotWeek: number;
    planData: Record<string, number>;
};

function PlanLogPageContent() {
    const { orders, isScheduleLoaded, appMode } = useSchedule();
    const [selectedOrderId, setSelectedOrderId] = useState<string>('');
    const [planLogs, setPlanLogs] = useState<PlanLogRow[]>([]);
    const [allWeeks, setAllWeeks] = useState<string[]>([]);

    const gutOrders = useMemo(() => {
        if (!isScheduleLoaded) return [];
        return orders.filter(o => o.orderType === 'Forecasted');
    }, [orders, isScheduleLoaded]);

    useEffect(() => {
        if (!selectedOrderId) {
            setPlanLogs([]);
            setAllWeeks([]);
            return;
        }

        const order = gutOrders.find(o => o.id === selectedOrderId);
        if (!order || !order.fcVsFcDetails) {
            setPlanLogs([]);
            setAllWeeks([]);
            return;
        }

        const newPlanLogs: PlanLogRow[] = [];
        const weekSet = new Set<string>();

        order.fcVsFcDetails.forEach(snapshot => {
            const weeklyTotals: Record<string, number> = {};
            const snapshotWeeks = Object.keys(snapshot.forecasts).sort((a, b) => parseInt(a.slice(1)) - parseInt(b.slice(1)));
            
            snapshotWeeks.forEach(week => {
                const total = snapshot.forecasts[week]?.total;
                weeklyTotals[week] = (total?.po || 0) + (total?.fc || 0);
            });
            
            const { plan } = runTentativePlanForHorizon(snapshot.snapshotWeek, null, weeklyTotals, order, 0);

            newPlanLogs.push({
                snapshotWeek: snapshot.snapshotWeek,
                planData: plan,
            });

            Object.keys(plan).forEach(week => {
                if(plan[week] > 0) weekSet.add(week);
            });
        });
        
        const sortedWeeks = Array.from(weekSet).sort((a, b) => parseInt(a.slice(1)) - parseInt(b.slice(1)));

        setAllWeeks(sortedWeeks);
        setPlanLogs(newPlanLogs.sort((a,b) => b.snapshotWeek - a.snapshotWeek));

    }, [selectedOrderId, gutOrders]);

    if (appMode === 'gup') {
        return (
            <div className="flex h-screen flex-col">
              <Header />
              <main className="flex-1 p-4 sm:p-6 lg:p-8 flex items-center justify-center">
                <div className="text-center">
                  <h2 className="text-xl font-semibold">Plan Log Not Available</h2>
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
                            <BreadcrumbPage>Plan Log</BreadcrumbPage>
                        </BreadcrumbItem>
                    </BreadcrumbList>
                </Breadcrumb>
                <div className="space-y-4">
                    <div className="flex justify-between items-center">
                        <div>
                            <h1 className="text-2xl font-bold">Plan Log</h1>
                            <p className="text-muted-foreground">
                                A historical log of all tentative planning activities for an order.
                            </p>
                        </div>
                    </div>
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
                            {planLogs.length > 0 && allWeeks.length > 0 ? (
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
                                        {planLogs.map(log => {
                                            const totalPlan = Object.values(log.planData).reduce((sum, val) => sum + val, 0);
                                            return (
                                                <TableRow key={log.snapshotWeek}>
                                                    <TableCell className="font-medium">W{log.snapshotWeek}</TableCell>
                                                    {allWeeks.map(week => (
                                                        <TableCell key={`${log.snapshotWeek}-${week}`} className="text-right font-semibold">
                                                            {(log.planData[week] || 0) > 0 ? (log.planData[week] || 0).toLocaleString() : '-'}
                                                        </TableCell>
                                                    ))}
                                                    <TableCell className="text-right font-bold">
                                                        {totalPlan > 0 ? totalPlan.toLocaleString() : '-'}
                                                    </TableCell>
                                                </TableRow>
                                            )
                                        })}
                                    </TableBody>
                                </Table>
                            ) : (
                                <div className="border rounded-lg p-10 text-center text-muted-foreground">
                                    {selectedOrderId ? 'No plan logs found for this order.' : 'Please select an order to view its plan log.'}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </main>
        </div>
    );
}


export default function PlanLogPage() {
    return (
        <Suspense fallback={<div>Loading...</div>}>
            <PlanLogPageContent />
        </Suspense>
    );
}
