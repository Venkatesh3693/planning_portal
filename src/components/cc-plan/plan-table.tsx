
'use client';

import { useState, useMemo, useEffect } from 'react';
import type { CcWisePlanResult } from '@/lib/tna-calculator';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';


type CcPlanTableProps = {
    planResult: CcWisePlanResult;
};


export default function CcPlanTable({ planResult }: CcPlanTableProps) {
    const { 
        allWeeks: weekHeaders,
        weeklyDemand: poFcData,
        producedData,
        planData: initialPlanData,
        fgoiData: initialFgoiData,
        budgetedEfficiency,
        maxWeeklyOutput,
    } = planResult;

    const [efficiencies, setEfficiencies] = useState<Record<string, number>>({});
    const [planData, setPlanData] = useState<Record<string, number>>({});
    const [fgoiData, setFgoiData] = useState<Record<string, number>>({});

    useEffect(() => {
        const initialEfficiencies: Record<string, number> = {};
        if (budgetedEfficiency) {
            weekHeaders.forEach(week => {
                initialEfficiencies[week] = budgetedEfficiency;
            });
        }
        setEfficiencies(initialEfficiencies);
        setPlanData(initialPlanData);
        setFgoiData(initialFgoiData);
    }, [initialPlanData, initialFgoiData, weekHeaders, budgetedEfficiency]);

    const handleEfficiencyChange = (week: string, newEfficiency: number) => {
        const updatedEfficiencies = { ...efficiencies, [week]: newEfficiency };
        setEfficiencies(updatedEfficiencies);

        // Recalculate plan quantity for the changed week
        const newPlanQty = (maxWeeklyOutput * (newEfficiency / 100)) / (budgetedEfficiency ? (budgetedEfficiency / 100) : 1) * (initialPlanData[week] ? 1 : 0);

        const updatedPlanData = { ...planData, [week]: Math.round(newPlanQty) };
        setPlanData(updatedPlanData);
        
        // Recalculate FG OI from this week forward
        const newFgoiData = { ...fgoiData };
        let lastWeekInventory = weekHeaders.indexOf(week) > 0 
            ? newFgoiData[weekHeaders[weekHeaders.indexOf(week) - 1]] 
            : 0;
            
        for (let i = weekHeaders.indexOf(week); i < weekHeaders.length; i++) {
            const currentWeek = weekHeaders[i];
            const prevWeek = `W${parseInt(currentWeek.slice(1)) - 1}`;
            
            const producedLastWeek = producedData[prevWeek] || 0;
            const planLastWeek = updatedPlanData[prevWeek] || 0;
            const demandThisWeek = poFcData[currentWeek] || 0;
            
            const currentInventory = lastWeekInventory + producedLastWeek + planLastWeek - demandThisWeek;
            
            newFgoiData[currentWeek] = currentInventory;
            lastWeekInventory = currentInventory;
        }
        setFgoiData(newFgoiData);
    };

    const { poFcTotal, producedQtyTotal, planQtyTotal, fgOiMin } = useMemo(() => {
        const poFcTotal = Object.values(poFcData).reduce((sum, val) => sum + val, 0);
        const producedQtyTotal = Object.values(producedData).reduce((sum, val) => sum + val, 0);
        const planQtyTotal = Object.values(planData).reduce((sum, val) => sum + val, 0);
        const fgoiValues = Object.values(fgoiData);
        const fgOiMin = fgoiValues.length > 0 ? Math.min(...fgoiValues) : 0;
        
        return { poFcTotal, producedQtyTotal, planQtyTotal, fgOiMin };
    }, [poFcData, producedData, planData, fgoiData]);


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
                                <TableCell className="sticky left-0 z-10 bg-background font-medium">Daily Efficiency</TableCell>
                                {weekHeaders.map(week => (
                                    <TableCell key={week} className="text-center p-1">
                                        <Input 
                                            type="number"
                                            value={efficiencies[week] || ''}
                                            onChange={(e) => handleEfficiencyChange(week, Number(e.target.value))}
                                            className="w-20 mx-auto text-center h-8"
                                        />
                                    </TableCell>
                                ))}
                                <TableCell className="sticky right-0 z-10 bg-background text-center font-bold">
                                   -
                                </TableCell>
                            </TableRow>
                            <TableRow>
                                <TableCell className="sticky left-0 z-10 bg-muted font-medium">Plan Qty</TableCell>
                            {weekHeaders.map(week => (
                                    <TableCell key={week} className="text-center">
                                        {(planData[week] || 0) > 0 ? (planData[week] || 0).toLocaleString() : '-'}
                                    </TableCell>
                                ))}
                                <TableCell className="sticky right-0 z-10 bg-muted text-center font-bold">
                                    {(planQtyTotal || 0).toLocaleString()}
                                </TableCell>
                            </TableRow>
                            <TableRow>
                                <TableCell className="sticky left-0 z-10 bg-background font-medium">FG OI</TableCell>
                                {weekHeaders.map(week => (
                                    <TableCell 
                                        key={week} 
                                        className={cn("text-center font-semibold", (fgoiData[week] || 0) < 0 && 'text-destructive')}
                                    >
                                        {fgoiData[week] !== undefined ? Math.round(fgoiData[week]).toLocaleString() : '-'}
                                    </TableCell>
                                ))}
                                <TableCell 
                                    className={cn(
                                        "sticky right-0 z-10 bg-background text-center font-bold",
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
