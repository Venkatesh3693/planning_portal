
'use client';

import { useMemo, Suspense, useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useSchedule } from '@/context/schedule-provider';
import { Header } from '@/components/layout/header';
import { SIZES } from '@/lib/data';
import type { Size, SizeBreakdown, FcSnapshot } from '@/lib/types';
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { DatePicker } from '@/components/ui/date-picker';
import { getWeek, startOfToday } from 'date-fns';


function OrderDetailsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const orderIdFromUrl = searchParams.get('orderId');
  
  const { orders, frcData, isScheduleLoaded, syntheticPoRecords } = useSchedule();
  
  const [selectedCc, setSelectedCc] = useState('');
  const [selectedColor, setSelectedColor] = useState('');
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [coSelectedDate, setCoSelectedDate] = useState<Date | undefined>(undefined);

  const ccOptions = useMemo(() => {
    return [...new Set(orders.filter(o => o.orderType === 'Forecasted').map(o => o.ocn))].sort();
  }, [orders]);

  const colorOptions = useMemo(() => {
    if (!selectedCc) return [];
    return [...new Set(orders.filter(o => o.ocn === selectedCc).map(o => o.color))].sort();
  }, [selectedCc, orders]);

  useEffect(() => {
    if (orderIdFromUrl) {
      const initialOrder = orders.find(o => o.id === orderIdFromUrl);
      if (initialOrder) {
        setSelectedCc(initialOrder.ocn);
        setSelectedColor(initialOrder.color);
      }
    }
  }, [orderIdFromUrl, orders]);

  const order = useMemo(() => {
    if (!selectedCc || !selectedColor) return null;
    return orders.find(o => o.ocn === selectedCc && o.color === selectedColor);
  }, [selectedCc, selectedColor, orders]);

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
      result[size] = (frcQty[size] || 0) - (cutOrderQty?.[size] || 0);
    });
    result.total = frcQty.total - (cutOrderQty?.total || 0);
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
  
  const timeBasedQuantities = useMemo(() => {
    const result: { po: SizeBreakdown, fc: SizeBreakdown } = {
        po: { total: 0 },
        fc: { total: 0 }
    };
    SIZES.forEach(s => {
        result.po[s] = 0;
        result.fc[s] = 0;
    });

    if (!order?.fcVsFcDetails || order.fcVsFcDetails.length === 0 || !selectedDate) {
      return result;
    }

    const targetWeek = getWeek(selectedDate);
    const latestSnapshot = [...order.fcVsFcDetails].sort((a,b) => b.snapshotWeek - a.snapshotWeek)[0];

    Object.entries(latestSnapshot.forecasts).forEach(([weekStr, weekData]) => {
      const weekNum = parseInt(weekStr.replace('W', ''));
      if (weekNum <= targetWeek) {
        SIZES.forEach(size => {
          const poQty = weekData[size]?.po || 0;
          const fcQty = weekData[size]?.fc || 0;
          result.po[size] = (result.po[size] || 0) + poQty;
          result.fc[size] = (result.fc[size] || 0) + fcQty;
          result.po.total += poQty;
          result.fc.total += fcQty;
        });
      }
    });

    return result;
  }, [order, selectedDate]);

  const frcGrnQty = useMemo(() => {
    const result: SizeBreakdown = { total: 0 };
    SIZES.forEach(s => result[s] = 0);

    if (!order || !selectedDate) {
      return result;
    }

    const selectedWeek = getWeek(selectedDate);
    const modelString = `${order.style} / ${order.color}`;

    const relevantFrcs = frcData.filter(frc => 
        frc.ccNo === order.ocn && 
        frc.model === modelString &&
        parseInt(frc.ckWeek.replace('W', '')) < selectedWeek
    );

    relevantFrcs.forEach(frc => {
      SIZES.forEach(size => {
        result[size] = (result[size] || 0) + (frc.sizes?.[size] || 0);
      });
      result.total += frc.frcQty || 0;
    });

    return result;
  }, [order, selectedDate, frcData]);

    const frcPending = useMemo(() => {
        if (!frcGrnQty || !timeBasedQuantities) return null;
        const result: SizeBreakdown = { total: 0 };
        SIZES.forEach(size => {
            const frcGrn = frcGrnQty[size] || 0;
            const po = timeBasedQuantities.po[size] || 0;
            const fc = timeBasedQuantities.fc[size] || 0;
            result[size] = frcGrn - (po + fc);
        });
        result.total = frcGrnQty.total - (timeBasedQuantities.po.total + timeBasedQuantities.fc.total);
        return result;
    }, [frcGrnQty, timeBasedQuantities]);


  const excessFrc = useMemo(() => {
    if (!frcQty || !poPlusFcQty) return null;
    const result: SizeBreakdown = { total: 0 };
    SIZES.forEach(size => {
      result[size] = (frcQty[size] || 0) - (poPlusFcQty[size] || 0);
    });
    result.total = frcQty.total - poPlusFcQty.total;
    return result;
  }, [frcQty, poPlusFcQty]);

  const coPendingQty = useMemo(() => {
      const result: SizeBreakdown = SIZES.reduce((acc, s) => ({...acc, [s]: 0}), {total: 0} as SizeBreakdown);
      if (!order || !cutOrderQty || !coSelectedDate) {
          return result;
      }
      const selectedWeek = getWeek(coSelectedDate);
      
      const futurePoQty: SizeBreakdown = SIZES.reduce((acc, s) => ({...acc, [s]: 0}), {total: 0} as SizeBreakdown);

      syntheticPoRecords.forEach(po => {
          if (po.orderId === order.id) {
              const ehdWeek = parseInt(po.originalEhdWeek.replace('W', ''));
              if (ehdWeek > selectedWeek) {
                  SIZES.forEach(size => {
                      futurePoQty[size] = (futurePoQty[size] || 0) + (po.quantities[size] || 0);
                  });
                  futurePoQty.total += po.quantities.total;
              }
          }
      });
      
      SIZES.forEach(size => {
          result[size] = (cutOrderQty[size] || 0) - (futurePoQty[size] || 0);
      });
      result.total = (cutOrderQty.total || 0) - futurePoQty.total;

      return result;

  }, [order, cutOrderQty, coSelectedDate, syntheticPoRecords]);

  const producedQty = useMemo(() => {
    return order?.produced || { total: 0 };
  }, [order]);

  const poLeftToProduce = useMemo(() => {
    if (!poQty || !producedQty) return null;
    const result: SizeBreakdown = { total: 0 };
    SIZES.forEach(size => {
      result[size] = (poQty[size] || 0) - (producedQty[size] || 0);
    });
    result.total = poQty.total - producedQty.total;
    return result;
  }, [poQty, producedQty]);

  const handleCcChange = (cc: string) => {
      setSelectedCc(cc);
      setSelectedColor('');
      router.push('/order-details');
  };
  
  const handleColorChange = (color: string) => {
      setSelectedColor(color);
      const newOrder = orders.find(o => o.ocn === selectedCc && o.color === color);
      if (newOrder) {
          router.push(`/order-details?orderId=${newOrder.id}`);
      }
  };


  if (!isScheduleLoaded) {
    return <div className="text-center p-8">Loading order data...</div>;
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
              <CardTitle>Order Details {order ? `: ${order.ocn} - ${order.color}`: ''}</CardTitle>
              <CardDescription>
                A detailed breakdown of the FRC, PO, and inventory quantities for this order.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-8">
                 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="space-y-2">
                        <Label htmlFor="cc-select">CC No.</Label>
                        <Select value={selectedCc} onValueChange={handleCcChange}>
                            <SelectTrigger id="cc-select">
                                <SelectValue placeholder="Select CC" />
                            </SelectTrigger>
                            <SelectContent>
                                {ccOptions.map(cc => <SelectItem key={cc} value={cc}>{cc}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="color-select">Color</Label>
                        <Select value={selectedColor} onValueChange={handleColorChange} disabled={!selectedCc}>
                            <SelectTrigger id="color-select">
                                <SelectValue placeholder="Select Color" />
                            </SelectTrigger>
                            <SelectContent>
                                {colorOptions.map(color => <SelectItem key={color} value={color}>{color}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>
                </div>
                
                {order ? (
                  <>
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
                            <TableRow className="font-semibold">
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
                            {excessFrc && (
                            <TableRow className="font-semibold">
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

                    <div className="space-y-4 pt-8 border-t">
                        <div className="grid grid-cols-1 md:grid-cols-4 items-end gap-4">
                            <h3 className="text-lg font-semibold md:col-span-3">Time-based Demand</h3>
                             <div className="space-y-2">
                                <Label htmlFor="date-picker">Select Date</Label>
                                <DatePicker date={selectedDate} setDate={setSelectedDate} />
                             </div>
                        </div>
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
                                    <TableCell className="font-medium">PO up to {selectedDate ? `W${getWeek(selectedDate)}` : '...'}</TableCell>
                                    {SIZES.map(size => (
                                        <TableCell key={size} className="text-right">
                                            {(timeBasedQuantities.po[size] || 0).toLocaleString()}
                                        </TableCell>
                                    ))}
                                    <TableCell className="text-right font-bold">
                                        {(timeBasedQuantities.po.total || 0).toLocaleString()}
                                    </TableCell>
                                </TableRow>
                                <TableRow>
                                    <TableCell className="font-medium">FC up to {selectedDate ? `W${getWeek(selectedDate)}` : '...'}</TableCell>
                                    {SIZES.map(size => (
                                        <TableCell key={size} className="text-right">
                                            {(timeBasedQuantities.fc[size] || 0).toLocaleString()}
                                        </TableCell>
                                    ))}
                                    <TableCell className="text-right font-bold">
                                        {(timeBasedQuantities.fc.total || 0).toLocaleString()}
                                    </TableCell>
                                </TableRow>
                                <TableRow>
                                    <TableCell className="font-medium">FRC GRN before {selectedDate ? `W${getWeek(selectedDate)}` : '...'}</TableCell>
                                    {SIZES.map(size => (
                                        <TableCell key={size} className="text-right">
                                            {(frcGrnQty[size] || 0).toLocaleString()}
                                        </TableCell>
                                    ))}
                                    <TableCell className="text-right font-bold">
                                        {(frcGrnQty.total || 0).toLocaleString()}
                                    </TableCell>
                                </TableRow>
                                {frcPending && (
                                    <TableRow className="font-semibold">
                                        <TableCell>FRC Pending</TableCell>
                                        {SIZES.map(size => (
                                            <TableCell key={size} className={cn("text-right", (frcPending[size] || 0) < 0 && 'text-destructive')}>
                                                {(frcPending[size] || 0).toLocaleString()}
                                            </TableCell>
                                        ))}
                                        <TableCell className={cn("text-right font-bold", (frcPending.total || 0) < 0 && 'text-destructive')}>
                                            {(frcPending.total || 0).toLocaleString()}
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>

                    <div className="space-y-4 pt-8 border-t">
                        <div className="grid grid-cols-1 md:grid-cols-4 items-end gap-4">
                            <h3 className="text-lg font-semibold md:col-span-3">Time-based Cut Order & Production</h3>
                             <div className="space-y-2">
                                <Label htmlFor="co-date-picker">Select Date</Label>
                                <DatePicker date={coSelectedDate} setDate={setCoSelectedDate} />
                             </div>
                        </div>
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
                                {cutOrderQty && (
                                    <TableRow>
                                        <TableCell className="font-medium">Cut Order released</TableCell>
                                        {SIZES.map(size => (
                                            <TableCell key={size} className="text-right">
                                                {(cutOrderQty[size] || 0).toLocaleString()}
                                            </TableCell>
                                        ))}
                                        <TableCell className="text-right font-bold">
                                            {(cutOrderQty.total || 0).toLocaleString()}
                                        </TableCell>
                                    </TableRow>
                                )}
                                {coPendingQty && (
                                     <TableRow>
                                        <TableCell className="font-medium">CO pending</TableCell>
                                        {SIZES.map(size => (
                                            <TableCell key={size} className={cn("text-right", (coPendingQty[size] || 0) < 0 && 'text-destructive')}>
                                                {(coPendingQty[size] || 0).toLocaleString()}
                                            </TableCell>
                                        ))}
                                        <TableCell className={cn("text-right font-bold", (coPendingQty.total || 0) < 0 && 'text-destructive')}>
                                            {(coPendingQty.total || 0).toLocaleString()}
                                        </TableCell>
                                    </TableRow>
                                )}
                                <TableRow>
                                    <TableCell className="font-medium">Production</TableCell>
                                    {SIZES.map(size => (
                                        <TableCell key={size} className="text-right">
                                            {(producedQty[size] || 0).toLocaleString()}
                                        </TableCell>
                                    ))}
                                    <TableCell className="text-right font-bold">
                                        {(producedQty.total || 0).toLocaleString()}
                                    </TableCell>
                                </TableRow>
                                {poLeftToProduce && (
                                    <TableRow className="font-semibold">
                                        <TableCell>PO left to produce</TableCell>
                                        {SIZES.map(size => (
                                            <TableCell key={size} className={cn("text-right", (poLeftToProduce[size] || 0) < 0 && 'text-destructive')}>
                                                {(poLeftToProduce[size] || 0).toLocaleString()}
                                            </TableCell>
                                        ))}
                                        <TableCell className={cn("text-right font-bold", (poLeftToProduce.total || 0) < 0 && 'text-destructive')}>
                                            {(poLeftToProduce.total || 0).toLocaleString()}
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                  </>
                ) : (
                    <div className="text-center text-muted-foreground p-8 border rounded-lg">
                        Please select a CC and Color to view order details.
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
