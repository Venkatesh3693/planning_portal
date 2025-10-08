
'use client';

import { useState, useMemo, useEffect } from 'react';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Header } from '@/components/layout/header';
import Link from 'next/link';
import { PROCESSES, ORDERS as staticOrders, ORDER_COLORS, WORK_DAY_MINUTES } from '@/lib/data';
import type { Order, Process, ScheduledProcess, RampUpEntry } from '@/lib/types';
import { format, isAfter, isBefore, startOfDay } from 'date-fns';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent } from '@/components/ui/card';
import ColorPicker from '@/components/orders/color-picker';
import { cn } from '@/lib/utils';
import { useSchedule } from '@/context/schedule-provider';
import { Button } from '@/components/ui/button';
import RampUpDialog from '@/components/orders/ramp-up-dialog';
import { Badge } from '@/components/ui/badge';
import { LineChart } from 'lucide-react';
import { Input } from '@/components/ui/input';

const SEWING_PROCESS_ID = 'sewing';

const calculateMinDays = (order: Order, sewingSam: number, rampUpScheme: RampUpEntry[]) => {
  if (!order.quantity || !sewingSam) return 0;
  
  let remainingQty = order.quantity;
  let days = 0;
  let dayIndex = 0;

  while (remainingQty > 0) {
    days++;
    const efficiency = rampUpScheme[dayIndex]?.efficiency ?? rampUpScheme[rampUpScheme.length - 1]?.efficiency;
    if (!efficiency) {
      return Infinity; // Avoid infinite loops if efficiency is 0 or undefined
    }

    const effectiveSam = sewingSam / (efficiency / 100);
    const dailyOutput = WORK_DAY_MINUTES / effectiveSam;
    remainingQty -= dailyOutput;

    if (dayIndex < rampUpScheme.length -1) {
      dayIndex++;
    }
  }
  return days;
};

type RampUpDialogState = {
  order: Order;
  minDays: number;
};

