
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
import { Card, CardContent } from '@/components/ui/card';
import { SIZES } from '@/lib/data';
import { useSchedule } from '@/context/schedule-provider';
import { useMemo, useState, useEffect } from 'react';
import type { FrcRow, Remark } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { MessageSquare, Filter } from 'lucide-react';
import { 
  Sheet, 
  SheetContent, 
  SheetHeader, 
  SheetTitle,
  SheetDescription
} from '@/components/ui/sheet';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CornerUpLeft, MoreHorizontal, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { FilterPopover, type FrcFilters } from '@/components/frc-planning/filter-popover';

const RemarkItem = ({ remark, onReply, onDelete, level = 0 }: { remark: Remark; onReply: (remark: Remark) => void; onDelete: (remarkId: string) => void; level?: number; }) => {
  return (
    <div className={cn("flex items-start gap-3", level > 0 && "ml-6")}>
      <Avatar className="h-8 w-8">
        <AvatarFallback>{remark.user.charAt(0)}</AvatarFallback>
      </Avatar>
      <div className="flex-1 group">
        <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
                <p className="text-sm font-semibold">{remark.user}</p>
                 <p className="text-xs text-muted-foreground">
                    {format(new Date(remark.date), 'MMM d, h:mm a')}
                 </p>
            </div>
          
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100">
                        <MoreHorizontal className="h-4 w-4" />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                    <DropdownMenuItem onClick={() => onDelete(remark.id)} className="text-destructive">
                         <Trash2 className="mr-2 h-4 w-4" />
                         Delete
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>

        </div>
        <p className="text-sm bg-muted p-2 rounded-md mt-1">{remark.text}</p>
        <div className="flex items-center gap-2">
            {level === 0 && (
              <Button variant="ghost" size="sm" className="mt-1 h-auto p-1 text-xs" onClick={() => onReply(remark)}>
                <CornerUpLeft className="mr-1 h-3 w-3" />
                Reply
              </Button>
            )}
        </div>
        {remark.replies && remark.replies.length > 0 && (
          <div className="mt-3 space-y-3 border-l-2 pl-3">
            {remark.replies.map(reply => (
              <RemarkItem key={reply.id} remark={reply} onReply={onReply} onDelete={onDelete} level={level + 1} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};


export default function FrcPlanningPage() {
  const { frcData, isScheduleLoaded } = useSchedule();
  const [remarksSheetOpen, setRemarksSheetOpen] = useState(false);
  const [activeFrcForRemarks, setActiveFrcForRemarks] = useState<FrcRow | null>(null);
  const [newComment, setNewComment] = useState('');
  const [replyingTo, setReplyingTo] = useState<{ remarkId: string; user: string } | null>(null);
  const [filters, setFilters] = useState<FrcFilters>({
    ccNos: [],
    models: [],
    frcWeekRange: { start: null, end: null },
    ckWeekRange: { start: null, end: null },
  });

  const filteredFrcData = useMemo(() => {
    return frcData.filter(row => {
      const ccMatch = filters.ccNos.length === 0 || filters.ccNos.includes(row.ccNo);
      const modelMatch = filters.models.length === 0 || filters.models.includes(row.model);
      
      const frcWeek = parseInt(row.frcWeek.replace('W', ''));
      const frcWeekStartMatch = filters.frcWeekRange.start === null || frcWeek >= filters.frcWeekRange.start;
      const frcWeekEndMatch = filters.frcWeekRange.end === null || frcWeek <= filters.frcWeekRange.end;

      const ckWeek = parseInt(row.ckWeek.replace('W', ''));
      const ckWeekStartMatch = filters.ckWeekRange.start === null || ckWeek >= filters.ckWeekRange.start;
      const ckWeekEndMatch = filters.ckWeekRange.end === null || ckWeek <= filters.ckWeekRange.end;

      return ccMatch && modelMatch && frcWeekStartMatch && frcWeekEndMatch && ckWeekStartMatch && ckWeekEndMatch;
    });
  }, [frcData, filters]);


  const handleOpenRemarks = (frc: FrcRow) => {
    setActiveFrcForRemarks(frc);
    setRemarksSheetOpen(true);
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
              <BreadcrumbPage>FRC Planning</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold">FRC Planning</h1>
                    <p className="text-muted-foreground">
                        View and manage your material FRCs.
                    </p>
                </div>
                <FilterPopover allFrcData={frcData} filters={filters} onFiltersChange={setFilters} />
            </div>

          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>CC no.</TableHead>
                    <TableHead>Model / Color</TableHead>
                    <TableHead>PRJ #</TableHead>
                    <TableHead>FRC #</TableHead>
                    <TableHead>FRC Week</TableHead>
                    <TableHead>CK Week</TableHead>
                    <TableHead>FRC Coverage Weeks</TableHead>
                    {SIZES.map(size => (
                      <TableHead key={size} className="text-right">{size}</TableHead>
                    ))}
                    <TableHead className="text-right">FRC Qty</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Approve</TableHead>
                    <TableHead className="text-center">Remarks</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isScheduleLoaded && filteredFrcData.length > 0 ? (
                    filteredFrcData.map(row => (
                      <TableRow key={row.frcNumber}>
                        <TableCell>{row.ccNo}</TableCell>
                        <TableCell>{row.model}</TableCell>
                        <TableCell>{row.prjNumber}</TableCell>
                        <TableCell>{row.frcNumber}</TableCell>
                        <TableCell>{row.frcWeek}</TableCell>
                        <TableCell>{row.ckWeek}</TableCell>
                        <TableCell>{row.frcCoverage}</TableCell>
                        {SIZES.map(size => (
                          <TableCell key={size} className="text-right">
                            {(row.sizes?.[size] || 0) > 0 ? (row.sizes?.[size] || 0).toLocaleString() : '-'}
                          </TableCell>
                        ))}
                        <TableCell className="text-right font-medium">{row.frcQty.toLocaleString()}</TableCell>
                        <TableCell>{row.status}</TableCell>
                        <TableCell>
                          {/* Approve button to be added */}
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
                      <TableCell colSpan={12 + SIZES.length} className="h-24 text-center">
                        {isScheduleLoaded ? 'No FRC data available for the selected filters.' : 'Loading FRC data...'}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      </main>
      
       <Sheet open={remarksSheetOpen} onOpenChange={setRemarksSheetOpen}>
        <SheetContent className="sm:max-w-xl w-full flex flex-col">
            {activeFrcForRemarks && (
                <>
                    <SheetHeader>
                        <SheetTitle>Remarks for {activeFrcForRemarks.frcNumber}</SheetTitle>
                        <SheetDescription>
                         CC: {activeFrcForRemarks.ccNo} | Model: {activeFrcForRemarks.model}
                        </SheetDescription>
                    </SheetHeader>
                    <div className="flex-1 space-y-4 overflow-y-auto pr-2 -mr-6 px-6 py-4">
                        {(activeFrcForRemarks.remarks || []).length > 0 ? (
                            (activeFrcForRemarks.remarks).map(remark => (
                                <RemarkItem key={remark.id} remark={remark} onReply={() => {}} onDelete={() => {}} />
                            ))
                        ) : (
                            <p className="text-sm text-muted-foreground text-center pt-8">No remarks yet for this FRC.</p>
                        )}
                    </div>
                     <div className="space-y-2 mt-auto pt-4 border-t">
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
                        <Button disabled={!newComment.trim()}>Save Comment</Button>
                    </div>
                </>
            )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
