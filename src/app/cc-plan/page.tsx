
'use client';

import { Suspense, useMemo, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
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
import type { Order } from '@/lib/types';


function CcPlanPageContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const selectedCc = searchParams.get('cc');
    const { orders, isScheduleLoaded, appMode } = useSchedule();
    
    const ccOptions = useMemo(() => {
        if (!isScheduleLoaded) return [];
        const ccSet = new Set<string>();
        orders.forEach(o => {
            if (o.orderType === 'Forecasted' && o.ocn) {
                ccSet.add(o.ocn);
            }
        });
        return Array.from(ccSet);
    }, [orders, isScheduleLoaded]);

    const ordersForCc = useMemo(() => {
        if (!selectedCc) return [];
        return orders.filter(o => o.ocn === selectedCc && o.orderType === 'Forecasted');
    }, [selectedCc, orders]);

    const handleCcChange = (cc: string) => {
        router.push(`/cc-plan?cc=${cc}`);
    };

    if (appMode === 'gup') {
        return (
            <div className="flex h-screen flex-col">
              <Header />
              <main className="flex-1 p-4 sm:p-6 lg:p-8 flex items-center justify-center">
                <div className="text-center">
                  <h2 className="text-xl font-semibold">CC Plan Not Available</h2>
                  <p className="mt-2 text-muted-foreground">
                    This view is only applicable for GUT mode.
                  </p>
                  <Button asChild className="mt-6">
                    <Link href="/">View GUP Schedule</Link>
                  </Button>
                </div>
              </main>
            </div>
        )
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
                            <BreadcrumbPage>CC Plan</BreadcrumbPage>
                        </BreadcrumbItem>
                    </BreadcrumbList>
                </Breadcrumb>

                 <div className="flex justify-between items-center mb-4 flex-shrink-0">
                    <div>
                        <h1 className="text-2xl font-bold">CC Plan</h1>
                         <div className="flex items-center gap-2 mt-2">
                            <Label htmlFor="cc-select" className="text-muted-foreground">CC No:</Label>
                             <Select value={selectedCc || ''} onValueChange={handleCcChange}>
                                <SelectTrigger className="w-[250px]" id="cc-select">
                                    <SelectValue placeholder="Select a CC" />
                                </SelectTrigger>
                                <SelectContent>
                                    {ccOptions.map(cc => (
                                        <SelectItem key={cc} value={cc}>{cc}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                </div>
                
                <div className="space-y-4">
                    {selectedCc ? (
                        ordersForCc.length > 0 ? (
                           // The content for the CC Plan page will be built here based on the selected CC.
                           <div className="p-8 text-center text-muted-foreground border rounded-lg">
                                CC: {selectedCc}. <br/>
                                {ordersForCc.length} model(s) found.
                           </div>
                        ) : (
                             <div className="p-8 text-center text-muted-foreground border rounded-lg">
                                No orders found for CC: {selectedCc}
                           </div>
                        )
                    ) : (
                         <div className="p-8 text-center text-muted-foreground border rounded-lg">
                            Please select a CC to view the plan.
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
}

export default function CcPlanPage() {
    return (
        <Suspense fallback={<div>Loading...</div>}>
            <CcPlanPageContent />
        </Suspense>
    );
}