export default function OrdersPage() {
  const { scheduledProcesses, sewingRampUpSchemes, updateSewingRampUpScheme, isScheduleLoaded, sewingLines, setSewingLines } = useSchedule();
  const [orders, setOrders] = useState<Order[]>(staticOrders);
  
  useEffect(() => {
    // Merge locally stored ramp-up schemes into the orders state
    if (isScheduleLoaded) {
      const colorMapRaw = localStorage.getItem('stitchplan_order_colors');
      const colorMap = colorMapRaw ? JSON.parse(colorMapRaw) : {};

      setOrders(currentOrders => 
        currentOrders.map((o, index) => ({ 
          ...o,
          sewingRampUpScheme: sewingRampUpSchemes[o.id],
          displayColor: colorMap[o.id] || ORDER_COLORS[index % ORDER_COLORS.length]
        }))
      );
    }
  }, [sewingRampUpSchemes, isScheduleLoaded]);

  
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [rampUpState, setRampUpState] = useState<RampUpDialogState | null>(null);

  const handleOrderClick = (order: Order) => {
    setSelectedOrder(order);
  };
  
  const handleColorChange = (orderId: string, newColor: string) => {
    const newOrders = orders.map(o => 
        o.id === orderId ? { ...o, displayColor: newColor } : o
    );
    setOrders(newOrders);
    
    const colorMapRaw = localStorage.getItem('stitchplan_order_colors');
    const colorMap = colorMapRaw ? JSON.parse(colorMapRaw) : {};
    colorMap[orderId] = newColor;
    localStorage.setItem('stitchplan_order_colors', JSON.stringify(colorMap));
  };
  
  const handleRampUpSave = (orderId: string, scheme: RampUpEntry[]) => {
    updateSewingRampUpScheme(orderId, scheme);
    setRampUpState(null);
  };

  const getEhdForOrder = (orderId: string) => {
    const packingProcesses = scheduledProcesses.filter(
      (p) => p.orderId === orderId && p.processId === 'packing'
    );

    if (packingProcesses.length === 0) {
      return null;
    }

    const latestEndDate = packingProcesses.reduce((latest, current) => {
      return isAfter(current.endDateTime, latest) ? current.endDateTime : latest;
    }, packingProcesses[0].endDateTime);

    return latestEndDate;
  };

  const TnaPlan = ({ order }: { order: Order }) => {
    if (!order.tna) return null;
    
    const { ckDate } = order.tna;
    
    const calculateProcessBatchSize = (order: Order): number => {
        if (!order.tna) return 0;
    
        const sewingProcess = PROCESSES.find(p => p.id === 'sewing');
        if (!sewingProcess) return 0;
    
        const samSewing = sewingProcess.sam;
        
        let maxSetupRatio = 0;
        let maxSingleRunOutput = 0;
    
        order.processIds.forEach(pid => {
            const process = PROCESSES.find(p => p.id === pid);
            const tnaProcess = order.tna?.processes.find(tp => tp.processId === pid);
    
            if (process && tnaProcess) {
                const samDiff = samSewing - process.sam;
                if (samDiff > 0) {
                    const ratio = tnaProcess.setupTime / samDiff;
                    if (ratio > maxSetupRatio) {
                        maxSetupRatio = ratio;
                    }
                }
    
                if (process.singleRunOutput > maxSingleRunOutput) {
                    maxSingleRunOutput = process.singleRunOutput;
                }
            }
        });
    
        return Math.ceil(Math.max(maxSetupRatio, maxSingleRunOutput));
    };
    
    const processBatchSize = calculateProcessBatchSize(order);

    const getAggregatedScheduledTimes = (processId: string) => {
        const relevantProcesses = scheduledProcesses.filter(p => p.orderId === order.id && p.processId === processId);
        if (relevantProcesses.length === 0) {
            return { start: null, end: null };
        }

        let earliestStart = relevantProcesses[0].startDateTime;
        let latestEnd = relevantProcesses[0].endDateTime;

        for (let i = 1; i < relevantProcesses.length; i++) {
            if (isBefore(relevantProcesses[i].startDateTime, earliestStart)) {
                earliestStart = relevantProcesses[i].startDateTime;
            }
            if (isAfter(relevantProcesses[i].endDateTime, latestEnd)) {
                latestEnd = relevantProcesses[i].endDateTime;
            }
        }
        return { start: earliestStart, end: latestEnd };
    };

    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-5 gap-4 text-sm">
            <div className="p-3 bg-muted rounded-md">
                <div className="font-medium text-muted-foreground">CK Date</div>
                <div className="font-semibold text-lg">{format(new Date(ckDate), 'MMM dd, yyyy')}</div>
            </div>
            <div className="p-3 bg-muted rounded-md">
                <div className="font-medium text-muted-foreground">Shipment Date</div>
                <div className="font-semibold text-lg">{format(new Date(order.dueDate), 'MMM dd, yyyy')}</div>
            </div>
            <div className="p-3 bg-muted rounded-md">
                <div className="font-medium text-muted-foreground">Order Quantity</div>
                <div className="font-semibold text-lg">{order.quantity.toLocaleString()} units</div>
            </div>
            <div className="p-3 bg-muted rounded-md">
                <div className="font-medium text-muted-foreground">Budgeted Efficiency</div>
                <div className="font-semibold text-lg">{order.budgetedEfficiency || 'N/A'}%</div>
            </div>
            <div className="p-3 bg-primary/10 rounded-md ring-1 ring-primary/20">
                <div className="font-medium text-primary/80">Process Batch Size</div>
                <div className="font-semibold text-lg text-primary">{processBatchSize.toLocaleString()} units</div>
            </div>
        </div>

        <div className="border rounded-md">
          <Table>
            <TableHeader>
              <TableRow className="bg-transparent hover:bg-transparent">
                <TableHead>Process</TableHead>
                <TableHead>SAM</TableHead>
                <TableHead>Setup Time</TableHead>
                <TableHead>Single Run Output</TableHead>
                <TableHead>Produced Qty</TableHead>
                <TableHead>T&A Start</TableHead>
                <TableHead>T&A End</TableHead>
                <TableHead>Scheduled Start</TableHead>
                <TableHead>Scheduled End</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {PROCESSES
                .filter(p => order.processIds.includes(p.id))
                .map((process) => {
                const tnaProcess = order.tna?.processes.find(p => p.processId === process.id);
                const { start, end } = getAggregatedScheduledTimes(process.id);
                
                return (
                  <TableRow key={process.id} className="bg-transparent even:bg-transparent hover:bg-muted/30">
                    <TableCell className="font-medium">{process.name}</TableCell>
                    <TableCell>{process.sam}</TableCell>
                    <TableCell>{tnaProcess ? `${tnaProcess.setupTime} min` : '-'}</TableCell>
                    <TableCell>{process.singleRunOutput}</TableCell>
                    <TableCell>
                        <span className="text-muted-foreground">Not Started</span>
                    </TableCell>
                    <TableCell>{tnaProcess ? format(new Date(tnaProcess.startDate), 'MMM dd') : '-'}</TableCell>
                    <TableCell>{tnaProcess ? format(new Date(tnaProcess.endDate), 'MMM dd') : '-'}</TableCell>
                    <TableCell>{start ? format(start, 'MMM dd, h:mm a') : <span className="text-muted-foreground">Not set</span>}</TableCell>
                    <TableCell>{end ? format(end, 'MMM dd, h:mm a') : <span className="text-muted-foreground">Not set</span>}</TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      </div>
    );
  };


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
              <BreadcrumbPage>Order Management</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
        <div className="space-y-4">
          <h1 className="text-2xl font-bold">Order Management</h1>
          <p className="text-muted-foreground">
            View all your orders in one place. Click on an Order ID to see details.
          </p>
          <Dialog onOpenChange={(isOpen) => !isOpen && setSelectedOrder(null)}>
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Order ID</TableHead>
                      <TableHead>Buyer</TableHead>
                      <TableHead>Order Type</TableHead>
                      <TableHead>Ramp-up</TableHead>
                      <TableHead>No. of Lines</TableHead>
                      <TableHead>Min. Sewing Days</TableHead>
                      <TableHead>Display Color</TableHead>
                      <TableHead className="text-right">Quantity</TableHead>
                      <TableHead>Lead Time</TableHead>
                      <TableHead>Due Date</TableHead>
                      <TableHead>EHD</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {orders.map((order) => {
                      const ehd = getEhdForOrder(order.id);
                      const isLate = ehd && isAfter(startOfDay(ehd), startOfDay(new Date(order.dueDate)));
                      
                      const sewingProcess = PROCESSES.find(p => p.id === SEWING_PROCESS_ID);
                      const rampUpScheme = order.sewingRampUpScheme || [{ day: 1, efficiency: order.budgetedEfficiency || 100 }];
                      const singleLineMinDays = sewingProcess ? calculateMinDays(order, sewingProcess.sam, rampUpScheme) : 0;
                      
                      const numLines = sewingLines[order.id] || 1;
                      const minDays = singleLineMinDays / numLines;

                      return (
                        <TableRow key={order.id}>
                          <TableCell>
                            <DialogTrigger asChild>
                              <span 
                                className="font-medium text-primary cursor-pointer hover:underline"
                                onClick={() => handleOrderClick(order)}
                              >
                                {order.id}
                              </span>
                            </DialogTrigger>
                          </TableCell>
                          <TableCell>{order.buyer}</TableCell>
                          <TableCell>Firm PO</TableCell>
                          <TableCell>
                              <Button variant="outline" size="sm" onClick={() => setRampUpState({ order, minDays: singleLineMinDays })}>
                                <LineChart className="h-4 w-4 mr-2" />
                                Scheme
                              </Button>
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              min="1"
                              value={numLines}
                              onChange={(e) => setSewingLines(order.id, parseInt(e.target.value, 10) || 1)}
                              className="w-16 h-8 text-center"
                            />
                          </TableCell>
                          <TableCell>
                            {minDays > 0 && minDays !== Infinity ? (
                              <Badge variant="secondary" title="Minimum days to complete sewing">
                                {Math.ceil(minDays)} days
                              </Badge>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <ColorPicker 
                              color={order.displayColor}
                              onColorChange={(newColor) => handleColorChange(order.id, newColor)}
                            />
                          </TableCell>
                          <TableCell className="text-right">{order.quantity}</TableCell>
                          <TableCell>{order.leadTime ? `${order.leadTime} days` : '-'}</TableCell>
                          <TableCell>{format(new Date(order.dueDate), 'PPP')}</TableCell>
                          <TableCell className={cn(isLate && "text-destructive font-semibold")}>
                            {ehd ? (
                              format(ehd, 'PPP')
                            ) : (
                              <span className="text-muted-foreground">Not Packed</span>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            {selectedOrder && (
              <DialogContent className="max-w-6xl">
                <DialogHeader>
                  <DialogTitle>{selectedOrder.ocn} - {selectedOrder.style} ({selectedOrder.color})</DialogTitle>
                  <DialogDescription>
                    Order ID: {selectedOrder.id} &bull; Buyer: {selectedOrder.buyer}
                  </DialogDescription>
                </DialogHeader>
                <div className="py-4">
                  <TnaPlan 
                    order={selectedOrder}
                  />
                </div>
              </DialogContent>
            )}
          </Dialog>

          {rampUpState && (
            <RampUpDialog
              key={rampUpState.order.id} // Re-mount component when order changes
              order={rampUpState.order}
              totalProductionDays={rampUpState.minDays}
              isOpen={!!rampUpState}
              onOpenChange={(isOpen) => !isOpen && setRampUpState(null)}
              onSave={handleRampUpSave}
            />
          )}

        </div>
      </main>
    </div>
  );
}


    
