
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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { Order, FcSnapshot } from '@/lib/types';
import { runTentativePlanForHorizon } from '@/lib/tna-calculator';


type PlanLogRow = {
    snapshotWeek: number;
    weeks: string[];
    poFcData: Record<string, number>;
    planData: Record<string, number>;
    totalPoFc: number;
    totalPlan: number;
};

const PlanLogTable = ({ log }: { log: PlanLogRow }) => {
    return (
        <Card>
            <CardHeader>
                <CardTitle>Snapshot Week: {log.snapshotWeek}</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="w-[150px] font-bold">Dimension</TableHead>
                            {log.weeks.map(week => (
                                <TableHead key={week} className="text-right">{week}</TableHead>
                            ))}
                            <TableHead className="text-right font-bold">Total</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        <TableRow>
                            <TableCell className="font-medium">PO + FC</TableCell>
                            {log.weeks.map(week => (
                                <TableCell key={week} className="text-right">
                                    {(log.poFcData[week] || 0).toLocaleString()}
                                </TableCell>
                            ))}
                            <TableCell className="text-right font-bold">
                                {log.totalPoFc.toLocaleString()}
                            </TableCell>
                        </TableRow>
                        <TableRow>
                            <TableCell className="font-medium">Plan</TableCell>
                            {log.weeks.map(week => (
                                <TableCell key={week} className="text-right font-semibold">
                                    {(log.planData[week] || 0) > 0 ? (log.planData[week] || 0).toLocaleString() : '-'}
                                </TableCell>
                            ))}
                            <TableCell className="text-right font-bold">
                                {log.totalPlan > 0 ? log.totalPlan.toLocaleString() : '-'}
                            </TableCell>
                        </TableRow>
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    );
};


function PlanLogPageContent() {
    const { orders, isScheduleLoaded } = useSchedule();
    const [selectedOrderId, setSelectedOrderId] = useState<string>('');
    const [planLogs, setPlanLogs] = useState<PlanLogRow[]>([]);

    const gutOrders = useMemo(() => {
        if (!isScheduleLoaded) return [];
        return orders.filter(o => o.orderType === 'Forecasted');
    }, [orders, isScheduleLoaded]);

    useEffect(() => {
        if (!selectedOrderId) {
            setPlanLogs([]);
            return;
        }

        const order = gutOrders.find(o => o.id === selectedOrderId);
        if (!order || !order.fcVsFcDetails) {
            setPlanLogs([]);
            return;
        }

        const newPlanLogs: PlanLogRow[] = [];

        // Iterate through each snapshot for the selected order
        order.fcVsFcDetails.forEach(snapshot => {
            const weeklyTotals: Record<string, number> = {};
            const allWeeks = Object.keys(snapshot.forecasts).sort((a, b) => parseInt(a.slice(1)) - parseInt(b.slice(1)));
            
            allWeeks.forEach(week => {
                const total = snapshot.forecasts[week]?.total;
                weeklyTotals[week] = (total?.po || 0) + (total?.fc || 0);
            });
            
            // Run the same planning logic from the tentative plan page
            const { plan } = runTentativePlanForHorizon(snapshot.snapshotWeek, null, weeklyTotals, order, 0);

            const firstRelevantWeekIndex = allWeeks.findIndex(w => (weeklyTotals[w] || 0) > 0 || (plan[w] || 0) > 0);
            const relevantWeeks = firstRelevantWeekIndex !== -1 ? allWeeks.slice(firstRelevantWeekIndex) : [];

            const totalPoFc = relevantWeeks.reduce((sum, week) => sum + (weeklyTotals[week] || 0), 0);
            const totalPlan = relevantWeeks.reduce((sum, week) => sum + (plan[week] || 0), 0);
            
            newPlanLogs.push({
                snapshotWeek: snapshot.snapshotWeek,
                weeks: relevantWeeks,
                poFcData: weeklyTotals,
                planData: plan,
                totalPoFc: totalPoFc,
                totalPlan: totalPlan
            });
        });
        
        setPlanLogs(newPlanLogs.sort((a,b) => b.snapshotWeek - a.snapshotWeek));

    }, [selectedOrderId, gutOrders]);


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

                    <div className="space-y-6">
                        {planLogs.length > 0 ? (
                            planLogs.map(log => <PlanLogTable key={log.snapshotWeek} log={log} />)
                        ) : (
                            <div className="border rounded-lg p-10 text-center text-muted-foreground">
                                {selectedOrderId ? 'No plan logs found for this order.' : 'Please select an order to view its plan log.'}
                            </div>
                        )}
                    </div>
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
