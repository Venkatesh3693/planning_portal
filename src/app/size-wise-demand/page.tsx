
'use client';

import { useState, useMemo, useEffect } from 'react';
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';

export default function SizeWiseDemandPage() {
  const { orders, isScheduleLoaded, appMode } = useSchedule();
  const [selectedOrderId, setSelectedOrderId] = useState<string>('');
  const [selectedSnapshotWeek, setSelectedSnapshotWeek] = useState<number | null>(null);

  const gutOrders = useMemo(() => {
    if (!isScheduleLoaded) return [];
    return orders.filter(o => o.orderType === 'Forecasted');
  }, [orders, isScheduleLoaded]);

  const selectedOrder = useMemo(() => {
    if (!selectedOrderId) return null;
    return gutOrders.find(o => o.id === selectedOrderId);
  }, [selectedOrderId, gutOrders]);

  const snapshotOptions = useMemo(() => {
    if (!selectedOrder?.fcVsFcDetails) return [];
    return [...selectedOrder.fcVsFcDetails]
        .map(s => s.snapshotWeek)
        .sort((a, b) => b - a);
  }, [selectedOrder]);

  useEffect(() => {
    if (selectedOrder && snapshotOptions.length > 0) {
        setSelectedSnapshotWeek(snapshotOptions[0]);
    } else {
        setSelectedSnapshotWeek(null);
    }
  }, [selectedOrder, snapshotOptions]);

  if (appMode === 'gup') {
    return (
        <div className="flex h-screen flex-col">
          <Header />
          <main className="flex-1 p-4 sm:p-6 lg:p-8 flex items-center justify-center">
            <div className="text-center">
              <h2 className="text-xl font-semibold">Size-wise Demand Not Available</h2>
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
      <main className="flex-1 p-4 sm:p-6 lg:p-8">
        <Breadcrumb className="mb-4">
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link href="/">Home</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>Size-wise Demand</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
        <div className="space-y-4">
          <h1 className="text-2xl font-bold">Size-wise Demand</h1>
          <p className="text-muted-foreground">
            Analysis of demand based on size.
          </p>

          <div className="flex gap-4">
            <div className="w-full max-w-xs space-y-2">
                <Label htmlFor="order-select">Select Order ID</Label>
                <Select value={selectedOrderId} onValueChange={setSelectedOrderId}>
                    <SelectTrigger id="order-select">
                        <SelectValue placeholder="Select an order..." />
                    </SelectTrigger>
                    <SelectContent>
                        {gutOrders.map(order => (
                            <SelectItem key={order.id} value={order.id}>
                                {order.id} ({order.style})
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
             {selectedOrder && snapshotOptions.length > 0 && (
                <div className="flex items-end gap-2">
                    <div className="w-full max-w-xs space-y-2">
                        <Label htmlFor="snapshot-select">Select Snapshot Week</Label>
                        <Select value={selectedSnapshotWeek !== null ? String(selectedSnapshotWeek) : ''} onValueChange={(val) => setSelectedSnapshotWeek(Number(val))}>
                            <SelectTrigger id="snapshot-select">
                                <SelectValue placeholder="Select a snapshot..." />
                            </SelectTrigger>
                            <SelectContent>
                                {snapshotOptions.map(week => (
                                    <SelectItem key={week} value={String(week)}>
                                        Snapshot Week {week}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </div>
            )}
        </div>

          {/* Content will go here */}
        </div>
      </main>
    </div>
  );
}
