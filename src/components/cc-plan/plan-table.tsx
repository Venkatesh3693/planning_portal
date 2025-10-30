
'use client';

import { useMemo } from 'react';
import type { Order, FcSnapshot, Size } from '@/lib/types';
import { SIZES } from '@/lib/data';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

type CcPlanTableProps = {
    ordersForCc: Order[];
    selectedSnapshotWeek: number;
};

// Centralized function for inventory calculation as requested
const calculateFgOi = (
    weeks: string[],
    poFcData: Record<string, number>,
    producedData: Record<string, number>,
    planData: Record<string, number>
): Record<string, number> => {
    const fgOiData: Record<string, number> = {};
    let lastWeekOi = 0;

    for (const week of weeks) {
        const weekNum = parseInt(week.replace('W', ''), 10);
        const prevWeekKey = `W${weekNum - 1}`;
        
        // FG OI[w] = FG OI[w-1] - PO + FC [w] + Produced[w-1] + Plan[w-1]
        const inventory = lastWeekOi
            - (poFcData[week] || 0)
            + (producedData[prevWeekKey] || 0)
            + (planData[prevWeekKey] || 0);

        fgOiData[week] = inventory;
        lastWeekOi = inventory;
    }
    return fgOiData;
}


export default function CcPlanTable({ ordersForCc, selectedSnapshotWeek }: CcPlanTableProps) {
    const { 
        weekHeaders, 
        poFcData, 
        producedQtyData, 
        planQtyData, 
        fgOiData, 
        poFcTotal,
        producedQtyTotal,
        planQtyTotal,
        fgOiMin,
    } = useMemo(() => {
        const poFcData: Record<string, number> = {};
        const producedQtyData: Record<string, number> = {}; // Placeholder
        const planQtyData: Record<string, number> = {}; // Placeholder

        const allWeeks = new Set<number>();

        ordersForCc.forEach(order => {
            const snapshot = order.fcVsFcDetails?.find(s => s.snapshotWeek === selectedSnapshotWeek);
            if (!snapshot) return;

            Object.keys(snapshot.forecasts).forEach(weekStr => {
                allWeeks.add(parseInt(weekStr.replace('W', '')));
                const weeklyTotal = (snapshot.forecasts[weekStr]?.total?.po || 0) + (snapshot.forecasts[weekStr]?.total?.fc || 0);
                poFcData[weekStr] = (poFcData[weekStr] || 0) + weeklyTotal;
            });
        });

        const sortedWeeks = Array.from(allWeeks).sort((a, b) => a - b);
        if (sortedWeeks.length === 0) {
            return { weekHeaders: [], poFcData: {}, producedQtyData: {}, planQtyData: {}, fgOiData: {}, poFcTotal: 0, producedQtyTotal: 0, planQtyTotal: 0, fgOiMin: 0 };
        }
        
        // Create a contiguous list of week headers
        const firstWeek = sortedWeeks[0];
        const lastWeek = sortedWeeks[sortedWeeks.length - 1];
        const weekHeaders: string[] = [];
        for (let i = firstWeek; i <= lastWeek; i++) {
            weekHeaders.push(`W${i}`);
        }

        // Initialize placeholder data
        weekHeaders.forEach(week => {
            producedQtyData[week] = 0;
            planQtyData[week] = 0;
        });

        // Calculate FG OI
        const fgOiData = calculateFgOi(weekHeaders, poFcData, producedQtyData, planQtyData);
        
        // Calculate totals and minimums
        const poFcTotal = Object.values(poFcData).reduce((sum, val) => sum + val, 0);
        const producedQtyTotal = Object.values(producedQtyData).reduce((sum, val) => sum + val, 0);
        const planQtyTotal = Object.values(planQtyData).reduce((sum, val) => sum + val, 0);
        const fgOiValues = Object.values(fgOiData);
        const fgOiMin = fgOiValues.length > 0 ? Math.min(...fgOiValues) : 0;


        return { weekHeaders, poFcData, producedQtyData, planQtyData, fgOiData, poFcTotal, producedQtyTotal, planQtyTotal, fgOiMin };

    }, [ordersForCc, selectedSnapshotWeek]);


    if (weekHeaders.length === 0) {
        return (
            <div className="flex h-48 items-center justify-center rounded-lg border text-center text-muted-foreground">
                <p>No forecast data available for this CC and Snapshot Week combination.</p>
            </div>
        );
    }
    
    return (
        <Card>
            <CardContent className="p-0">
                <div className="overflow-x-auto">
                    <Table className="whitespace-nowrap">
                        <TableHeader>
                            <TableRow>
                                <TableHead className="sticky left-0 z-10 w-[150px] bg-muted">Metric</TableHead>
                                {weekHeaders.map(week => (
                                    <TableHead key={week} className="text-center">{week}</TableHead>
                                ))}
                                <TableHead className="sticky right-0 z-10 bg-muted text-center font-bold">Total / Min</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            <TableRow>
                                <TableCell className="sticky left-0 z-10 bg-background font-medium">PO + FC</TableCell>
                                {weekHeaders.map(week => (
                                    <TableCell key={week} className="text-center">
                                        {(poFcData[week] || 0) > 0 ? (poFcData[week] || 0).toLocaleString() : '-'}
                                    </TableCell>
                                ))}
                                <TableCell className="sticky right-0 z-10 bg-background text-center font-bold">
                                    {(poFcTotal || 0).toLocaleString()}
                                </TableCell>
                            </TableRow>
                            <TableRow>
                                <TableCell className="sticky left-0 z-10 bg-muted font-medium">Produced Qty</TableCell>
                                {weekHeaders.map(week => (
                                    <TableCell key={week} className="text-center">
                                        {(producedQtyData[week] || 0) > 0 ? (producedQtyData[week] || 0).toLocaleString() : '-'}
                                    </TableCell>
                                ))}
                                <TableCell className="sticky right-0 z-10 bg-muted text-center font-bold">
                                    {(producedQtyTotal || 0).toLocaleString()}
                                </TableCell>
                            </TableRow>
                            <TableRow>
                                <TableCell className="sticky left-0 z-10 bg-background font-medium">Plan Qty</TableCell>
                            {weekHeaders.map(week => (
                                    <TableCell key={week} className="text-center">
                                        {(planQtyData[week] || 0) > 0 ? (planQtyData[week] || 0).toLocaleString() : '-'}
                                    </TableCell>
                                ))}
                                <TableCell className="sticky right-0 z-10 bg-background text-center font-bold">
                                    {(planQtyTotal || 0).toLocaleString()}
                                </TableCell>
                            </TableRow>
                            <TableRow>
                                <TableCell className="sticky left-0 z-10 bg-muted font-medium">FG OI</TableCell>
                                {weekHeaders.map(week => (
                                    <TableCell 
                                        key={week} 
                                        className={cn("text-center font-semibold", (fgOiData[week] || 0) < 0 && 'text-destructive')}
                                    >
                                        {fgOiData[week] !== undefined ? Math.round(fgOiData[week]).toLocaleString() : '-'}
                                    </TableCell>
                                ))}
                                <TableCell 
                                    className={cn(
                                        "sticky right-0 z-10 bg-muted text-center font-bold",
                                        (fgOiMin || 0) < 0 && 'text-destructive'
                                    )}
                                >
                                    {Math.round(fgOiMin).toLocaleString()}
                                </TableCell>
                            </TableRow>
                        </TableBody>
                    </Table>
                </div>
            </CardContent>
        </Card>
    )
}
