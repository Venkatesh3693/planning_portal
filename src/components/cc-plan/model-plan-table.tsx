
'use client';

import { useMemo } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { calculateFgoiForSingleScenario } from '@/lib/tna-calculator';


type ModelPlanTableProps = {
    modelName: string;
    weeklyDemand: Record<string, number>;
    allWeeks: string[];
};


export default function ModelPlanTable({ modelName, weeklyDemand, allWeeks }: ModelPlanTableProps) {
    const poFcTotal = useMemo(() => {
        return Object.values(weeklyDemand).reduce((sum, val) => sum + val, 0);
    }, [weeklyDemand]);

    const producedQty = {}; // Blank for now
    const planQty = {}; // Blank for now
    
    const producedQtyTotal = 0;
    const planQtyTotal = 0;

    const fgoiData = useMemo(() => {
        return calculateFgoiForSingleScenario(allWeeks, weeklyDemand, planQty, producedQty, 0);
    }, [allWeeks, weeklyDemand, planQty, producedQty]);

    const fgOiMin = useMemo(() => {
        const fgoiValues = Object.values(fgoiData);
        return fgoiValues.length > 0 ? Math.min(...fgoiValues) : 0;
    }, [fgoiData]);


    if (allWeeks.length === 0) {
        return null;
    }
    
    return (
        <Card className="mb-4">
            <CardContent className="p-0">
                <div className="overflow-x-auto">
                    <Table className="whitespace-nowrap">
                        <TableHeader>
                            <TableRow>
                                <TableHead className="sticky left-0 z-10 w-[120px] bg-muted">Model</TableHead>
                                <TableHead className="sticky left-[120px] z-10 w-[150px] bg-muted">Metric</TableHead>
                                {allWeeks.map(week => (
                                    <TableHead key={week} className="text-center">{week}</TableHead>
                                ))}
                                <TableHead className="sticky right-0 z-10 bg-muted text-center font-bold">Total / Min</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            <TableRow>
                                <TableCell rowSpan={4} className="sticky left-0 z-10 bg-background align-top font-semibold pt-6">{modelName}</TableCell>
                                <TableCell className="sticky left-[120px] z-10 bg-background font-medium">PO + FC</TableCell>
                                {allWeeks.map(week => (
                                    <TableCell key={week} className="text-center">
                                        {(weeklyDemand[week] || 0) > 0 ? (weeklyDemand[week] || 0).toLocaleString() : '-'}
                                    </TableCell>
                                ))}
                                <TableCell className="sticky right-0 z-10 bg-background text-center font-bold">
                                    {(poFcTotal || 0).toLocaleString()}
                                </TableCell>
                            </TableRow>
                             <TableRow>
                                <TableCell className="sticky left-[120px] z-10 bg-muted font-medium">Produced Qty</TableCell>
                                {allWeeks.map(week => (
                                    <TableCell key={week} className="text-center text-green-600 font-semibold">
                                        {'-'}
                                    </TableCell>
                                ))}
                                <TableCell className="sticky right-0 z-10 bg-muted text-center font-bold text-green-600">
                                     {producedQtyTotal.toLocaleString()}
                                </TableCell>
                            </TableRow>
                             <TableRow>
                                <TableCell className="sticky left-[120px] z-10 bg-background font-medium">Plan Qty</TableCell>
                            {allWeeks.map(week => (
                                    <TableCell key={week} className="text-center">
                                         {'-'}
                                    </TableCell>
                                ))}
                                <TableCell className="sticky right-0 z-10 bg-background text-center font-bold">
                                     {planQtyTotal.toLocaleString()}
                                </TableCell>
                            </TableRow>
                            <TableRow>
                                <TableCell className="sticky left-[120px] z-10 bg-muted font-medium">FG OI</TableCell>
                                {allWeeks.map(week => (
                                    <TableCell 
                                        key={week} 
                                        className={cn("text-center font-semibold", (fgoiData[week] || 0) < 0 && 'text-destructive')}
                                    >
                                        {fgoiData[week] !== undefined ? Math.round(fgoiData[week]).toLocaleString() : '-'}
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
