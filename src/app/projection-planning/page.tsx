

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
import type { Order, ProjectionRow, Remark } from '@/lib/types';
import { getWeek, format } from 'date-fns';
import { 
  Sheet, 
  SheetContent, 
  SheetHeader, 
  SheetTitle,
  SheetDescription,
  SheetFooter
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { MessageSquare } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';


export default function ProjectionPlanningPage() {
    const { orders, isScheduleLoaded } = useSchedule();
    const [projectionData, setProjectionData] = useState<ProjectionRow[]>([]);
    const [projectionStatuses, setProjectionStatuses] = useState<Record<string, string>>({});
    const [selectedProjection, setSelectedProjection] = useState<ProjectionRow | null>(null);
    const [newComment, setNewComment] = useState('');

    useEffect(() => {
        if (!isScheduleLoaded) return;

        const ccGroups = orders.reduce((acc, order) => {
            if (order.orderType === 'Forecasted' && order.ocn) {
                if (!acc[order.ocn]) {
                    acc[order.ocn] = [];
                }
                acc[order.ocn].push(order);
            }
            return acc;
        }, {} as Record<string, Order[]>);

        const allProjections = Object.values(ccGroups).flatMap(ccOrders => PrjGenerator(ccOrders));
        setProjectionData(allProjections);

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

    const handleSaveComment = () => {
      if (!selectedProjection || !newComment.trim()) return;
      const newRemark: Remark = {
        id: crypto.randomUUID(),
        user: 'User', // Mock user
        text: newComment.trim(),
        date: new Date().toISOString(),
      };

      const updatedProjections = projectionData.map(p => {
        if (p.prjNumber === selectedProjection.prjNumber) {
          return { ...p, remarks: [...p.remarks, newRemark] };
        }
        return p;
      });

      setProjectionData(updatedProjections);
      setSelectedProjection(prev => prev ? { ...prev, remarks: [...prev.remarks, newRemark] } : null);
      setNewComment('');
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
                    <TableHead className="text-center">Remarks</TableHead>
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
                        <TableCell className="text-center">
                          <Button variant="ghost" size="icon" onClick={() => setSelectedProjection(row)}>
                            <MessageSquare className="h-4 w-4" />
                          </Button>
                        </TableCell>
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

       <Sheet open={!!selectedProjection} onOpenChange={(isOpen) => !isOpen && setSelectedProjection(null)}>
        <SheetContent className="sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Remarks for {selectedProjection?.prjNumber}</SheetTitle>
            <SheetDescription>
              Add and view comments for this projection.
            </SheetDescription>
          </SheetHeader>
          <div className="py-4 space-y-4 h-full flex flex-col">
            <div className="flex-1 space-y-4 overflow-y-auto pr-2">
              {selectedProjection?.remarks && selectedProjection.remarks.length > 0 ? (
                selectedProjection.remarks.map((remark) => (
                   <div key={remark.id} className="flex items-start gap-3">
                      <Avatar className="h-8 w-8">
                        <AvatarFallback>{remark.user.charAt(0)}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-semibold">{remark.user}</p>
                           <p className="text-xs text-muted-foreground">
                            {format(new Date(remark.date), 'MMM d, h:mm a')}
                          </p>
                        </div>
                        <p className="text-sm bg-muted p-2 rounded-md mt-1">{remark.text}</p>
                      </div>
                   </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground text-center pt-8">No remarks yet.</p>
              )}
            </div>
            <Separator />
            <div className="space-y-2">
              <Textarea
                placeholder="Type your comment here..."
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
              />
              <Button onClick={handleSaveComment} disabled={!newComment.trim()}>Save Comment</Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
