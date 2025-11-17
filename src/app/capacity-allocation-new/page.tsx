
'use client';

import { useState, useMemo, useCallback } from 'react';
import { useSchedule } from '@/context/schedule-provider';
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
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PlusCircle, Trash2, ChevronRight, Edit, Save, CalendarDays } from 'lucide-react';
import { SEWING_OPERATIONS_BY_STYLE, sewingMachineTypes } from '@/lib/data';
import type { Order, SewingLine, SewingMachineType, SewingLineGroup, MachineRequirement } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import LineReallocationDialog from '@/components/capacity/line-reallocation-dialog';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Calendar } from '@/components/ui/calendar';


const RequirementsTable = ({ requirements, machineTotals }: { requirements: MachineRequirement[], machineTotals: Record<string, number> }) => {
    const allMachineTypes = useMemo(() => {
        const types = new Set([...requirements.map(r => r.machineType), ...Object.keys(machineTotals)]);
        return Array.from(types).sort();
    }, [requirements, machineTotals]);

    if (allMachineTypes.length === 0) {
        return <p className="text-sm text-muted-foreground">Select a CC to view machine requirements.</p>;
    }

    return (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {allMachineTypes.map(type => {
                const req = requirements.find(r => r.machineType === type);
                const required = req?.required || 0;
                const allocated = machineTotals[type] || 0;
                const isMet = allocated >= required;
                
                if (required === 0 && allocated === 0) return null;

                return (
                    <div key={type} className={cn("p-3 rounded-lg border", isMet ? "bg-green-100 dark:bg-green-900/40 border-green-300" : "bg-amber-100 dark:bg-amber-900/40 border-amber-300")}>
                        <div className="text-sm font-medium text-muted-foreground">{type}</div>
                        <div className="flex items-baseline gap-2">
                             <span className="text-xl font-bold">{allocated}</span>
                             <span className="text-sm">/ {required}</span>
                        </div>
                    </div>
                )
            })}
        </div>
    );
};

const UnallocatedLineCard = ({ line, onAllocate, onEdit, activeGroup }: { line: SewingLine, onAllocate: (line: SewingLine) => void, onEdit: (line: SewingLine) => void, activeGroup: SewingLineGroup | undefined }) => {
    const totalMachines = useMemo(() => {
        return Object.values(line.machineCounts).reduce((sum, count) => sum + (count || 0), 0);
    }, [line.machineCounts]);

    return (
        <div className="p-3 rounded-md border">
            <div className="flex items-center justify-between mb-2">
                <div>
                    <p className="font-medium">{line.name}</p>
                    <p className="text-xs text-muted-foreground">{totalMachines} Machines</p>
                </div>
                 <div className="flex items-center gap-1">
                    <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => onEdit(line)}>
                        <Edit className="h-4 w-4" />
                    </Button>
                    {line.id !== 'buffer' && (
                        <Button size="sm" variant="outline" onClick={() => onAllocate(line)} disabled={!activeGroup}>
                            Allocate
                        </Button>
                    )}
                 </div>
            </div>
            <div className="flex flex-wrap gap-1">
                {Object.entries(line.machineCounts)
                    .filter(([, count]) => count && count > 0)
                    .map(([type, count]) => (
                    <Badge key={type} variant="secondary" className="font-normal">{type}: {count}</Badge>
                ))}
            </div>
        </div>
    );
}

