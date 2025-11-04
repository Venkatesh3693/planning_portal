
'use client';

import { Header } from '@/components/layout/header';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
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
import { useMemo, useState, useEffect, useCallback } from 'react';
import { PrjGenerator } from '@/lib/tna-calculator';
import type { Order, ProjectionRow, Remark } from '@/lib/types';
import { getWeek, format } from 'date-fns';
import { 
  Sheet, 
  SheetContent, 
  SheetHeader, 
  SheetTitle,
  SheetDescription
} from '@/components/ui/sheet';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from '@/components/ui/button';
import { MessageSquare, CornerUpLeft, Trash2, MoreHorizontal, Check, Clock, CheckCircle2, X } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Label } from '@/components/ui/label';
import { FilterPopover, type ProjectionFilters } from '@/components/projection-planning/filter-popover';
import { Badge } from '@/components/ui/badge';


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


export default function ProjectionPlanningPage() {
    const { orders, isScheduleLoaded } = useSchedule();
    const [projectionData, setProjectionData] = useState<ProjectionRow[]>([]);
    const [projectionStatuses, setProjectionStatuses] = useState<Record<string, string>>({});
    const [approvedProjections, setApprovedProjections] = useState<Set<string>>(new Set());
    const [projectionToApprove, setProjectionToApprove] = useState<ProjectionRow | null>(null);

    const [isSheetOpen, setIsSheetOpen] = useState(false);
    
    // States for filtering in the sheet
    const searchParams = useSearchParams();
    const ccNoFromUrl = searchParams.get('ccNo');
    const colorFromUrl = searchParams.get('color');

    const [filterPrj, setFilterPrj] = useState<string | null>(null);

    const [newComment, setNewComment] = useState('');
    const [replyingTo, setReplyingTo] = useState<{ remarkId: string; user: string } | null>(null);
    
    const [filters, setFilters] = useState<ProjectionFilters>({
      ccNos: [],
      models: [],
    });

    useEffect(() => {
      const ccNosFromUrl = searchParams.get('ccNo');
      const modelsFromUrl = searchParams.get('color');
      const newFilters: ProjectionFilters = {
        ccNos: ccNosFromUrl ? ccNosFromUrl.split(',') : [],
        models: modelsFromUrl ? modelsFromUrl.split(',').map(m => decodeURIComponent(m)) : [],
      };
      setFilters(newFilters);
    }, [searchParams]);

    // Dropdown options based on filters
    const ccOptions = useMemo(() => [...new Set(projectionData.map(p => p.ccNo))], [projectionData]);
    const colorOptions = useMemo(() => {
        if (filters.ccNos.length === 0) return [];
        const models = projectionData.filter(p => filters.ccNos.includes(p.ccNo)).map(p => p.model.split(' / ')[1]);
        return [...new Set(models)];
    }, [projectionData, filters.ccNos]);

    const prjOptions = useMemo(() => {
        if (filters.ccNos.length === 0 || filters.models.length === 0) return [];
        return projectionData
            .filter(p => filters.ccNos.includes(p.ccNo) && filters.models.includes(p.model.split(' / ')[1]))
            .map(p => p.prjNumber);
    }, [projectionData, filters.ccNos, filters.models]);

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
    
    const handleConfirmApproval = () => {
        if (!projectionToApprove) return;
        setApprovedProjections(prev => new Set(prev).add(projectionToApprove.prjNumber));
        setProjectionStatuses(prev => ({
            ...prev,
            [projectionToApprove.prjNumber]: 'Planned'
        }));
        setProjectionToApprove(null);
    };

    const handleOpenRemarks = (projection: ProjectionRow) => {
      setFilters({ ccNos: [projection.ccNo], models: [projection.model.split(' / ')[1]] });
      setFilterPrj(projection.prjNumber);
      setIsSheetOpen(true);
      setNewComment('');
      setReplyingTo(null);
    };

    const handleCloseRemarks = () => {
      setIsSheetOpen(false);
      setFilters({ccNos: [], models: []});
      setFilterPrj(null);
    }

    const handleSetReplyingTo = useCallback((remark: Remark) => {
        setReplyingTo({ remarkId: remark.id, user: remark.user });
    }, []);
    
    const handleCcFilterChange = (value: string[]) => {
        setFilters({ ccNos: value, models: [] });
        setFilterPrj(null);
    };
    
    const handleColorFilterChange = (value: string[]) => {
        setFilters(prev => ({...prev, models: value}));
        setFilterPrj(null);
    };


    const filteredProjectionsForSheet = useMemo(() => {
        if (filters.ccNos.length === 0) return [];
        let filtered = projectionData.filter(p => filters.ccNos.includes(p.ccNo));
        if (filters.models.length > 0) {
            filtered = filtered.filter(p => filters.models.includes(p.model.split(' / ')[1]));
        }
        if (filterPrj) {
            filtered = filtered.filter(p => p.prjNumber === filterPrj);
        }
        return filtered;
    }, [projectionData, filters, filterPrj]);

    const filteredProjectionsForTable = useMemo(() => {
        return projectionData.filter(row => {
            const ccMatch = filters.ccNos.length === 0 || filters.ccNos.includes(row.ccNo);
            const modelMatch = filters.models.length === 0 || filters.models.some(m => row.model.includes(m));
            return ccMatch && modelMatch;
        });
    }, [projectionData, filters]);

    const remarksToShow = useMemo(() => {
        return filteredProjectionsForSheet.flatMap(p => p.remarks || []);
    }, [filteredProjectionsForSheet]);


    const handleSaveComment = () => {
        if (!filterPrj || !newComment.trim()) return;

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
        
        setProjectionData(prevData =>
            prevData.map(p => {
                if (p.prjNumber === filterPrj) {
                    let updatedRemarks;
                    if (replyingTo) {
                        updatedRemarks = addReplyRecursively(p.remarks || []);
                    } else {
                        updatedRemarks = [...(p.remarks || []), newRemark];
                        remarksUpdated = true;
                    }
                    if (remarksUpdated) {
                       return { ...p, remarks: updatedRemarks };
                    }
                }
                return p;
            })
        );
        
        setNewComment('');
        setReplyingTo(null);
    };

    const handleDeleteComment = (remarkIdToDelete: string) => {
        const deleteRecursively = (remarks: Remark[]): Remark[] => {
            return remarks
                .filter(remark => remark.id !== remarkIdToDelete)
                .map(remark => {
                    if (remark.replies && remark.replies.length > 0) {
                        return { ...remark, replies: deleteRecursively(remark.replies) };
                    }
                    return remark;
                });
        };

        setProjectionData(prevData => 
            prevData.map(p => {
                if (filteredProjectionsForSheet.some(fp => fp.prjNumber === p.prjNumber)) {
                    const updatedRemarks = deleteRecursively(p.remarks || []);
                    return { ...p, remarks: updatedRemarks };
                }
                return p;
            })
        );
    };


    const STATUS_OPTIONS = ['Planned', 'Unplanned', 'In-housed', 'Delay'];

    const activeFilters = useMemo(() => {
        const active: { type: string, value: string, label: string }[] = [];
        filters.ccNos.forEach(v => active.push({ type: 'ccNo', value: v, label: v }));
        filters.models.forEach(v => active.push({ type: 'model', value: v, label: v }));
        return active;
    }, [filters]);

    const removeFilter = (type: string, value: string) => {
        const newFilters = { ...filters };
        if (type === 'ccNo') {
            newFilters.ccNos = newFilters.ccNos.filter(v => v !== value);
            if (newFilters.ccNos.length === 0) newFilters.models = [];
        } else if (type === 'model') {
            newFilters.models = newFilters.models.filter(v => v !== value);
        }
        setFilters(newFilters);
    };


  return (
    <div className="flex h-screen flex-col">
      <Header />
      <main className="flex-1 p-4 sm:p-6 lg:p-8 flex flex-col">
        <Breadcrumb className="mb-4 flex-shrink-0">
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link href="/orders">Order Management</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>Projection Planning</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
        <div className="space-y-4 flex-1 flex flex-col">
            <div className="flex justify-between items-center flex-shrink-0">
                <div>
                    <h1 className="text-2xl font-bold">Projection Planning</h1>
                    <p className="text-muted-foreground">
                        View and manage your material projections.
                    </p>
                </div>
                 <FilterPopover allProjectionData={projectionData} filters={filters} onFiltersChange={setFilters} />
            </div>

          <Card className="flex-1 flex flex-col">
            <CardContent className="p-0 flex-1 flex flex-col">
              {activeFilters.length > 0 && (
                  <div className="flex flex-wrap items-center gap-2 p-4 border-b">
                    <span className="text-sm font-medium">Active Filters:</span>
                    {activeFilters.map(({type, value, label}) => (
                      <Badge key={`${type}-${value}`} variant="secondary" className="gap-1">
                        {label}
                        <button onClick={() => removeFilter(type, value)} className="rounded-full hover:bg-muted-foreground/20">
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
              )}
              <AlertDialog onOpenChange={(isOpen) => !isOpen && setProjectionToApprove(null)}>
                <div className="overflow-y-auto">
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
                        <TableHead>Approve</TableHead>
                        <TableHead>Kit-Receipt Week</TableHead>
                        <TableHead className="text-center">Remarks</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredProjectionsForTable.length > 0 ? (
                        filteredProjectionsForTable.map((row) => (
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
                            <TableCell>
                                {approvedProjections.has(row.prjNumber) ? (
                                    <div className="flex items-center gap-2 text-green-600 font-semibold">
                                        <CheckCircle2 className="h-5 w-5" />
                                        <span>Approved</span>
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-1">
                                        <AlertDialogTrigger asChild>
                                            <Button variant="ghost" size="icon" className="text-green-600 hover:text-green-700" onClick={() => setProjectionToApprove(row)}>
                                                <Check className="h-5 w-5" />
                                            </Button>
                                        </AlertDialogTrigger>
                                        <Button variant="ghost" size="icon" className="text-amber-600 hover:text-amber-700">
                                            <Clock className="h-5 w-5" />
                                        </Button>
                                    </div>
                                )}
                            </TableCell>
                            <TableCell></TableCell>
                            <TableCell className="text-center">
                              <Button variant="ghost" size="icon" onClick={() => handleOpenRemarks(row)}>
                                <MessageSquare className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                            <TableCell colSpan={11} className="h-24 text-center">
                            No projection data available.
                            </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
                  <AlertDialogContent>
                      <AlertDialogHeader>
                          <AlertDialogTitle>Confirm Approval</AlertDialogTitle>
                          <AlertDialogDescription>
                              Are you sure you want to approve projection {projectionToApprove?.prjNumber}? This will set its status to "Planned".
                          </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={handleConfirmApproval}>
                              Yes, Approve
                          </AlertDialogAction>
                      </AlertDialogFooter>
                  </AlertDialogContent>
              </AlertDialog>
            </CardContent>
          </Card>
        </div>
      </main>

       <Sheet open={isSheetOpen} onOpenChange={(isOpen) => !isOpen && handleCloseRemarks()}>
        <SheetContent className="sm:max-w-xl w-full flex flex-col">
          <SheetHeader>
            <SheetTitle>Remarks</SheetTitle>
            <SheetDescription>
              View and add comments for projections. Use filters to narrow down the remarks.
            </SheetDescription>
          </SheetHeader>
          
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 border-y py-4">
              <div className="space-y-1">
                <Label htmlFor="cc-filter">CC No.</Label>
                <Select value={filters.ccNos[0] || ''} onValueChange={(val) => handleCcFilterChange(val ? [val] : [])}>
                    <SelectTrigger id="cc-filter"><SelectValue placeholder="Select CC" /></SelectTrigger>
                    <SelectContent>
                        {ccOptions.map(cc => <SelectItem key={cc} value={cc}>{cc}</SelectItem>)}
                    </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="color-filter">Color</Label>
                 <Select value={filters.models[0] || ''} onValueChange={(val) => handleColorFilterChange(val ? [val] : [])} disabled={filters.ccNos.length === 0}>
                    <SelectTrigger id="color-filter"><SelectValue placeholder="Select Color" /></SelectTrigger>
                    <SelectContent>
                        {colorOptions.map(color => <SelectItem key={color} value={color}>{color}</SelectItem>)}
                    </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="prj-filter">PRJ #</Label>
                <Select value={filterPrj || ''} onValueChange={(v) => setFilterPrj(v)} disabled={filters.models.length === 0}>
                    <SelectTrigger id="prj-filter"><SelectValue placeholder="Select PRJ" /></SelectTrigger>
                    <SelectContent>
                         {prjOptions.map(prj => <SelectItem key={prj} value={prj}>{prj}</SelectItem>)}
                    </SelectContent>
                </Select>
              </div>
          </div>
          
          <div className="flex-1 space-y-4 overflow-y-auto pr-2 -mr-6 px-6">
              {remarksToShow.length > 0 ? (
                remarksToShow.map((remark) => (
                   <RemarkItem key={remark.id} remark={remark} onReply={handleSetReplyingTo} onDelete={handleDeleteComment} />
                ))
              ) : (
                <p className="text-sm text-muted-foreground text-center pt-8">No remarks yet for this selection.</p>
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
              placeholder={!filterPrj ? "Select a specific PRJ # to add a comment" : (replyingTo ? `Reply to ${replyingTo.user}...` : "Type your comment here...")}
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              disabled={!filterPrj}
            />
            <Button onClick={handleSaveComment} disabled={!newComment.trim() || !filterPrj}>Save Comment</Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
