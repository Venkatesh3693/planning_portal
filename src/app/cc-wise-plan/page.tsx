
'use client';

import { Suspense, useState, useMemo } from 'react';
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';


function CcWisePlanPageContent() {
    const { isScheduleLoaded, orders } = useSchedule();
    const [selectedCc, setSelectedCc] = useState<string>('');

    const ccOptions = useMemo(() => {
        if (!isScheduleLoaded) return [];
        const uniqueCcs = [...new Set(orders.map(o => o.ocn))];
        return uniqueCcs.sort();
    }, [orders, isScheduleLoaded]);
    
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
                            <BreadcrumbPage>CC-wise Plan</BreadcrumbPage>
                        </BreadcrumbItem>
                    </BreadcrumbList>
                </Breadcrumb>

                 <div className="flex justify-between items-start mb-4 flex-shrink-0">
                    <div>
                        <h1 className="text-2xl font-bold">CC-wise Plan</h1>
                        <p className="text-muted-foreground">
                            A plan based on style/color code combination.
                        </p>
                    </div>
                     <Button variant="outline" asChild>
                        <Link href="/orders">
                            <ArrowLeft className="mr-2 h-4 w-4" />
                            Back to Orders
                        </Link>
                    </Button>
                </div>
                
                <div className="space-y-4">
                    <div className="w-full max-w-xs space-y-2">
                        <Label htmlFor="cc-select">Select CC</Label>
                        <Select value={selectedCc} onValueChange={setSelectedCc}>
                            <SelectTrigger id="cc-select">
                                <SelectValue placeholder="Select a CC..." />
                            </SelectTrigger>
                            <SelectContent>
                                {ccOptions.map(cc => (
                                    <SelectItem key={cc} value={cc}>
                                        {cc}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </div>
            </main>
        </div>
    );
}

export default function CcWisePlanPage() {
    return (
        <Suspense fallback={<div>Loading...</div>}>
            <CcWisePlanPageContent />
        </Suspense>
    );
}
