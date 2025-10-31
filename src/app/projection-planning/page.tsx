

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
import { useMemo, useState, useEffect, useCallback }from 'react';
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
import { MessageSquare, CornerUpLeft } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';


const RemarkItem = ({ remark, onReply, level = 0 }: { remark: Remark; onReply: (remarkId: string) => void; level?: number; }) => {
  return (
    <div className={cn("flex items-start gap-3", level > 0 && "ml-6")}>
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
        <Button variant="ghost" size="sm" className="mt-1 h-auto p-1 text-xs" onClick={() => onReply(remark.id)}>
          <CornerUpLeft className="mr-1 h-3 w-3" />
          Reply
        </Button>
        {remark.replies && remark.replies.length > 0 && (
          <div className="mt-3 space-y-3 border-l-2 pl-3">
            {remark.replies.map(reply => (
              <RemarkItem key={reply.id} remark={reply} onReply={onReply} level={level + 1} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};


export default function ProjectionPlanningPage() {
    const { orders, isScheduleLoaded } = useSchedule();
    const [projectionData, setProjectionData] = useState<ProjectionRow[]>([]);
    const [projectionStatuses, setProjectionStatuses] = useState<Record<string, string>>({});
    const [selectedProjection, setSelectedProjection] = useState<ProjectionRow | null>(null);
    const [newComment, setNewComment] = useState('');
    const [replyingTo, setReplyingTo] = useState<{ remarkId: string; user: string } | null>(null);


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

    const handleOpenRemarks = (projection: ProjectionRow) => {
      setSelectedProjection(projection);
      setNewComment('');
      setReplyingTo(null);
    };

    const handleCloseRemarks = () => {
      setSelectedProjection(null);
    }

    const handleSetReplyingTo = useCallback((remark: Remark) => {
        setReplyingTo({ remarkId: remark.id, user: remark.user });
    }, []);

    const handleSaveComment = () => {
        if (!selectedProjection || !newComment.trim()) return;

        const newRemark: Remark = {
            id: crypto.randomUUID(),
            user: 'User', // Mock user
            text: newComment.trim(),
            date: new Date().toISOString(),
            replies: [],
        };
        
        let remarksUpdated = false;

        const addReplyRecursively = (remarks: Remark[]): Remark[] => {
            return remarks.map(remark => {
                if (remark.id === replyingTo?.remarkId) {
                    remarksUpdated = true;
                    return { ...remark, replies: [...(remark.replies || []), newRemark] };
                }
                if (remark.replies && remark.replies.length > 0) {
                    return { ...remark, replies: addReplyRecursively(remark.replies) };
                }
                return remark;
            });
        };

        let updatedRemarks;
        if (replyingTo) {
            updatedRemarks = addReplyRecursively(selectedProjection.remarks);
        } else {
            updatedRemarks = [...selectedProjection.remarks, newRemark];
            remarksUpdated = true;
        }
        
        if (remarksUpdated) {
            const updatedProjection = { ...selectedProjection, remarks: updatedRemarks };
            setProjectionData(prevData =>
                prevData.map(p => (p.prjNumber === selectedProjection.prjNumber ? updatedProjection : p))
            );
            setSelectedProjection(updatedProjection);
        }
        
        setNewComment('');
        setReplyingTo(null);
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
                                onValueChange={(newStatus) => setProjectionStatuses(prev => ({...prev, [row.prjNumber]: newStatus}))}
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
                          <Button variant="ghost" size="icon" onClick={() => handleOpenRemarks(row)}>
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

       <Sheet open={!!selectedProjection} onOpenChange={(isOpen) => !isOpen && handleCloseRemarks()}>
        <SheetContent className="sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Remarks for {selectedProjection?.prjNumber}</SheetTitle>
            <SheetDescription>
              Add and view comments for this projection.
            </SheetDescription>
          </SheetHeader>
          <div className="py-4 space-y-4 h-[calc(100%-8rem)] flex flex-col">
            <div className="flex-1 space-y-4 overflow-y-auto pr-2">
              {selectedProjection?.remarks && selectedProjection.remarks.length > 0 ? (
                selectedProjection.remarks.map((remark) => (
                   <RemarkItem key={remark.id} remark={remark} onReply={() => handleSetReplyingTo(remark)} />
                ))
              ) : (
                <p className="text-sm text-muted-foreground text-center pt-8">No remarks yet.</p>
              )}
            </div>
            <Separator />
            <div className="space-y-2">
                {replyingTo && (
                    <div className="text-xs text-muted-foreground p-2 bg-muted rounded-md flex justify-between items-center">
                       <span>Replying to {replyingTo.user}</span>
                       <Button variant="ghost" size="sm" className="h-auto p-0 text-xs" onClick={() => setReplyingTo(null)}>Cancel</Button>
                    </div>
                )}
              <Textarea
                placeholder={replyingTo ? `Reply to ${replyingTo.user}...` : "Type your comment here..."}
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
