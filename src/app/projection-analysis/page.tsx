
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Card, CardContent } from '@/components/ui/card';
import { format, getWeek, subDays } from 'date-fns';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';


function ProjectionAnalysisPageContent() {
    const searchParams = useSearchParams();
    const orderId = searchParams.get('orderId');
    const { orders, isScheduleLoaded } = useSchedule();

    const order = useMemo(() => {
        if (!isScheduleLoaded || !orderId) return null;
        return orders.find(o => o.id === orderId);
    }, [orderId, orders, isScheduleLoaded]);

    const projectionComponentsCount = useMemo(() => {
        if (!order || !order.bom) return 0;
        return order.bom.filter(item => item.forecastType === 'Projection').length;
    }, [order]);


    if (!isScheduleLoaded) {
        return <div className="flex items-center justify-center h-full">Loading analysis data...</div>;
    }

    if (!order) {
        return <div className="flex items-center justify-center h-full">Order not found. Please go back and select an order.</div>;
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
                            <BreadcrumbPage>Projection Analysis</BreadcrumbPage>
                        </BreadcrumbItem>
                    </BreadcrumbList>
                </Breadcrumb>
                 <div className="flex justify-between items-center mb-4 flex-shrink-0">
                    <div>
                        <h1 className="text-2xl font-bold">Projection Analysis for {order.id}</h1>
                        <p className="text-muted-foreground">
                            Style: {order.style} | Buyer: {order.buyer}
                        </p>
                    </div>
                     <Button variant="outline" asChild>
                        <Link href="/orders">
                            <ArrowLeft className="mr-2 h-4 w-4" />
                            Back to Orders
                        </Link>
                    </Button>
                </div>
                
                <div className="flex-1 min-h-0">
                    <Card>
                        <CardContent className="p-0">
                             <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Projection No.</TableHead>
                                        <TableHead>Projection Date</TableHead>
                                        <TableHead>Projection Week</TableHead>
                                        <TableHead>Coverage Weeks</TableHead>
                                        <TableHead className="text-right">Projection Qty</TableHead>
                                        <TableHead>CK Date</TableHead>
                                        <TableHead className="text-right">BOM Components</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {(order.projectionDetails || []).map((proj) => {
                                        const projDate = new Date(proj.projectionDate);
                                        const receiptDate = new Date(proj.receiptDate);
                                        const ckDate = subDays(receiptDate, 7);

                                        return (
                                            <TableRow key={proj.projectionNumber}>
                                                <TableCell className="font-medium">{proj.projectionNumber}</TableCell>
                                                <TableCell>{format(projDate, 'dd/MM/yy')}</TableCell>
                                                <TableCell>W{getWeek(projDate)}</TableCell>
                                                <TableCell>W{getWeek(projDate)} - W{getWeek(receiptDate)}</TableCell>
                                                <TableCell className="text-right">{proj.total.quantities.total.toLocaleString()}</TableCell>
                                                <TableCell>{format(ckDate, 'dd/MM/yy')}</TableCell>
                                                <TableCell className="text-right">{projectionComponentsCount}</TableCell>
                                            </TableRow>
                                        )
                                    })}
                                     {(!order.projectionDetails || order.projectionDetails.length === 0) && (
                                        <TableRow>
                                            <TableCell colSpan={7} className="h-24 text-center">
                                                No projection details available for this order.
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </div>
            </main>
        </div>
    );
}

export default function ProjectionAnalysisPage() {
    return (
        <Suspense fallback={<div>Loading...</div>}>
            <ProjectionAnalysisPageContent />
        </Suspense>
    );
}
