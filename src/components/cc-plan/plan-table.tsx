
'use client';

import { useMemo } from 'react';
import type { CcWisePlanResult } from '@/lib/tna-calculator';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';


type CcPlanTableProps = {
    planResult: CcWisePlanResult;
};


export default function CcPlanTable({ planResult }: CcPlanTableProps) {
    const { 
        allWeeks: weekHeaders,
        weeklyDemand: poFcData,
        producedData,
        planData,
        fgciData,
    } = planResult;

    const { poFcTotal, producedQtyTotal, planQtyTotal, fgOiMin } = useMemo(() => {
        const poFcTotal = Object.values(poFcData).reduce((sum, val) => sum + val, 0);
        const producedQtyTotal = Object.values(producedData).reduce((sum, val) => sum + val, 0);
        const planQtyTotal = Object.values(planData).reduce((sum, val) => sum + val, 0);
        const fgOiValues = Object.values(fgciData);
        const fgOiMin = fgOiValues.length > 0 ? Math.min(...fgOiValues) : 0;
        
        return { poFcTotal, producedQtyTotal, planQtyTotal, fgOiMin };
    }, [poFcData, producedData, planData, fgciData]);


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
                                    <TableCell key={week} className="text-center text-green-600 font-semibold">
                                        {(producedData[week] || 0) > 0 ? (producedData[week] || 0).toLocaleString() : '-'}
                                    </TableCell>
                                ))}
                                <TableCell className="sticky right-0 z-10 bg-muted text-center font-bold text-green-600">
                                    {(producedQtyTotal || 0).toLocaleString()}
                                </TableCell>
                            </TableRow>
                            <TableRow>
                                <TableCell className="sticky left-0 z-10 bg-background font-medium">Plan Qty</TableCell>
                            {weekHeaders.map(week => (
                                    <TableCell key={week} className="text-center">
                                        {(planData[week] || 0) > 0 ? (planData[week] || 0).toLocaleString() : '-'}
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
                                        className={cn("text-center font-semibold", (fgciData[week] || 0) < 0 && 'text-destructive')}
                                    >
                                        {fgciData[week] !== undefined ? Math.round(fgciData[week]).toLocaleString() : '-'}
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
