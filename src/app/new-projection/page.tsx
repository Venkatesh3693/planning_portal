
'use client';

import { Suspense, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
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
import { useSchedule } from '@/context/schedule-provider';
import { getWeek } from 'date-fns';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';

function NewProjectionForm({ orderId }: { orderId: string }) {
    const { orders, isScheduleLoaded } = useSchedule();

    const order = useMemo(() => {
        if (!isScheduleLoaded) return null;
        return orders.find(o => o.id === orderId);
    }, [orderId, orders, isScheduleLoaded]);

    const currentWeek = useMemo(() => getWeek(new Date()), []);

    const projectionNumber = useMemo(() => {
        if (!order) return '';
        // This is a simplified logic. In a real app, you'd query existing projections.
        // For now, we assume this is the first new one we are creating.
        const existingProjections = order.projectionDetails?.length || 0;
        return `PRJ-${order.ocn}-${(existingProjections + 1).toString().padStart(2, '0')}`;
    }, [order]);

    const { maxLeadTime, coverageStartWeek, coverageEndWeek } = useMemo(() => {
        if (!order || !order.bom) return { maxLeadTime: 0, coverageStartWeek: 0, coverageEndWeek: 0 };
        
        const projectionComponents = order.bom.filter(item => item.forecastType === 'Projection');
        const maxLeadTimeDays = Math.max(...projectionComponents.map(item => item.leadTime), 0);
        const maxLeadTimeWeeks = Math.ceil(maxLeadTimeDays / 7);

        const startWeek = currentWeek + maxLeadTimeWeeks + 1;
        const endWeek = currentWeek + maxLeadTimeWeeks + 4;

        return { maxLeadTime: maxLeadTimeWeeks, coverageStartWeek: startWeek, coverageEndWeek: endWeek };
    }, [order, currentWeek]);

    if (!order) {
        return (
            <div className="flex-1 rounded-lg border border-dashed shadow-sm flex items-center justify-center">
                <p className="text-muted-foreground">Order data could not be loaded.</p>
            </div>
        );
    }

    return (
        <Card>
            <CardContent className="p-6 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="space-y-2">
                        <Label>PRJ #</Label>
                        <p className="font-semibold text-lg">{projectionNumber}</p>
                    </div>
                    <div className="space-y-2">
                        <Label>Projection Week</Label>
                        <p className="font-semibold text-lg">W{currentWeek}</p>
                    </div>
                     <div className="space-y-2">
                        <Label>Projection Coverage Weeks</Label>
                        <p className="font-semibold text-lg">W{coverageStartWeek}-W{coverageEndWeek}</p>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}


function NewProjectionPageContent() {
    const searchParams = useSearchParams();
    const orderId = searchParams.get('orderId');

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
                             <BreadcrumbLink asChild>
                                <Link href={`/material-planning?orderId=${orderId}`}>Material Planning</Link>
                            </BreadcrumbLink>
                        </BreadcrumbItem>
                        <BreadcrumbSeparator />
                        <BreadcrumbItem>
                            <BreadcrumbPage>New Projection</BreadcrumbPage>
                        </BreadcrumbItem>
                    </BreadcrumbList>
                </Breadcrumb>

                 <div className="flex justify-between items-center mb-4 flex-shrink-0">
                    <div>
                        <h1 className="text-2xl font-bold">Create New Projection</h1>
                        {orderId && (
                            <p className="text-muted-foreground">
                                For Order ID: {orderId}
                            </p>
                        )}
                    </div>
                     <Button variant="outline" asChild>
                        <Link href={`/material-planning?orderId=${orderId}`}>
                            <ArrowLeft className="mr-2 h-4 w-4" />
                            Back to Material Planning
                        </Link>
                    </Button>
                </div>
                
                {orderId ? (
                    <NewProjectionForm orderId={orderId} />
                ) : (
                     <div className="flex-1 rounded-lg border border-dashed shadow-sm flex items-center justify-center">
                        <p className="text-muted-foreground">No Order ID specified.</p>
                    </div>
                )}
            </main>
        </div>
    );
}

export default function NewProjectionPage() {
    return (
        <Suspense fallback={<div className="flex h-screen w-full items-center justify-center">Loading...</div>}>
            <NewProjectionPageContent />
        </Suspense>
    );
}
