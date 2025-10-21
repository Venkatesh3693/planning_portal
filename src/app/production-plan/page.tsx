
'use client';

import { Suspense, useMemo, useState } from 'react';
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
import { ArrowLeft } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { SEWING_OPERATIONS_BY_STYLE, WORK_DAY_MINUTES } from '@/lib/data';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';


function ProductionPlanPageContent() {
    const searchParams = useSearchParams();
    const orderId = searchParams.get('orderId');
    const { orders, isScheduleLoaded, sewingLines, setSewingLines } = useSchedule();

    const order = useMemo(() => {
        if (!isScheduleLoaded || !orderId) return null;
        return orders.find(o => o.id === orderId);
    }, [orderId, orders, isScheduleLoaded]);

    const numLines = useMemo(() => {
        if (!orderId) return 1;
        return sewingLines[orderId] || 1;
    }, [orderId, sewingLines]);

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

    const handleNumLinesChange = (value: string) => {
        if (orderId) {
            const lines = parseInt(value, 10);
            if (!isNaN(lines) && lines > 0) {
                setSewingLines(orderId, lines);
            } else if (value === '') {
                setSewingLines(orderId, 0); 
            }
        }
    };
    
    const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
        if (e.target.value === '' && orderId) {
            setSewingLines(orderId, 1);
        }
    }

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
                                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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
                                            min="1"
                                            value={numLines === 0 ? '' : String(numLines)}
                                            onChange={(e) => handleNumLinesChange(e.target.value)}
                                            onBlur={handleBlur}
                                            className="w-full h-8 text-2xl font-bold bg-transparent border-0 shadow-none focus-visible:ring-0 p-0"
                                        />
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                     )}
                     {firstSnapshot && (
                        <Card>
                            <CardHeader>
                                <CardTitle>Tentative plan</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <Table>
                                    <TableBody>
                                        <TableRow>
                                            <TableHead className={cn("font-semibold sticky left-0 bg-background")}>Week</TableHead>
                                            {snapshotForecastWeeks.map(week => (
                                                <TableCell key={week} className="text-right font-medium">{week}</TableCell>
                                            ))}
                                        </TableRow>
                                        <TableRow>
                                            <TableHead className={cn("font-semibold sticky left-0 bg-background")}>PO + FC</TableHead>
                                            {snapshotForecastWeeks.map(week => {
                                                const weekData = firstSnapshot.forecasts[week]?.total;
                                                const totalValue = weekData ? weekData.po + weekData.fc : 0;
                                                return (
                                                    <TableCell key={week} className="text-right tabular-nums">
                                                        {totalValue > 0 ? totalValue.toLocaleString() : '-'}
                                                    </TableCell>
                                                )
                                            })}
                                        </TableRow>
                                    </TableBody>
                                </Table>
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
