
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
import { ArrowLeft, ChevronsUpDown } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableFooter,
} from "@/components/ui/table";
import { Card, CardContent } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { SIZES } from '@/lib/data';
import type { Size } from '@/lib/types';

// Dummy data structure that now includes what we need for the breakdown
const dummyData = [
    {
        prjNumber: "PRJ-001",
        prjWeek: "W10",
        prjCoverage: "W26-W29",
        ckWeek: "W25",
        prjQty: 40000,
        frcWeek: "W14",
        frcCoverage: "W30-W33", // 4 weeks
        frcQty: 32000,
        cutOrderQty: 30000,
        cutOrderPending: 2000,
        breakdown: {
            'W30': { 'S': 500, 'M': 1000, 'L': 500, total: 2000 },
            'W31': { 'S': 1500, 'M': 4000, 'L': 2500, 'XL': 2000, total: 10000 },
            'W32': { 'S': 1500, 'M': 4000, 'L': 2500, 'XL': 2000, total: 10000 },
            'W33': { 'S': 1500, 'M': 4000, 'L': 2500, 'XL': 2000, total: 10000 },
        }
    },
    {
        prjNumber: "PRJ-002",
        prjWeek: "W14",
        prjCoverage: "W30-W33",
        ckWeek: "W29",
        prjQty: 45000,
        frcWeek: "W18",
        frcCoverage: "W34-W37", // 4 weeks
        frcQty: 38000,
        cutOrderQty: 35000,
        cutOrderPending: 3000,
        breakdown: {
            'W34': { 'M': 1000, 'L': 2000, 'XL': 1000, total: 4000 },
            'W35': { 'M': 4000, 'L': 6000, 'XL': 4000, total: 14000 },
            'W36': { 'M': 4000, 'L': 6000, 'XL': 4000, total: 14000 },
            'W37': { 'M': 2000, 'L': 3000, 'XL': 1000, total: 6000 },
        }
    },
];

type DummyDataType = typeof dummyData[0];

const FrcBreakdownTable = ({ breakdown }: { breakdown: DummyDataType['breakdown'] }) => {
    const weeks = Object.keys(breakdown);
    const sizeTotals = SIZES.reduce((acc, size) => {
        acc[size] = 0;
        return acc;
    }, {} as Record<Size, number>);

    weeks.forEach(week => {
        SIZES.forEach(size => {
            sizeTotals[size] += breakdown[week as keyof typeof breakdown]?.[size as Size] || 0;
        });
    });

    const grandTotal = Object.values(sizeTotals).reduce((sum, val) => sum + val, 0);

    return (
        <Card className="mt-4">
            <CardContent className="p-0">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Week</TableHead>
                            {SIZES.map(size => (
                                <TableHead key={size} className="text-right">{size}</TableHead>
                            ))}
                            <TableHead className="text-right font-bold">Total</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {weeks.map(week => {
                            const weekData = breakdown[week as keyof typeof breakdown];
                            const weekTotal = Object.values(weekData).reduce((s, v) => s + (typeof v === 'number' ? v : 0), 0);
                            return (
                                <TableRow key={week}>
                                    <TableCell className="font-medium">{week}</TableCell>
                                    {SIZES.map(size => (
                                        <TableCell key={`${week}-${size}`} className="text-right">
                                            {(weekData[size as Size] || 0).toLocaleString()}
                                        </TableCell>
                                    ))}
                                    <TableCell className="text-right font-bold">{weekTotal.toLocaleString()}</TableCell>
                                </TableRow>
                            );
                        })}
                    </TableBody>
                    <TableFooter>
                        <TableRow>
                            <TableCell className="font-bold">Total</TableCell>
                            {SIZES.map(size => (
                                <TableCell key={`total-${size}`} className="text-right font-bold">
                                    {(sizeTotals[size] || 0).toLocaleString()}
                                </TableCell>
                            ))}
                            <TableCell className="text-right font-bold">{grandTotal.toLocaleString()}</TableCell>
                        </TableRow>
                    </TableFooter>
                </Table>
            </CardContent>
        </Card>
    );
};


function MaterialPlanningPageContent() {
    const searchParams = useSearchParams();
    const orderId = searchParams.get('orderId');
    const { orders, isScheduleLoaded } = useSchedule();
    const [selectedFrc, setSelectedFrc] = useState<DummyDataType | null>(null);
    
    const order = useMemo(() => {
        if (!isScheduleLoaded || !orderId) return null;
        return orders.find(o => o.id === orderId);
    }, [orderId, orders, isScheduleLoaded]);

    const handleFrcClick = (frcItem: DummyDataType) => {
        setSelectedFrc(prev => prev?.prjNumber === frcItem.prjNumber ? null : frcItem);
    };

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
                                        <TableCell className="text-right">
                                            <span 
                                                className="font-medium text-primary cursor-pointer hover:underline"
                                                onClick={() => handleFrcClick(row)}
                                            >
                                                {row.frcQty.toLocaleString()}
                                            </span>
                                        </TableCell>
                                        <TableCell className="text-right">{row.cutOrderQty.toLocaleString()}</TableCell>
                                        <TableCell className="text-right">{row.cutOrderPending.toLocaleString()}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>

                {selectedFrc && (
                    <FrcBreakdownTable breakdown={selectedFrc.breakdown} />
                )}
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

    