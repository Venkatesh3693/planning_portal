
'use client';

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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from '@/components/ui/card';
import { useSchedule } from '@/context/schedule-provider';
import { useMemo, useState, useEffect }from 'react';
import { PrjGenerator } from '@/lib/tna-calculator';
import type { Order, ProjectionRow } from '@/lib/types';
import { getWeek } from 'date-fns';


export default function ProjectionPlanningPage() {
    const { orders, isScheduleLoaded } = useSchedule();
    const [projectionStatuses, setProjectionStatuses] = useState<Record<string, string>>({});

    const projectionData = useMemo(() => {
        if (!isScheduleLoaded) return [];

        const ccGroups = orders.reduce((acc, order) => {
            if (order.orderType === 'Forecasted' && order.ocn) {
                if (!acc[order.ocn]) {
                    acc[order.ocn] = [];
                }
                acc[order.ocn].push(order);
            }
            return acc;
        }, {} as Record<string, Order[]>);

        return Object.values(ccGroups).flatMap(ccOrders => PrjGenerator(ccOrders));

    }, [orders, isScheduleLoaded]);

    useEffect(() => {
        if (projectionData.length > 0) {
            const currentWeek = getWeek(new Date());
            const initialStatuses: Record<string, string> = {};
            projectionData.forEach(p => {
                const prjWeekNum = parseInt(p.prjWeek.replace('W', ''));
                const ckWeekNum = parseInt(p.ckWeek.replace('W', ''));

                if (currentWeek < prjWeekNum) {
                    initialStatuses[p.prjNumber] = 'Planned';
                } else if (currentWeek >= prjWeekNum && currentWeek <= ckWeekNum) {
                    initialStatuses[p.prjNumber] = 'Unplanned';
                } else if (currentWeek > ckWeekNum && currentWeek <= ckWeekNum + 2) {
                     initialStatuses[p.prjNumber] = 'In-housed';
                } else {
                     initialStatuses[p.prjNumber] = 'Delay';
                }
            });
            setProjectionStatuses(initialStatuses);
        }
    }, [projectionData]);


    const handleStatusChange = (prjNumber: string, newStatus: string) => {
        setProjectionStatuses(prev => ({
            ...prev,
            [prjNumber]: newStatus,
        }));
    };

    const STATUS_OPTIONS = ['Planned', 'Unplanned', 'In-housed', 'Delay'];

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
              <BreadcrumbPage>Projection Planning</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
        <div className="space-y-4">
          <h1 className="text-2xl font-bold">Projection Planning</h1>
          <p className="text-muted-foreground">
            View and manage your material projections.
          </p>

          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>CC no.</TableHead>
                    <TableHead>Model / Color</TableHead>
                    <TableHead>PRJ #</TableHead>
                    <TableHead>PRJ Week</TableHead>
                    <TableHead>CK week</TableHead>
                    <TableHead>PRJ Coverage weeks</TableHead>
                    <TableHead className="text-right">PRJ Qty</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Remarks</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {projectionData.length > 0 ? (
                    projectionData.map((row) => (
                      <TableRow key={row.prjNumber}>
                        <TableCell>{row.ccNo}</TableCell>
                        <TableCell>{row.model}</TableCell>
                        <TableCell>{row.prjNumber}</TableCell>
                        <TableCell>{row.prjWeek}</TableCell>
                        <TableCell>{row.ckWeek}</TableCell>
                        <TableCell>{row.prjCoverage}</TableCell>
                        <TableCell className="text-right font-medium">{row.prjQty.toLocaleString()}</TableCell>
                        <TableCell>
                           <Select
                                value={projectionStatuses[row.prjNumber] || ''}
                                onValueChange={(newStatus) => handleStatusChange(row.prjNumber, newStatus)}
                            >
                                <SelectTrigger className="w-[120px]">
                                    <SelectValue placeholder="Select Status" />
                                </SelectTrigger>
                                <SelectContent>
                                    {STATUS_OPTIONS.map(option => (
                                        <SelectItem key={option} value={option}>
                                            {option}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </TableCell>
                        <TableCell>{row.remarks}</TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                        <TableCell colSpan={9} className="h-24 text-center">
                        No projection data available.
                        </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
