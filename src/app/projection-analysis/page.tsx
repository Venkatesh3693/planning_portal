
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent } from '@/components/ui/card';

const dummyData = [
    {
        prjNumber: "PRJ-001",
        prjWeek: "W10",
        prjCoverage: "W26-W29",
        ckWeek: "W25",
        prjQty: 40000,
        frcWeek: "W14",
        frcCoverage: "W30-W33",
        frcQty: 32000,
        cutOrderQty: 30000,
        cutOrderPending: 2000,
    },
    {
        prjNumber: "PRJ-002",
        prjWeek: "W14",
        prjCoverage: "W30-W33",
        ckWeek: "W29",
        prjQty: 45000,
        frcWeek: "W18",
        frcCoverage: "W34-W37",
        frcQty: 38000,
        cutOrderQty: 35000,
        cutOrderPending: 3000,
    },
    {
        prjNumber: "PRJ-003",
        prjWeek: "W18",
        prjCoverage: "W34-W37",
        ckWeek: "W33",
        prjQty: 50000,
        frcWeek: "W22",
        frcCoverage: "W38-W41",
        frcQty: 42000,
        cutOrderQty: 40000,
        cutOrderPending: 2000,
    },
    {
        prjNumber: "PRJ-004",
        prjWeek: "W22",
        prjCoverage: "W38-W41",
        ckWeek: "W37",
        prjQty: 55000,
        frcWeek: "W26",
        frcCoverage: "W42-W45",
        frcQty: 48000,
        cutOrderQty: 45000,
        cutOrderPending: 3000,
    },
];

function MaterialPlanningPageContent() {
    const searchParams = useSearchParams();
    const orderId = searchParams.get('orderId');
    const { orders, isScheduleLoaded } = useSchedule();
    
    const order = useMemo(() => {
        if (!isScheduleLoaded || !orderId) return null;
        return orders.find(o => o.id === orderId);
    }, [orderId, orders, isScheduleLoaded]);

    if (!isScheduleLoaded) {
        return <div className="flex items-center justify-center h-full">Loading data...</div>;
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
                            <BreadcrumbPage>Material Planning</BreadcrumbPage>
                        </BreadcrumbItem>
                    </BreadcrumbList>
                </Breadcrumb>
                 <div className="flex justify-between items-center mb-4 flex-shrink-0">
                    <div>
                        <h1 className="text-2xl font-bold">Material Planning for {order.id}</h1>
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
                
                <Card>
                    <CardContent className="p-0">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>PRJ#</TableHead>
                                    <TableHead>Projection week</TableHead>
                                    <TableHead>PRJ Coverage weeks</TableHead>
                                    <TableHead>CK Week</TableHead>
                                    <TableHead className="text-right">Projection Qty</TableHead>
                                    <TableHead>FRC Week</TableHead>
                                    <TableHead>FRC Coverage weeks</TableHead>
                                    <TableHead className="text-right">FRC Qty</TableHead>
                                    <TableHead className="text-right">Cut Order Qty</TableHead>
                                    <TableHead className="text-right">Cut Order pending</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {dummyData.map((row) => (
                                    <TableRow key={row.prjNumber}>
                                        <TableCell className="font-medium">{row.prjNumber}</TableCell>
                                        <TableCell>{row.prjWeek}</TableCell>
                                        <TableCell>{row.prjCoverage}</TableCell>
                                        <TableCell>{row.ckWeek}</TableCell>
                                        <TableCell className="text-right">{row.prjQty.toLocaleString()}</TableCell>
                                        <TableCell>{row.frcWeek}</TableCell>
                                        <TableCell>{row.frcCoverage}</TableCell>
                                        <TableCell className="text-right">{row.frcQty.toLocaleString()}</TableCell>
                                        <TableCell className="text-right">{row.cutOrderQty.toLocaleString()}</TableCell>
                                        <TableCell className="text-right">{row.cutOrderPending.toLocaleString()}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            </main>
        </div>
    );
}

export default function MaterialPlanningPage() {
    return (
        <Suspense fallback={<div>Loading...</div>}>
            <MaterialPlanningPageContent />
        </Suspense>
    );
}
