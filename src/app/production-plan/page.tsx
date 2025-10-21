
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


function ProductionPlanPageContent() {
    const searchParams = useSearchParams();
    const orderId = searchParams.get('orderId');
    const { orders, isScheduleLoaded, sewingLines, setSewingLines } = useSchedule();
    const { toast } = useToast();

    const [openingFgStock, setOpeningFgStock] = useState(0);
    const [displayOpeningFgStock, setDisplayOpeningFgStock] = useState(String(openingFgStock));
    const [productionPlan, setProductionPlan] = useState<Record<string, number>>({});
    const [planError, setPlanError] = useState<string | null>(null);

    const order = useMemo(() => {
        if (!isScheduleLoaded || !orderId) return null;
        return orders.find(o => o.id === orderId);
    }, [orderId, orders, isScheduleLoaded]);

    const numLines = useMemo(() => {
        if (!orderId) return 1;
        return sewingLines[orderId] || 1;
    }, [orderId, sewingLines]);

    const [displayNumLines, setDisplayNumLines] = useState(String(numLines));

    useEffect(() => {
        setDisplayNumLines(String(numLines || 1));
    }, [numLines]);

    useEffect(() => {
        setDisplayOpeningFgStock(String(openingFgStock));
    }, [openingFgStock]);

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

    const handleOpeningStockChange = (value: string) => {
        setDisplayOpeningFgStock(value);
    };

    const handleOpeningStockBlur = (e: React.FocusEvent<HTMLInputElement>) => {
        const stock = parseInt(e.target.value, 10);
        if (!isNaN(stock) && stock >= 0) {
            setOpeningFgStock(stock);
        } else {
            setDisplayOpeningFgStock(String(openingFgStock));
        }
    };

    const firstSnapshot = useMemo(() => {
        if (!order || !order.fcVsFcDetails || order.fcVsFcDetails.length === 0) {
            return null;
        }
        return order.fcVsFcDetails[0];
    }, [order]);

    const snapshotForecastWeeks = useMemo(() => {
        if (!firstSnapshot) return [];
        return Object.keys(firstSnapshot.forecasts).sort((a, b) => {
            const weekA = parseInt(a.replace('W', ''));
            const weekB = parseInt(b.replace('W', ''));
            return weekA - weekB;
        });
    }, [firstSnapshot]);

    const handlePlan = () => {
        setPlanError(null);
        if (!firstSnapshot || weeklyOutput <= 0) {
          toast({
            variant: 'destructive',
            title: 'Planning Failed',
            description: 'Cannot generate plan. Ensure production stats are valid.',
          });
          return;
        }
      
        const firstDemandWeekIndex = snapshotForecastWeeks.findIndex(week => {
            const demand = (firstSnapshot.forecasts[week]?.total.po || 0) + (firstSnapshot.forecasts[week]?.total.fc || 0);
            return demand > 0;
        });
      
        if (firstDemandWeekIndex === -1) {
            setProductionPlan({});
            toast({ title: 'Plan Generated', description: 'No demand found, no production planned.' });
            return;
        }
        
        const lastDemandWeekIndex = snapshotForecastWeeks.findLastIndex(week => {
            const demand = (firstSnapshot.forecasts[week]?.total.po || 0) + (firstSnapshot.forecasts[week]?.total.fc || 0);
            return demand > 0;
        });

        // --- Trial Run ---
        const trialStartWeekIndex = firstDemandWeekIndex - 1;
        const trialPlan: Record<string, number> = {};
        let cumulativeProduction = 0;
        const totalDemand = snapshotForecastWeeks.reduce((sum, week) => {
            return sum + ((firstSnapshot.forecasts[week]?.total.po || 0) + (firstSnapshot.forecasts[week]?.total.fc || 0));
        }, 0);

        for (let i = 0; i < snapshotForecastWeeks.length; i++) {
            const week = snapshotForecastWeeks[i];
            let productionThisWeek = 0;
            if (i >= trialStartWeekIndex && cumulativeProduction < totalDemand) {
                productionThisWeek = weeklyOutput;
                cumulativeProduction += weeklyOutput;
            }
            trialPlan[week] = productionThisWeek;
        }

        const trialInventories: number[] = [];
        let currentInventory = openingFgStock;
      
        for (let i = 0; i < snapshotForecastWeeks.length; i++) {
            const week = snapshotForecastWeeks[i];
            const demand = (firstSnapshot.forecasts[week]?.total.po || 0) + (firstSnapshot.forecasts[week]?.total.fc || 0);
            const production = i > 0 ? (trialPlan[snapshotForecastWeeks[i-1]] || 0) : 0;
            currentInventory = currentInventory + production - demand;
            trialInventories.push(currentInventory);
        }

        const minInventory = Math.min(...trialInventories);
        
        let startOffset = 0;
        if (minInventory < 0) {
            startOffset = Math.ceil(Math.abs(minInventory) / weeklyOutput);
        }
      
        const finalStartWeekIndex = trialStartWeekIndex - startOffset;

        if (finalStartWeekIndex < 0) {
          setPlanError(`Cannot meet demand. Production needs to start ${Math.abs(finalStartWeekIndex)} week(s) before ${snapshotForecastWeeks[0]}. Try increasing the number of lines.`);
          setProductionPlan({});
          return;
        }
      
        const newPlan: Record<string, number> = {};
        cumulativeProduction = 0; // Reset for final plan
        for (let i = 0; i < snapshotForecastWeeks.length; i++) {
            const week = snapshotForecastWeeks[i];
            let productionThisWeek = 0;
            if (i >= finalStartWeekIndex && cumulativeProduction < totalDemand) {
                productionThisWeek = weeklyOutput;
                cumulativeProduction += weeklyOutput;
            }
            newPlan[week] = productionThisWeek;
        }
      
        setProductionPlan(newPlan);
        toast({ title: 'Production Plan Generated', description: "The 'Plan' and 'Inv.' rows have been updated." });
    };
    
    const inventoryData = useMemo(() => {
        if (!firstSnapshot) return {};
        const weeklyInventory: Record<string, number> = {};
        let previousInventory = openingFgStock;

        for (let i = 0; i < snapshotForecastWeeks.length; i++) {
            const week = snapshotForecastWeeks[i];
            const demand = (firstSnapshot.forecasts[week]?.total.po || 0) + (firstSnapshot.forecasts[week]?.total.fc || 0);
            const production = i > 0 ? (productionPlan[snapshotForecastWeeks[i-1]] || 0) : 0;
            const closingInventory = previousInventory + production - demand;
            weeklyInventory[week] = closingInventory;
            previousInventory = closingInventory;
        }

        return weeklyInventory;
    }, [firstSnapshot, snapshotForecastWeeks, openingFgStock, productionPlan]);


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
                                            value={displayOpeningFgStock}
                                            onChange={(e) => handleOpeningStockChange(e.target.value)}
                                            onBlur={handleOpeningStockBlur}
                                            className="w-full h-8 text-2xl font-bold bg-transparent border-0 shadow-none focus-visible:ring-0 p-0"
                                        />
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                     )}
                     {firstSnapshot && (
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between">
                                <CardTitle>Tentative plan</CardTitle>
                                <Button onClick={handlePlan}>Plan</Button>
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
                                <div className="overflow-x-auto">
                                    <Table className="min-w-full">
                                        <TableBody>
                                            <TableRow>
                                                <TableHead className={cn("font-semibold sticky left-0 bg-background w-[100px]")}>Week</TableHead>
                                                {snapshotForecastWeeks.map(week => (
                                                    <TableCell key={week} className="text-right font-medium min-w-[80px]">{week}</TableCell>
                                                ))}
                                            </TableRow>
                                            <TableRow>
                                                <TableHead className={cn("font-semibold sticky left-0 bg-background w-[100px]")}>PO + FC</TableHead>
                                                {snapshotForecastWeeks.map(week => {
                                                    const weekData = firstSnapshot.forecasts[week]?.total;
                                                    const totalValue = weekData ? weekData.po + weekData.fc : 0;
                                                    return (
                                                        <TableCell key={week} className="text-right tabular-nums min-w-[80px]">
                                                            {totalValue > 0 ? totalValue.toLocaleString() : '-'}
                                                        </TableCell>
                                                    )
                                                })}
                                            </TableRow>
                                            <TableRow>
                                                <TableHead className={cn("font-semibold sticky left-0 bg-background w-[100px]")}>Plan</TableHead>
                                                {snapshotForecastWeeks.map(week => (
                                                    <TableCell key={`plan-${week}`} className="text-right tabular-nums min-w-[80px]">
                                                        {productionPlan[week] ? Math.round(productionPlan[week]).toLocaleString() : '-'}
                                                    </TableCell>
                                                ))}
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
                                            </TableRow>
                                        </TableBody>
                                    </Table>
                                </div>
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
