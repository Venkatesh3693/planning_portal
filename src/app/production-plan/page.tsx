
'use client';

import { Suspense, useMemo } from 'react';
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


function ProductionPlanPageContent() {
    const searchParams = useSearchParams();
    const orderId = searchParams.get('orderId');
    const { orders, isScheduleLoaded } = useSchedule();

    const order = useMemo(() => {
        if (!isScheduleLoaded || !orderId) return null;
        return orders.find(o => o.id === orderId);
    }, [orderId, orders, isScheduleLoaded]);

    const { totalSam, totalTailors } = useMemo(() => {
        if (!order) return { totalSam: 0, totalTailors: 0 };
        const operations = SEWING_OPERATIONS_BY_STYLE[order.style] || [];
        if (operations.length === 0) return { totalSam: 0, totalTailors: 0 };
        
        const totalSam = operations.reduce((sum, op) => sum + op.sam, 0);
        const totalTailors = operations.reduce((sum, op) => sum + op.operators, 0);

        return { totalSam, totalTailors };
    }, [order]);

    const outputPerDay = useMemo(() => {
        if (!order || totalSam === 0 || totalTailors === 0 || !order.budgetedEfficiency) {
            return 0;
        }
        const efficiency = order.budgetedEfficiency / 100;
        return ((totalTailors * WORK_DAY_MINUTES) / totalSam) * efficiency;
    }, [order, totalSam, totalTailors]);

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
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div className="p-4 bg-muted rounded-lg">
                                        <div className="text-sm text-muted-foreground">Output per Day</div>
                                        <div className="text-2xl font-bold">{Math.round(outputPerDay).toLocaleString()} units</div>
                                        <div className="text-xs text-muted-foreground">Based on {order.budgetedEfficiency}% budgeted efficiency</div>
                                    </div>
                                    <div className="p-4 bg-muted rounded-lg">
                                        <div className="text-sm text-muted-foreground">Total Tailors</div>
                                        <div className="text-2xl font-bold">{totalTailors}</div>
                                    </div>
                                    <div className="p-4 bg-muted rounded-lg">
                                        <div className="text-sm text-muted-foreground">Total SAM</div>
                                        <div className="text-2xl font-bold">{totalSam.toFixed(2)}</div>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                     )}
                    <div className="flex-1 min-h-[40vh] border-2 border-dashed rounded-lg flex items-center justify-center">
                        <p className="text-muted-foreground">This page is under construction.</p>
                    </div>
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
