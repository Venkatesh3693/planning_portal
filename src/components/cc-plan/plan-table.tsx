
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
        
        // FG OI[w] = FG OI[w-1] - PO+FC[w] + Produced[w-1] + Plan[w-1]
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
    const { weekHeaders, poFcData, producedQtyData, planQtyData, fgOiData } = useMemo(() => {
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
            return { weekHeaders: [], poFcData: {}, producedQtyData: {}, planQtyData: {}, fgOiData: {} };
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

        return { weekHeaders, poFcData, producedQtyData, planQtyData, fgOiData };

    }, [ordersForCc, selectedSnapshotWeek]);


    if (weekHeaders.length === 0) {
        return (
            <div className="h-full flex items-center justify-center text-center text-muted-foreground border rounded-lg">
                <p>No forecast data available for this CC and Snapshot Week combination.</p>
            </div>
        );
    }
    
    return (
        <Card className="h-full flex flex-col">
            <CardContent className="p-0 flex-1 overflow-auto">
                <Table className="whitespace-nowrap">
                    <TableHeader className="sticky top-0 bg-muted/50 z-10">
                        <TableRow>
                            <TableHead className="sticky left-0 bg-muted/50 z-20 w-[150px]">Metric</TableHead>
                            {weekHeaders.map(week => (
                                <TableHead key={week} className="text-center">{week}</TableHead>
                            ))}
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        <TableRow>
                            <TableCell className="sticky left-0 bg-background z-10 font-medium">PO + FC</TableCell>
                            {weekHeaders.map(week => (
                                <TableCell key={week} className="text-center">
                                    {(poFcData[week] || 0) > 0 ? (poFcData[week] || 0).toLocaleString() : '-'}
                                </TableCell>
                            ))}
                        </TableRow>
                        <TableRow>
                            <TableCell className="sticky left-0 bg-background z-10 font-medium">Produced Qty</TableCell>
                            {weekHeaders.map(week => (
                                <TableCell key={week} className="text-center">
                                    {(producedQtyData[week] || 0) > 0 ? (producedQtyData[week] || 0).toLocaleString() : '-'}
                                </TableCell>
                            ))}
                        </TableRow>
                        <TableRow>
                            <TableCell className="sticky left-0 bg-background z-10 font-medium">Plan Qty</TableCell>
                           {weekHeaders.map(week => (
                                <TableCell key={week} className="text-center">
                                    {(planQtyData[week] || 0) > 0 ? (planQtyData[week] || 0).toLocaleString() : '-'}
                                </TableCell>
                            ))}
                        </TableRow>
                         <TableRow>
                            <TableCell className="sticky left-0 bg-background z-10 font-medium">FG OI</TableCell>
                            {weekHeaders.map(week => (
                                <TableCell 
                                    key={week} 
                                    className={cn("text-center font-semibold", (fgOiData[week] || 0) < 0 && 'text-destructive')}
                                >
                                    {fgOiData[week] !== undefined ? Math.round(fgOiData[week]).toLocaleString() : '-'}
                                </TableCell>
                            ))}
                        </TableRow>
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    )
}
