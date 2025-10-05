
'use client';

import { useState } from 'react';
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
import { format } from 'date-fns';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent } from '@/components/ui/card';
import { useAppContext } from '@/context/app-provider';

export default function OrdersPage() {
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const { scheduledProcesses } = useAppContext();


  const handleOrderClick = (order: Order) => {
    setSelectedOrder(order);
  };
  
  const TnaPlan = ({ order, scheduledProcesses }: { order: Order, scheduledProcesses: ScheduledProcess[] }) => {
    if (!order.tna) return null;
    
    const { ckDate } = order.tna;

    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
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
        </div>

        <div className="border rounded-md">
          <Table>
            <TableHeader>
              <TableRow className="bg-transparent hover:bg-transparent">
                <TableHead>Process</TableHead>
                <TableHead>SAM</TableHead>
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
                const scheduledProcess = scheduledProcesses.find(p => p.processId === process.id && p.orderId === order.id);
                
                return (
                  <TableRow key={process.id} className="bg-transparent even:bg-transparent hover:bg-muted/30">
                    <TableCell className="font-medium">{process.name}</TableCell>
                    <TableCell>{process.sam}</TableCell>
                    <TableCell>{process.singleRunOutput}</TableCell>
                    <TableCell>
                        <span className="text-muted-foreground">Not Started</span>
                    </TableCell>
                    <TableCell>{tnaProcess ? format(new Date(tnaProcess.startDate), 'MMM dd') : '-'}</TableCell>
                    <TableCell>{tnaProcess ? format(new Date(tnaProcess.endDate), 'MMM dd') : '-'}</TableCell>
                    <TableCell>{scheduledProcess ? format(scheduledProcess.startDateTime, 'MMM dd, h:mm a') : <span className="text-muted-foreground">Not set</span>}</TableCell>
                    <TableCell>{scheduledProcess ? format(scheduledProcess.endDateTime, 'MMM dd, h:mm a') : <span className="text-muted-foreground">Not set</span>}</TableCell>
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
                    scheduledProcesses={scheduledProcesses.filter(p => p.orderId === selectedOrder.id)}
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
