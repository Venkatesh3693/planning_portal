
'use client';

import { Suspense, useMemo, useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
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
import { ArrowLeft, XCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { SEWING_OPERATIONS_BY_STYLE, WORK_DAY_MINUTES } from '@/lib/data';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import type { FcSnapshot } from '@/lib/types';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";


function ProductionPlanPageContent() {
    const searchParams = useSearchParams();
    const orderId = searchParams.get('orderId');
    const { 
        orders, 
        isScheduleLoaded, 
        sewingLines, 
        setSewingLines,
        productionPlans,
        updateProductionPlan,
        initialProductionStartWeeks,
        setInitialProductionStartWeek,
    } = useSchedule();
    const { toast } = useToast();

    
    const order = useMemo(() => {
        if (!isScheduleLoaded || !orderId) return null;
        return orders.find(o => o.id === orderId);
    }, [orderId, orders, isScheduleLoaded]);

    const [openingFgStock, setOpeningFgStock] = useState(0);
    const [displayOpeningFgStock, setDisplayOpeningFgStock] = useState(String(openingFgStock));
    const [planError, setPlanError] = useState<string | null>(null);
    const [selectedSnapshotWeek, setSelectedSnapshotWeek] = useState<string | undefined>(undefined);
    
    const initialProductionStartWeek = orderId ? initialProductionStartWeeks[orderId] : undefined;

    const productionPlan = useMemo(() => {
        if (!orderId) return {};
        return productionPlans[orderId] || {};
    }, [orderId, productionPlans]);


    const numLines = useMemo(() => {
        if (!orderId) return 1;
        return sewingLines[orderId] || 1;
    }, [orderId, sewingLines]);

    const [displayNumLines, setDisplayNumLines] = useState(String(numLines));

    useEffect(() => {
        setDisplayNumLines(String(numLines || 1));
    }, [numLines]);

    useEffect(() => {
        if (order && order.fcVsFcDetails && order.fcVsFcDetails.length > 0) {
            const latestWeek = Math.max(...order.fcVsFcDetails.map(s => s.snapshotWeek));
            setSelectedSnapshotWeek(String(latestWeek));
        }
    }, [order]);

    const { totalSam, totalTailors } = useMemo(() => {
        if (!order) return { totalSam: 0, totalTailors: 0 };
        const operations = SEWING_OPERATIONS_BY_STYLE[order.style] || [];
        if (operations.length === 0) return { totalSam: 0, totalTailors: 0 };
        
        const totalSam = operations.reduce((sum, op) => sum + op.sam, 0);
        const totalTailors = operations.reduce((sum, op) => sum + op.operators, 0);

        return { totalSam, totalTailors };
    }, [order]);

    const outputPerDay = useMemo(() => {
        if (!order || totalSam === 0 || totalTailors === 0 || !order.budgetedEfficiency || numLines <= 0) {
            return 0;
        }
        const efficiency = order.budgetedEfficiency / 100;
        return (((totalTailors * numLines) * WORK_DAY_MINUTES) / totalSam) * efficiency;
    }, [order, totalSam, totalTailors, numLines]);

    const weeklyOutput = outputPerDay * 6; // 6 working days

    // Effect to set the initial production start week if not already set
    useEffect(() => {
        if (orderId && !initialProductionStartWeek && order && order.fcVsFcDetails && weeklyOutput > 0) {
            const earliestSnapshot = order.fcVsFcDetails.sort((a,b) => a.snapshotWeek - b.snapshotWeek)[0];
            if (!earliestSnapshot) return;

            const snapshotForecastWeeks = Object.keys(earliestSnapshot.forecasts).sort((a, b) => parseInt(a.replace('W','')) - parseInt(b.replace('W','')));
            const demands = snapshotForecastWeeks.map(week => (earliestSnapshot.forecasts[week]?.total.po || 0) + (earliestSnapshot.forecasts[week]?.total.fc || 0));
            const firstDemandWeekIndex = demands.findIndex(d => d > 0);

            if (firstDemandWeekIndex !== -1) {
                const productionStartWeekNum = parseInt(snapshotForecastWeeks[firstDemandWeekIndex].replace('W',''));
                setInitialProductionStartWeek(orderId, productionStartWeekNum); // Store it
            }
        }
    }, [orderId, initialProductionStartWeek, order, weeklyOutput, setInitialProductionStartWeek]);

    // Effect to dynamically calculate opening stock when selected snapshot changes
    useEffect(() => {
        if (initialProductionStartWeek && selectedSnapshotWeek && weeklyOutput > 0) {
            const currentSnapshotWeekNum = parseInt(selectedSnapshotWeek);
            const weeksElapsed = currentSnapshotWeekNum - initialProductionStartWeek;

            if (weeksElapsed > 0) {
                const calculatedStock = weeksElapsed * weeklyOutput;
                setOpeningFgStock(calculatedStock);
                setDisplayOpeningFgStock(String(Math.round(calculatedStock)));
            } else {
                setOpeningFgStock(0);
                setDisplayOpeningFgStock('0');
            }
        } else {
             setOpeningFgStock(order?.projection?.grn || 0);
             setDisplayOpeningFgStock(String(order?.projection?.grn || 0));
        }
    }, [selectedSnapshotWeek, initialProductionStartWeek, weeklyOutput, order]);


    const handleNumLinesChange = (value: string) => {
        setDisplayNumLines(value);
    };
    
    const handleNumLinesBlur = (e: React.FocusEvent<HTMLInputElement>) => {
        if (orderId) {
            const lines = parseInt(e.target.value, 10);
            if (!isNaN(lines) && lines > 0) {
                setSewingLines(orderId, lines);
            } else {
                setDisplayNumLines(String(numLines));
            }
        }
    };
    
    const snapshotOptions = useMemo(() => {
        if (!order || !order.fcVsFcDetails) return [];
        return order.fcVsFcDetails.map(s => s.snapshotWeek).sort((a,b) => b - a);
    }, [order]);

    const selectedSnapshot = useMemo(() => {
        if (!order || !order.fcVsFcDetails || !selectedSnapshotWeek) {
            return null;
        }
        return order.fcVsFcDetails.find(s => String(s.snapshotWeek) === selectedSnapshotWeek) || null;
    }, [order, selectedSnapshotWeek]);

    const snapshotForecastWeeks = useMemo(() => {
        if (!selectedSnapshot) return [];
        return Object.keys(selectedSnapshot.forecasts).sort((a, b) => {
            const weekA = parseInt(a.replace('W', ''));
            const weekB = parseInt(b.replace('W', ''));
            return weekA - weekB;
        });
    }, [selectedSnapshot]);

    const handlePlan = () => {
        if (!orderId || !order || !selectedSnapshotWeek) return;
        setPlanError(null);
        if (!selectedSnapshot || weeklyOutput <= 0) {
            toast({
                variant: 'destructive',
                title: 'Planning Failed',
                description: 'Cannot generate plan. Ensure a snapshot is selected and production stats are valid.',
            });
            return;
        }
    
        const currentSnapshotWeekNum = parseInt(selectedSnapshotWeek);
        const effectiveStartWeek = Math.max(initialProductionStartWeek || 0, currentSnapshotWeekNum);
        
        const futureForecastWeeks = snapshotForecastWeeks.filter(week => parseInt(week.replace('W', '')) >= effectiveStartWeek);
    
        if (futureForecastWeeks.length === 0) {
            updateProductionPlan(orderId, {});
            toast({ title: 'Plan Generated', description: 'No future demand to plan.' });
            return;
        }
    
        const demands = futureForecastWeeks.map(week => {
            const weekData = selectedSnapshot.forecasts[week]?.total;
            return weekData ? weekData.po + weekData.fc : 0;
        });
    
        const totalDemand = demands.reduce((sum, d) => sum + d, 0);
        
        let cumulativeProduction = 0;
        const newPlan: Record<string, number> = {};
    
        for (let i = 0; i < futureForecastWeeks.length; i++) {
            const week = futureForecastWeeks[i];
    
            if ((openingFgStock + cumulativeProduction) < totalDemand) {
                newPlan[week] = weeklyOutput;
                cumulativeProduction += weeklyOutput;
            } else {
                newPlan[week] = 0;
            }
        }
    
        updateProductionPlan(orderId, newPlan);
        toast({ title: 'Production Plan Generated', description: "The 'Plan' and 'Inv.' rows have been updated." });
    };
    
    const { inventoryData, totals } = useMemo(() => {
        if (!selectedSnapshot) return { inventoryData: {}, totals: {} };
        const weeklyInventory: Record<string, number> = {};
        let previousInventory = openingFgStock;

        const currentSnapshotWeekNum = selectedSnapshotWeek ? parseInt(selectedSnapshotWeek) : 0;
        const effectiveStartWeek = Math.max(initialProductionStartWeek || 0, currentSnapshotWeekNum);
        const futureForecastWeeks = snapshotForecastWeeks.filter(week => parseInt(week.replace('W', '')) >= effectiveStartWeek);

        let totalPoFc = 0;
        let totalPlan = 0;

        for (const week of futureForecastWeeks) {
            const demand = (selectedSnapshot.forecasts[week]?.total.po || 0) + (selectedSnapshot.forecasts[week]?.total.fc || 0);
            const production = productionPlan[week] || 0;

            totalPoFc += demand;
            totalPlan += production;
            
            const closingInventory = previousInventory + production - demand;
            weeklyInventory[week] = closingInventory;
            previousInventory = closingInventory;
        }
        
        const lastInvWeek = futureForecastWeeks[futureForecastWeeks.length -1];

        return { 
            inventoryData: weeklyInventory, 
            totals: {
                poFc: totalPoFc,
                plan: totalPlan,
                inv: weeklyInventory[lastInvWeek]
            }
        };
    }, [selectedSnapshot, snapshotForecastWeeks, openingFgStock, productionPlan, selectedSnapshotWeek, initialProductionStartWeek]);


    if (!isScheduleLoaded) {
        return <div className="flex items-center justify-center h-full">Loading data...</div>;
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
                            <BreadcrumbPage>Production Plan</BreadcrumbPage>
                        </BreadcrumbItem>
                    </BreadcrumbList>
                </Breadcrumb>

                 <div className="flex justify-between items-center mb-4 flex-shrink-0">
                    <div>
                        <h1 className="text-2xl font-bold">Production Plan</h1>
                        {order && (
                            <p className="text-muted-foreground">
                                Order ID: {order.id}
                            </p>
                        )}
                    </div>
                     <Button variant="outline" asChild>
                        <Link href="/orders">
                            <ArrowLeft className="mr-2 h-4 w-4" />
                            Back to Orders
                        </Link>
                    </Button>
                </div>
                
                <div className="space-y-4">
                     {order && (
                        <Card>
                            <CardHeader>
                                <CardTitle>Production Stats</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                                    <div className="p-4 bg-muted rounded-lg">
                                        <div className="text-sm text-muted-foreground">Output per Day</div>
                                        <div className="text-2xl font-bold">{Math.round(outputPerDay).toLocaleString()} units</div>
                                        <div className="text-xs text-muted-foreground">Based on {order.budgetedEfficiency}% budgeted efficiency</div>
                                    </div>
                                    <div className="p-4 bg-muted rounded-lg">
                                        <div className="text-sm text-muted-foreground">Total Tailors (per line)</div>
                                        <div className="text-2xl font-bold">{totalTailors}</div>
                                    </div>
                                    <div className="p-4 bg-muted rounded-lg">
                                        <div className="text-sm text-muted-foreground">Total SAM</div>
                                        <div className="text-2xl font-bold">{totalSam.toFixed(2)}</div>
                                    </div>
                                    <div className="p-4 bg-muted rounded-lg flex flex-col justify-center">
                                        <Label htmlFor="num-lines-input" className="text-sm text-muted-foreground">Number of Lines</Label>
                                        <Input
                                            id="num-lines-input"
                                            type="text"
                                            value={displayNumLines}
                                            onChange={(e) => handleNumLinesChange(e.target.value)}
                                            onBlur={handleNumLinesBlur}
                                            className="w-full h-8 text-2xl font-bold bg-transparent border-0 shadow-none focus-visible:ring-0 p-0"
                                        />
                                    </div>
                                     <div className="p-4 bg-muted rounded-lg flex flex-col justify-center">
                                        <Label htmlFor="opening-fg-stock" className="text-sm text-muted-foreground">Opening FG Stock</Label>
                                        <Input
                                            id="opening-fg-stock"
                                            type="text"
                                            readOnly
                                            value={displayOpeningFgStock}
                                            className="w-full h-8 text-2xl font-bold bg-transparent border-0 shadow-none focus-visible:ring-0 p-0"
                                        />
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                     )}
                     {order && order.fcVsFcDetails && (
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between">
                                <CardTitle>Tentative plan</CardTitle>
                                <div className="flex items-center gap-4">
                                     <div className="flex items-center gap-2">
                                        <Label htmlFor="snapshot-select" className="text-sm text-muted-foreground">Snapshot Week:</Label>
                                        <Select value={selectedSnapshotWeek} onValueChange={setSelectedSnapshotWeek}>
                                            <SelectTrigger className="w-[120px]" id="snapshot-select">
                                                <SelectValue placeholder="Select" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {snapshotOptions.map(week => (
                                                    <SelectItem key={week} value={String(week)}>W{week}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <Button onClick={handlePlan}>Plan</Button>
                                </div>
                            </CardHeader>
                            <CardContent>
                                {planError && (
                                  <Alert variant="destructive" className="mb-4">
                                    <XCircle className="h-4 w-4" />
                                    <AlertTitle>Error</AlertTitle>
                                    <AlertDescription>
                                      {planError}
                                    </AlertDescription>
                                  </Alert>
                                )}
                                {selectedSnapshot ? (
                                    <div className="overflow-x-auto">
                                        <Table className="min-w-full">
                                            <TableBody>
                                                <TableRow>
                                                    <TableHead className={cn("font-semibold sticky left-0 bg-background w-[100px]")}>Week</TableHead>
                                                    {snapshotForecastWeeks.map(week => (
                                                        <TableCell key={week} className="text-right font-medium min-w-[80px]">{week}</TableCell>
                                                    ))}
                                                    <TableHead className="text-right font-bold min-w-[90px]">Total</TableHead>
                                                </TableRow>
                                                <TableRow>
                                                    <TableHead className={cn("font-semibold sticky left-0 bg-background w-[100px]")}>PO + FC</TableHead>
                                                    {snapshotForecastWeeks.map(week => {
                                                        const weekData = selectedSnapshot.forecasts[week]?.total;
                                                        const totalValue = weekData ? weekData.po + weekData.fc : 0;
                                                        return (
                                                            <TableCell key={week} className="text-right tabular-nums min-w-[80px]">
                                                                {totalValue > 0 ? totalValue.toLocaleString() : '-'}
                                                            </TableCell>
                                                        )
                                                    })}
                                                     <TableCell className="text-right tabular-nums min-w-[90px] font-bold">
                                                        {totals.poFc > 0 ? totals.poFc.toLocaleString() : '-'}
                                                    </TableCell>
                                                </TableRow>
                                                <TableRow>
                                                    <TableHead className={cn("font-semibold sticky left-0 bg-background w-[100px]")}>Plan</TableHead>
                                                    {snapshotForecastWeeks.map(week => (
                                                        <TableCell key={`plan-${week}`} className="text-right tabular-nums min-w-[80px]">
                                                            {productionPlan[week] ? Math.round(productionPlan[week]).toLocaleString() : '-'}
                                                        </TableCell>
                                                    ))}
                                                    <TableCell className="text-right tabular-nums min-w-[90px] font-bold">
                                                        {totals.plan > 0 ? Math.round(totals.plan).toLocaleString() : '-'}
                                                    </TableCell>
                                                </TableRow>
                                                 <TableRow>
                                                    <TableHead className={cn("font-semibold sticky left-0 bg-background w-[100px]")}>Inv.</TableHead>
                                                    {snapshotForecastWeeks.map(week => (
                                                        <TableCell 
                                                            key={`inv-${week}`} 
                                                            className={cn(
                                                                "text-right tabular-nums min-w-[80px]",
                                                                inventoryData[week] < 0 && "text-destructive font-bold"
                                                            )}
                                                        >
                                                            {inventoryData[week] !== undefined ? Math.round(inventoryData[week]).toLocaleString() : '-'}
                                                        </TableCell>
                                                    ))}
                                                    <TableCell 
                                                        className={cn(
                                                            "text-right tabular-nums min-w-[90px] font-bold",
                                                            totals.inv < 0 && "text-destructive"
                                                        )}
                                                    >
                                                        {totals.inv !== undefined ? Math.round(totals.inv).toLocaleString() : '-'}
                                                    </TableCell>
                                                </TableRow>
                                            </TableBody>
                                        </Table>
                                    </div>
                                ) : (
                                    <div className="text-center text-muted-foreground p-8">Select a snapshot week to see data.</div>
                                )}
                            </CardContent>
                        </Card>
                     )}
                </div>
            </main>
        </div>
    );
}

export default function ProductionPlanPage() {
    return (
        <Suspense fallback={<div>Loading...</div>}>
            <ProductionPlanPageContent />
        </Suspense>
    );
}
