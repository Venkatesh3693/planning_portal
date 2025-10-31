
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
import { PlusCircle } from 'lucide-react';
import type { Order } from '@/lib/types';


function MaterialPlanningPageContent() {
    const searchParams = useSearchParams();
    const orderIdFromUrl = searchParams.get('orderId');
    const { orders, isScheduleLoaded } = useSchedule();
    
    const order = useMemo(() => {
        if (!isScheduleLoaded || !orderIdFromUrl) return null;
        return orders.find(o => o.id === orderIdFromUrl);
    }, [orderIdFromUrl, orders, isScheduleLoaded]);

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
                    <div className="flex items-center gap-2">
                         <Button asChild>
                           <Link href={`/new-projection?orderId=${orderIdFromUrl}`}>
                                <PlusCircle className="mr-2 h-4 w-4" />
                                Projection
                           </Link>
                        </Button>
                        <Button asChild>
                           <Link href={`/new-frc?orderId=${orderIdFromUrl}`}>
                                <PlusCircle className="mr-2 h-4 w-4" />
                                FRC
                           </Link>
                        </Button>
                    </div>
                </div>
                
                <div className="space-y-6">
                    {/* The content has been cleared to redefine the logic from scratch. */}
                     <div className="flex-1 rounded-lg border border-dashed shadow-sm flex items-center justify-center min-h-[400px]">
                        <p className="text-muted-foreground">Material planning details will be displayed here.</p>
                    </div>
                </div>
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