export default function CapacityAllocationPage() {
    const { orders, sewingLines, setSewingLines, sewingLineGroups, setSewingLineGroups } = useSchedule();
    const [selectedCc, setSelectedCc] = useState('');
    const [activeGroupId, setActiveGroupId] = useState<string | null>(null);
    const [isCreatingGroup, setIsCreatingGroup] = useState(false);
    const [outputMultiplier, setOutputMultiplier] = useState(1);

    const [lineForReallocation, setLineForReallocation] = useState<SewingLine | null>(null);
    const [holidayDialogOpen, setHolidayDialogOpen] = useState(false);
    const [selectedHolidays, setSelectedHolidays] = useState<Date[] | undefined>(undefined);
    const { toast } = useToast();
    
    const unallocatedLines = useMemo(() => {
        const allocatedLineIds = new Set(sewingLineGroups.flatMap(g => g.allocatedLines));
        return sewingLines.filter(line => !allocatedLineIds.has(line.id));
    }, [sewingLines, sewingLineGroups]);
    
    const bufferLine = useMemo(() => unallocatedLines.find(l => l.id === 'buffer'), [unallocatedLines]);

    const activeGroup = useMemo(() => sewingLineGroups.find(g => g.id === activeGroupId), [sewingLineGroups, activeGroupId]);
    
    const calculateGroupMachineTotals = useCallback((group: SewingLineGroup) => {
        if (!group) return {};
        const totals: Record<string, number> = {};
        const allocatedLineDetails = sewingLines.filter(line => group.allocatedLines.includes(line.id));

        allocatedLineDetails.forEach(line => {
            (Object.keys(line.machineCounts) as SewingMachineType[]).forEach(type => {
                totals[type] = (totals[type] || 0) + (line.machineCounts[type] || 0);
            });
        });
        return totals;
    }, [sewingLines]);

    const activeGroupMachineTotals = useMemo(() => {
        return activeGroup ? calculateGroupMachineTotals(activeGroup) : {};
    }, [activeGroup, calculateGroupMachineTotals]);
    
    const handleMultiplierChange = (groupId: string, newMultiplier: number) => {
        setSewingLineGroups(prevGroups => {
            const groupIndex = prevGroups.findIndex(g => g.id === groupId);
            if (groupIndex === -1) return prevGroups;

            const originalGroup = prevGroups[groupIndex];
            const order = orders.find(o => o.ocn === originalGroup.ccNo);
            if (!order) return prevGroups;

            // Recalculate requirements
            const operations = (SEWING_OPERATIONS_BY_STYLE[order.style] || []).filter(op => sewingMachineTypes.includes(op.machine as any));
            const machineCounts = operations.reduce((acc, op) => {
                acc[op.machine] = (acc[op.machine] || 0) + op.operators;
                return acc;
            }, {} as Record<string, number>);

            const newMachineRequirements: MachineRequirement[] = Object.entries(machineCounts).map(([type, count]) => ({
                machineType: type,
                required: count * newMultiplier,
            }));
            
            const updatedGroup: SewingLineGroup = {
                ...originalGroup,
                outputMultiplier: newMultiplier,
                machineRequirements: newMachineRequirements,
                // De-allocate all lines when multiplier changes
                allocatedLines: [],
            };

            const newGroups = [...prevGroups];
            newGroups[groupIndex] = updatedGroup;
            return newGroups;
        });
    };

    const handleCreateGroup = () => {
        if (!selectedCc) return;
        
        const order = orders.find(o => o.ocn === selectedCc);
        if (!order) return;

        const newGroupName = `SLG-${sewingLineGroups.length + 1}`;

        const operations = (SEWING_OPERATIONS_BY_STYLE[order.style] || []).filter(op => sewingMachineTypes.includes(op.machine as any));
        const machineCounts = operations.reduce((acc, op) => {
            acc[op.machine] = (acc[op.machine] || 0) + op.operators;
            return acc;
        }, {} as Record<string, number>);

        const machineRequirements: MachineRequirement[] = Object.entries(machineCounts).map(([type, count]) => ({
            machineType: type,
            required: count * outputMultiplier,
        }));
        
        const newGroup: SewingLineGroup = {
            id: `lg-${crypto.randomUUID()}`,
            name: newGroupName,
            ccNo: selectedCc,
            allocatedLines: [],
            machineRequirements: machineRequirements,
            outputMultiplier: outputMultiplier,
        };

        setSewingLineGroups([...sewingLineGroups, newGroup]);
        setSelectedCc('');
        setOutputMultiplier(1);
        setActiveGroupId(newGroup.id);
        setIsCreatingGroup(false);
    };

    const handleDeleteGroup = (groupId: string) => {
        const groupToDeallocate = sewingLineGroups.find(g => g.id === groupId);
        if (groupToDeallocate) {
            groupToDeallocate.allocatedLines.forEach(lineId => {
                deallocateLine(lineId, groupId, true); // Deallocate all lines without group context
            });
        }
        setSewingLineGroups(prev => prev.filter(g => g.id !== groupId));
        if (activeGroupId === groupId) {
            setActiveGroupId(null);
        }
    };
    
    const allocateLine = useCallback((line: SewingLine) => {
        if (!activeGroup || !bufferLine) return;

        const currentTotals = calculateGroupMachineTotals(activeGroup);
        const { machineRequirements } = activeGroup;
        
        const machinesToMove: Partial<Record<SewingMachineType, number>> = {};
        const machinesToBuffer: Partial<Record<SewingMachineType, number>> = {};

        (Object.keys(line.machineCounts) as SewingMachineType[]).forEach(type => {
            const requirement = machineRequirements.find(r => r.machineType === type)?.required || 0;
            const currentCount = currentTotals[type] || 0;
            const needed = Math.max(0, requirement - currentCount);
            const availableOnLine = line.machineCounts[type] || 0;

            const moveToGroup = Math.min(needed, availableOnLine);
            const moveToBuffer = availableOnLine - moveToGroup;
            
            if (moveToGroup > 0) machinesToMove[type] = moveToGroup;
            if (moveToBuffer > 0) machinesToBuffer[type] = moveToBuffer;
        });
        
        // This is a simplified model. We are not tracking individual machines, only counts.
        // So we adjust the counts on the original line, the group (implicitly), and the buffer.
        setSewingLines(prevLines => {
            const newLines = JSON.parse(JSON.stringify(prevLines));
            const sourceLine = newLines.find((l: SewingLine) => l.id === line.id);
            const newBufferLine = newLines.find((l: SewingLine) => l.id === 'buffer');

            if(sourceLine && newBufferLine) {
                 // Move excess to buffer
                (Object.keys(machinesToBuffer) as SewingMachineType[]).forEach(type => {
                    sourceLine.machineCounts[type] = (sourceLine.machineCounts[type] || 0) - machinesToBuffer[type]!;
                    newBufferLine.machineCounts[type] = (newBufferLine.machineCounts[type] || 0) + machinesToBuffer[type]!;
                });
            }
            return newLines;
        });
        
        setSewingLineGroups(prevGroups => prevGroups.map(group => {
            if (group.id !== activeGroup.id) return group;
            return { ...group, allocatedLines: [...group.allocatedLines, line.id] };
        }));
    }, [activeGroup, setSewingLineGroups, setSewingLines, calculateGroupMachineTotals, bufferLine]);
    
    const deallocateLine = useCallback((lineId: string, fromGroupId: string, isGroupDelete = false) => {
        const groupToUpdate = sewingLineGroups.find(g => g.id === (isGroupDelete ? fromGroupId : activeGroup?.id));
        if (!groupToUpdate) return;
        
        // This logic simplifies by moving ALL machines back to the original line configuration.
        // A more complex implementation would track partially allocated machines.
        // For now, we assume de-allocation returns the line to its "original" state pre-allocation.
        // Let's just remove the line from the group. The machine counts are implicitly recalculated.
        
        setSewingLineGroups(prevGroups => prevGroups.map(group => {
            if (group.id !== groupToUpdate.id) return group;
            return { ...group, allocatedLines: group.allocatedLines.filter(lId => lId !== lineId) };
        }));

    }, [activeGroup, sewingLineGroups, setSewingLineGroups]);
    
    const ccOptions = useMemo(() => {
        const assignedCcs = new Set(sewingLineGroups.map(g => g.ccNo));
        return orders
            .filter(o => o.orderType === 'Forecasted' && o.ocn && !assignedCcs.has(o.ocn))
            .map(o => o.ocn)
            .filter((value, index, self) => self.indexOf(value) === index);
    }, [orders, sewingLineGroups]);
    
    const handleReallocationSave = (sourceLineId: string, targetLineId: string, machineType: SewingMachineType, quantity: number) => {
        setSewingLines(prevLines => {
            const newLines = JSON.parse(JSON.stringify(prevLines)) as SewingLine[];
            const sourceLine = newLines.find(l => l.id === sourceLineId);
            const targetLine = newLines.find(l => l.id === targetLineId);

            if (sourceLine && targetLine) {
                sourceLine.machineCounts[machineType] = (sourceLine.machineCounts[machineType] || 0) - quantity;
                targetLine.machineCounts[machineType] = (targetLine.machineCounts[machineType] || 0) + quantity;
            }
            return newLines;
        });
        setLineForReallocation(null);
    };

    const handleSaveConfiguration = () => {
        toast({
          title: "Configuration Saved",
          description: "Your sewing line group settings have been saved successfully.",
        });
        setActiveGroupId(null);
    };
    
    const handleOpenHolidayDialog = () => {
        if (!activeGroup) return;
        const currentHolidays = activeGroup.holidays?.map(h => new Date(h)) || [];
        setSelectedHolidays(currentHolidays);
        setHolidayDialogOpen(true);
    };

    const handleSaveHolidays = () => {
        if (!activeGroup || !selectedHolidays) return;
        
        const holidayStrings = selectedHolidays.map(d => d.toISOString().split('T')[0]);

        setSewingLineGroups(prevGroups =>
            prevGroups.map(g => 
                g.id === activeGroup.id ? { ...g, holidays: holidayStrings } : g
            )
        );

        setHolidayDialogOpen(false);
        toast({
            title: "Holidays Updated",
            description: `Holidays for ${activeGroup.name} have been saved.`
        });
    };

    return (
        <div className="flex h-screen flex-col">
            <Header />
            <main className="flex-1 p-4 sm:p-6 lg:p-8 flex flex-col space-y-6">
                <Breadcrumb className="flex-shrink-0">
                    <BreadcrumbList>
                        <BreadcrumbItem>
                            <BreadcrumbLink asChild>
                                <Link href="/orders-new">Order Management</Link>
                            </BreadcrumbLink>
                        </BreadcrumbItem>
                        <BreadcrumbSeparator />
                        <BreadcrumbItem>
                            <BreadcrumbPage>Capacity Allocation</BreadcrumbPage>
                        </BreadcrumbItem>
                    </BreadcrumbList>
                </Breadcrumb>
                 <div className="flex justify-between items-center flex-shrink-0">
                    <div>
                        <h1 className="text-2xl font-bold">Sewing Line Capacity Allocation</h1>
                        <p className="text-muted-foreground">
                            Create line groups, assign CCs, and allocate sewing lines.
                        </p>
                    </div>
                     <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm" onClick={() => setIsCreatingGroup(true)}>
                            <PlusCircle className="mr-2 h-4 w-4" /> Create New Line Group
                        </Button>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1 min-h-0">
                    {/* Left Column: Groups & Unallocated */}
                    <div className="lg:col-span-1 flex flex-col gap-6">
                        {isCreatingGroup && (
                            <Card>
                                <CardHeader>
                                    <CardTitle>Create New Line Group</CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label>Group Name</Label>
                                            <p className="text-lg font-semibold text-muted-foreground p-2 border rounded-md h-10">SLG-{sewingLineGroups.length + 1}</p>
                                        </div>
                                         <div className="space-y-2">
                                            <Label htmlFor="multiplier-select">Output</Label>
                                            <Select value={String(outputMultiplier)} onValueChange={(v) => setOutputMultiplier(Number(v))}>
                                                <SelectTrigger id="multiplier-select">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {[1, 2, 3, 4, 5].map(m => <SelectItem key={m} value={String(m)}>{m}x</SelectItem>)}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="cc-select">Assign CC No.</Label>
                                        <Select value={selectedCc} onValueChange={setSelectedCc}>
                                            <SelectTrigger id="cc-select">
                                                <SelectValue placeholder="Select a CC" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {ccOptions.map(cc => <SelectItem key={cc} value={cc}>{cc}</SelectItem>)}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="flex justify-end gap-2">
                                        <Button variant="ghost" onClick={() => setIsCreatingGroup(false)}>Cancel</Button>
                                        <Button onClick={handleCreateGroup} disabled={!selectedCc}>
                                            Create Group
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>
                        )}
                        <Card className="flex-1 flex flex-col">
                             <CardHeader>
                                <CardTitle>Unallocated Lines</CardTitle>
                             </CardHeader>
                             <CardContent className="flex-1 overflow-y-auto">
                                <div className="space-y-2">
                                    {bufferLine && (
                                        <UnallocatedLineCard 
                                            key={bufferLine.id} 
                                            line={bufferLine} 
                                            onAllocate={() => {}} 
                                            onEdit={setLineForReallocation} 
                                            activeGroup={activeGroup} 
                                        />
                                    )}
                                    {unallocatedLines.filter(l => l.id !== 'buffer').length > 0 ? (
                                        unallocatedLines.filter(l => l.id !== 'buffer').map(line => (
                                            <UnallocatedLineCard key={line.id} line={line} onAllocate={allocateLine} onEdit={setLineForReallocation} activeGroup={activeGroup} />
                                        ))
                                    ) : !bufferLine ? (
                                        <p className="text-sm text-muted-foreground text-center py-8">All sewing lines are allocated.</p>
                                    ) : null}
                                </div>
                             </CardContent>
                        </Card>
                    </div>

                    {/* Right Column: Active Group Details */}
                    <div className="lg:col-span-2 flex flex-col gap-6">
                        <Card>
                            <CardHeader>
                                <CardTitle>Sewing Line Groups</CardTitle>
                                <CardDescription>Select a group to view its details and allocated lines.</CardDescription>
                            </CardHeader>
                            <CardContent>
                                {sewingLineGroups.length > 0 ? (
                                    <div className="space-y-2">
                                        {sewingLineGroups.map(group => {
                                            const groupMachineTotals = calculateGroupMachineTotals(group);
                                            return (
                                                <div key={group.id} className={cn("p-3 rounded-md border flex flex-col cursor-pointer", activeGroupId === group.id && "ring-2 ring-primary border-primary")} onClick={() => setActiveGroupId(group.id)}>
                                                    <div className="flex items-start justify-between">
                                                        <div>
                                                            <p className="font-semibold">{group.name}</p>
                                                            <p className="text-sm text-muted-foreground">CC: {group.ccNo}</p>
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            {group.outputMultiplier && group.outputMultiplier > 1 && (
                                                                <Badge variant="outline">{group.outputMultiplier}x Output</Badge>
                                                            )}
                                                            <Button variant="ghost" size="icon" className="text-destructive h-8 w-8" onClick={(e) => { e.stopPropagation(); handleDeleteGroup(group.id); }}>
                                                                <Trash2 />
                                                            </Button>
                                                            <ChevronRight className={cn("h-5 w-5 text-muted-foreground transition-transform", activeGroupId === group.id && "text-primary")} />
                                                        </div>
                                                    </div>
                                                    <div className="flex flex-wrap gap-1 mt-2">
                                                        {Object.entries(groupMachineTotals).map(([type, count]) => (
                                                            <Badge key={type} variant="secondary" className="font-normal">{type}: {count}</Badge>
                                                        ))}
                                                    </div>
                                                </div>
                                            )
                                        })}
                                    </div>
                                ) : (
                                     <p className="text-sm text-muted-foreground text-center py-8">No line groups created yet.</p>
                                )}
                            </CardContent>
                        </Card>
                        
                        {activeGroup && (
                            <Card className="flex-1 flex flex-col">
                                 <CardHeader className="flex-row items-start justify-between">
                                    <div>
                                        <CardTitle>Details for {activeGroup.name}</CardTitle>
                                        <CardDescription>CC No: {activeGroup.ccNo}</CardDescription>
                                    </div>
                                     <div className="flex items-center gap-2">
                                        <div className="w-24 space-y-1">
                                            <Label htmlFor="active-multiplier-select" className="text-xs">Output</Label>
                                            <Select 
                                                value={String(activeGroup.outputMultiplier || 1)} 
                                                onValueChange={(v) => handleMultiplierChange(activeGroup.id, Number(v))}
                                            >
                                                <SelectTrigger id="active-multiplier-select" className="h-8">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {[1, 2, 3, 4, 5].map(m => <SelectItem key={m} value={String(m)}>{m}x</SelectItem>)}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                         <Button variant="outline" size="sm" onClick={handleOpenHolidayDialog}>
                                            <CalendarDays className="mr-2 h-4 w-4" /> Manage Holidays
                                        </Button>
                                        <Button size="sm" onClick={handleSaveConfiguration}>
                                            <Save className="mr-2 h-4 w-4" /> Save Configuration
                                        </Button>
                                    </div>
                                 </CardHeader>
                                 <CardContent className="flex-1 flex flex-col gap-6">
                                    <div>
                                        <h3 className="font-semibold mb-2">Machine Requirements vs. Allocated</h3>
                                        <RequirementsTable requirements={activeGroup.machineRequirements} machineTotals={activeGroupMachineTotals} />
                                    </div>
                                    <div className="flex-1 flex flex-col">
                                        <h3 className="font-semibold mb-2">Allocated Lines</h3>
                                        <div className="flex-1 overflow-y-auto space-y-2 border p-2 rounded-md bg-muted/30">
                                            {activeGroup.allocatedLines.length > 0 ? (
                                                activeGroup.allocatedLines.map(lineId => {
                                                    const line = sewingLines.find(l => l.id === lineId);
                                                    if (!line) return null;
                                                    
                                                    const totalMachines = Object.values(line.machineCounts).reduce((s, c) => s + (c || 0), 0);

                                                    return (
                                                        <div key={lineId} className="p-3 rounded-md border bg-background flex items-start justify-between">
                                                            <div>
                                                                <p className="font-medium">{line.name}</p>
                                                                <p className="text-xs text-muted-foreground">{totalMachines} Machines</p>
                                                                <div className="flex flex-wrap gap-1 mt-2">
                                                                    {Object.entries(line.machineCounts).map(([type, count]) => (
                                                                        <Badge key={type} variant="secondary" className="font-normal">{type}: {count}</Badge>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                            <Button size="sm" variant="destructive" onClick={() => deallocateLine(lineId, activeGroup.id)}>
                                                                Deallocate
                                                            </Button>
                                                        </div>
                                                    )
                                                })
                                            ) : (
                                                <p className="text-sm text-muted-foreground text-center py-8">No lines allocated to this group yet.</p>
                                            )}
                                        </div>
                                    </div>
                                 </CardContent>
                            </Card>
                        )}
                    </div>
                </div>
            </main>
            {lineForReallocation && (
                <LineReallocationDialog
                    targetLine={lineForReallocation}
                    allLines={sewingLines}
                    isOpen={!!lineForReallocation}
                    onOpenChange={(isOpen) => !isOpen && setLineForReallocation(null)}
                    onSave={handleReallocationSave}
                />
            )}
            {activeGroup && (
                 <Dialog open={holidayDialogOpen} onOpenChange={setHolidayDialogOpen}>
                    <DialogContent className="sm:max-w-md">
                        <DialogHeader>
                            <DialogTitle>Manage Holidays for {activeGroup.name}</DialogTitle>
                            <DialogDescription>
                                Select the dates that this sewing line group will be on holiday.
                            </DialogDescription>
                        </DialogHeader>
                        <div className="flex justify-center py-4">
                           <Calendar
                                mode="multiple"
                                selected={selectedHolidays}
                                onSelect={setSelectedHolidays}
                            />
                        </div>
                        <DialogFooter>
                            <Button type="button" variant="secondary" onClick={() => setHolidayDialogOpen(false)}>
                                Cancel
                            </Button>
                             <Button type="button" onClick={handleSaveHolidays}>
                                Confirm
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            )}
        </div>
    );
}
