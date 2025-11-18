
'use client';

import { useMemo, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useSchedule } from '@/context/schedule-provider';
import { Header } from '@/components/layout/header';
import { SIZES } from '@/lib/data';
import type { Size } from '@/lib/types';
import Link from 'next/link';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

function OrderDetailsContent() {
  const searchParams = useSearchParams();
  const orderId = searchParams.get('orderId');
  const { orders, frcData, isScheduleLoaded } = useSchedule();

  const order = useMemo(() => {
    if (!orderId) return null;
    return orders.find(o => o.id === orderId);
  }, [orderId, orders]);

  const orderFrcQty = useMemo(() => {
    if (!order) return null;

    const relevantFrcs = frcData.filter(frc => 
        frc.ccNo === order.ocn && 
        frc.model === `${order.style} / ${order.color}`
    );
    
    const totals: Record<Size | 'total', number> = { total: 0 } as any;
    SIZES.forEach(s => totals[s] = 0);

    relevantFrcs.forEach(frc => {
        let frcTotal = 0;
        SIZES.forEach(size => {
            const qty = frc.sizes?.[size] || 0;
            totals[size] = (totals[size] || 0) + qty;
            frcTotal += qty;
        });
        totals.total += frcTotal;
    });

    return totals;
  }, [order, frcData]);

  if (!isScheduleLoaded) {
    return <div className="text-center p-8">Loading order data...</div>;
  }

  if (!order) {
    return <div className="text-center p-8 text-destructive">Order not found.</div>;
  }

  return (
    <div className="flex h-screen flex-col">
      <Header />
      <main className="flex-1 p-4 sm:p-6 lg:p-8 flex flex-col space-y-6">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link href="/orders-new">Order Management</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>Order Details</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
        
        <Card>
          <CardHeader>
            <CardTitle>Order Details: {order.ocn} - {order.color}</CardTitle>
            <CardDescription>
              A detailed breakdown of the FRC quantities for this order.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {orderFrcQty ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Metric</TableHead>
                    {SIZES.map(size => (
                      <TableHead key={size} className="text-right">{size}</TableHead>
                    ))}
                    <TableHead className="text-right font-bold">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell className="font-medium">FRC Qty</TableCell>
                    {SIZES.map(size => (
                      <TableCell key={size} className="text-right">
                        {(orderFrcQty[size] || 0).toLocaleString()}
                      </TableCell>
                    ))}
                    <TableCell className="text-right font-bold">
                      {(orderFrcQty.total || 0).toLocaleString()}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            ) : (
              <div className="text-center text-muted-foreground p-8">
                No FRC data available for this order.
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

export default function OrderDetailsPage() {
    return (
        <Suspense fallback={<div>Loading...</div>}>
            <OrderDetailsContent />
        </Suspense>
    );
}
