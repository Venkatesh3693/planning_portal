
'use client';

import { useMemo, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useSchedule } from '@/context/schedule-provider';
import { Header } from '@/components/layout/header';
import { SIZES } from '@/lib/data';
import type { Size, SizeBreakdown } from '@/lib/types';
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
import { cn } from '@/lib/utils';


function OrderDetailsContent() {
  const searchParams = useSearchParams();
  const orderId = searchParams.get('orderId');
  const { orders, frcData, isScheduleLoaded, syntheticPoRecords } = useSchedule();

  const order = useMemo(() => {
    if (!orderId) return null;
    return orders.find(o => o.id === orderId);
  }, [orderId, orders]);
  
  const calculateTotalSizeBreakdown = (items: { quantities: SizeBreakdown }[]): SizeBreakdown => {
    const totals: SizeBreakdown = { total: 0 };
    SIZES.forEach(s => totals[s] = 0);
    
    items.forEach(item => {
      SIZES.forEach(size => {
        totals[size] = (totals[size] || 0) + (item.quantities[size] || 0);
      });
      totals.total += item.quantities.total || 0;
    });
    return totals;
  };

  const poQty = useMemo(() => {
    if (!order) return null;
    const poRecords = syntheticPoRecords.filter(p => p.orderId === order.id);
    return calculateTotalSizeBreakdown(poRecords);
  }, [order, syntheticPoRecords]);

  const frcQty = useMemo(() => {
    if (!order) return null;

    const relevantFrcs = frcData.filter(frc => 
        frc.ccNo === order.ocn && 
        frc.model === `${order.style} / ${order.color}`
    );
    
    const totals: SizeBreakdown = { total: 0 };
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

  const cutOrderQty = useMemo(() => {
    if (!order) return null;
    return order.cutOrder || { total: 0 };
  }, [order]);

  const frcAvailable = useMemo(() => {
    if (!frcQty || !cutOrderQty) return null;
    const result: SizeBreakdown = { total: 0 };
    SIZES.forEach(size => {
      result[size] = (frcQty[size] || 0) - (cutOrderQty[size] || 0);
    });
    result.total = frcQty.total - cutOrderQty.total;
    return result;
  }, [frcQty, cutOrderQty]);

  const poPlusFcQty = useMemo(() => {
    if (!order?.fcVsFcDetails || order.fcVsFcDetails.length === 0) return null;
    
    const latestSnapshot = [...order.fcVsFcDetails].sort((a,b) => b.snapshotWeek - a.snapshotWeek)[0];
    const totals: SizeBreakdown = { total: 0 };
    SIZES.forEach(s => totals[s] = 0);

    Object.values(latestSnapshot.forecasts).forEach(weekData => {
      SIZES.forEach(size => {
        totals[size] = (totals[size] || 0) + (weekData[size]?.po || 0) + (weekData[size]?.fc || 0);
      });
      totals.total += (weekData.total?.po || 0) + (weekData.total?.fc || 0);
    });

    return totals;

  }, [order]);

  const excessFrc = useMemo(() => {
    if (!frcQty || !poPlusFcQty) return null;
    const result: SizeBreakdown = { total: 0 };
    SIZES.forEach(size => {
      result[size] = (frcQty[size] || 0) - (poPlusFcQty[size] || 0);
    });
    result.total = frcQty.total - poPlusFcQty.total;
    return result;
  }, [frcQty, poPlusFcQty]);


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
              A detailed breakdown of the FRC, PO, and inventory quantities for this order.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {frcQty ? (
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
                        {(frcQty[size] || 0).toLocaleString()}
                      </TableCell>
                    ))}
                    <TableCell className="text-right font-bold">
                      {(frcQty.total || 0).toLocaleString()}
                    </TableCell>
                  </TableRow>
                   <TableRow>
                    <TableCell className="font-medium">Cut Order Qty</TableCell>
                    {SIZES.map(size => (
                      <TableCell key={size} className="text-right text-destructive">
                        ({(cutOrderQty?.[size] || 0).toLocaleString()})
                      </TableCell>
                    ))}
                    <TableCell className="text-right font-bold text-destructive">
                      ({(cutOrderQty?.total || 0).toLocaleString()})
                    </TableCell>
                  </TableRow>
                  {frcAvailable && (
                    <TableRow className="bg-muted font-semibold">
                      <TableCell>FRC Available</TableCell>
                       {SIZES.map(size => (
                        <TableCell key={size} className="text-right">
                          {(frcAvailable[size] || 0).toLocaleString()}
                        </TableCell>
                      ))}
                      <TableCell className="text-right font-bold">
                        {(frcAvailable.total || 0).toLocaleString()}
                      </TableCell>
                    </TableRow>
                  )}
                  {poQty && (
                    <TableRow>
                      <TableCell className="font-medium">PO Qty</TableCell>
                      {SIZES.map(size => (
                        <TableCell key={size} className="text-right">
                          {(poQty[size] || 0).toLocaleString()}
                        </TableCell>
                      ))}
                      <TableCell className="text-right font-bold">
                        {(poQty.total || 0).toLocaleString()}
                      </TableCell>
                    </TableRow>
                  )}
                  {poPlusFcQty && (
                    <TableRow>
                      <TableCell className="font-medium">PO+FC Qty</TableCell>
                      {SIZES.map(size => (
                        <TableCell key={size} className="text-right">
                          {(poPlusFcQty[size] || 0).toLocaleString()}
                        </TableCell>
                      ))}
                      <TableCell className="text-right font-bold">
                        {(poPlusFcQty.total || 0).toLocaleString()}
                      </TableCell>
                    </TableRow>
                  )}
                  {excessFrc && (
                     <TableRow className="bg-muted font-semibold">
                      <TableCell>Excess FRC</TableCell>
                       {SIZES.map(size => (
                        <TableCell key={size} className={cn("text-right", (excessFrc[size] || 0) < 0 && 'text-destructive')}>
                          {(excessFrc[size] || 0).toLocaleString()}
                        </TableCell>
                      ))}
                      <TableCell className={cn("text-right font-bold", (excessFrc.total || 0) < 0 && 'text-destructive')}>
                        {(excessFrc.total || 0).toLocaleString()}
                      </TableCell>
                    </TableRow>
                  )}
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

