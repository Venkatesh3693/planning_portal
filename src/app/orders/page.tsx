
'use client';

import { useState, useMemo } from 'react';
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
import { ORDERS, PROCESSES } from '@/lib/data';
import type { Order, ScheduledProcess } from '@/lib/types';
import { format, addMinutes } from 'date-fns';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { getScheduledProcesses } from '@/lib/store';

export default function OrdersPage() {
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const allProcesses = PROCESSES;
  const allScheduledProcesses = getScheduledProcesses();

  const handleOrderClick = (order: Order) => {
    setSelectedOrder(order);
  };
  
  const TnaPlan = ({ order, scheduledProcesses }: { order: Order, scheduledProcesses: ScheduledProcess[] }) => {
    if (!order.tna) return null;
    
    const { ckDate } = order.tna;

    return (
      <div className="space-y-4">
        <div className="grid gap-2">
            <div className="flex justify-between items-center text-sm p-2 bg-muted rounded-md">
                <span className="font-medium">Raw Materials In-House (CK Date)</span>
                <Badge variant="secondary">{format(new Date(ckDate), 'MMM dd, yyyy')}</Badge>
            </div>
        </div>

        <div className="border rounded-md">
          <Table>
            <TableHeader>
              <TableRow className="bg-transparent hover:bg-transparent">
                <TableHead>Process</TableHead>
                <TableHead>SAM</TableHead>
                <TableHead>T&A Start</TableHead>
                <TableHead>T&A End</TableHead>
                <TableHead>Scheduled Start</TableHead>
                <TableHead>Scheduled End</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {allProcesses
                .filter(p => order.processIds.includes(p.id))
                .map((process) => {
                const tnaProcess = order.tna?.processes.find(p => p.processId === process.id);
                const scheduledProcess = scheduledProcesses.find(p => p.processId === process.id);
                
                return (
                  <TableRow key={process.id} className="bg-transparent even:bg-transparent hover:bg-muted/30">
                    <TableCell className="font-medium">{process.name}</TableCell>
                    <TableCell>{process.sam}</TableCell>
                    <TableCell>{tnaProcess ? format(new Date(tnaProcess.startDate), 'MMM dd') : '-'}</TableCell>
                    <TableCell>{tnaProcess ? format(new Date(tnaProcess.endDate), 'MMM dd') : '-'}</TableCell>
                    <TableCell>{scheduledProcess ? format(scheduledProcess.startDateTime, 'MMM dd, h:mm a') : <span className="text-muted-foreground">Not set</span>}</TableCell>
                    <TableCell>{scheduledProcess ? format(addMinutes(scheduledProcess.startDateTime, scheduledProcess.durationMinutes), 'MMM dd, h:mm a') : <span className="text-muted-foreground">Not set</span>}</TableCell>
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
                      <TableHead>OCN</TableHead>
                      <TableHead>Buyer</TableHead>
                      <TableHead>Style</TableHead>
                      <TableHead>Color</TableHead>
                      <TableHead className="text-right">Quantity</TableHead>
                      <TableHead>Due Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {ORDERS.map((order) => (
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
                        <TableCell>{order.ocn}</TableCell>
                        <TableCell>{order.buyer}</TableCell>
                        <TableCell>{order.style}</TableCell>
                        <TableCell>{order.color}</TableCell>
                        <TableCell className="text-right">{order.quantity}</TableCell>
                        <TableCell>{format(new Date(order.dueDate), 'PPP')}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            {selectedOrder && (
              <DialogContent className="max-w-4xl">
                <DialogHeader>
                  <DialogTitle>{selectedOrder.ocn} - {selectedOrder.style} ({selectedOrder.color})</DialogTitle>
                  <DialogDescription>
                    Order ID: {selectedOrder.id} &bull; Buyer: {selectedOrder.buyer}
                  </DialogDescription>
                </DialogHeader>
                <div className="py-4">
                  <TnaPlan 
                    order={selectedOrder}
                    scheduledProcesses={allScheduledProcesses.filter(p => p.orderId === selectedOrder.id)}
                  />
                </div>
              </DialogContent>
            )}
          </Dialog>
        </div>
      </main>
    </div>
  );
}
