
'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
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
import { PlusCircle, Trash2, ChevronRight } from 'lucide-react';
import { MACHINES, SEWING_OPERATIONS_BY_STYLE, MACHINE_NAME_ABBREVIATIONS } from '@/lib/data';
import type { Order, SewingLine, SewingMachine, SewingLineGroup, MachineRequirement } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';


const RequirementsTable = ({ requirements }: { requirements: MachineRequirement[] }) => {
    if (requirements.length === 0) {
        return <p className="text-sm text-muted-foreground">Select a CC to view machine requirements.</p>;
    }

    return (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {requirements.map(req => {
                const isMet = req.allocated >= req.required;
                return (
                    <div key={req.machineType} className={cn("p-3 rounded-lg border", isMet ? "bg-green-100 dark:bg-green-900/40 border-green-300" : "bg-amber-100 dark:bg-amber-900/40 border-amber-300")}>
                        <div className="text-sm font-medium text-muted-foreground">{req.machineType}</div>
                        <div className="flex items-baseline gap-2">
                             <span className="text-xl font-bold">{req.allocated}</span>
                             <span className="text-sm">/ {req.required}</span>
                        </div>
                    </div>
                )
            })}
        </div>
    );
};

const UnallocatedLineCard = ({ line, onAllocate, activeGroup }: { line: SewingLine, onAllocate: (line: SewingLine) => void, activeGroup: SewingLineGroup | undefined }) => {
    const machineCounts = useMemo(() => {
        return line.machines.reduce((acc, machine) => {
            const machineType = MACHINE_NAME_ABBREVIATIONS[machine.name] || machine.name;
            acc[machineType] = (acc[machineType] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);
    }, [line.machines]);

    return (
        <div className="p-3 rounded-md border">
            <div className="flex items-center justify-between mb-2">
                <div>
                    <p className="font-medium">{line.name}</p>
                    <p className="text-xs text-muted-foreground">{line.machines.length} Machines</p>
                </div>
                 <Button size="sm" variant="outline" onClick={() => onAllocate(line)} disabled={!activeGroup}>
                    Allocate
                </Button>
            </div>
            <div className="flex flex-wrap gap-1">
                {Object.entries(machineCounts).map(([type, count]) => (
                    <Badge key={type} variant="secondary" className="font-normal">{type}: {count}</Badge>
                ))}
            </div>
        </div>
    );
}

export default function CapacityAllocationPage() {
    const { orders } = useSchedule();
    const [lineGroups, setLineGroups] = useState<SewingLineGroup[]>([]);
    const [selectedCc, setSelectedCc] = useState('');
    const [activeGroupId, setActiveGroupId] = useState<string | null>(null);

    const allSewingMachines: SewingMachine[] = useMemo(() => {
        return MACHINES.filter(m => m.processIds.includes('sewing')).map((m, index) => {
            const lineName = `L${Math.floor(index / 25) + 1}`;
            return {
                ...m,
                lineId: lineName,
            } as SewingMachine
        });
    }, []);

    const sewingLines = useMemo(() => {
        const lines: Record<string, SewingLine> = {};
        allSewingMachines.forEach(machine => {
            if (!lines[machine.lineId]) {
                lines[machine.lineId] = {
                    id: machine.lineId,
                    name: machine.lineId,
                    machines: []
                };
            }
            lines[machine.lineId].machines.push(machine);
        });
        return Object.values(lines);
    }, [allSewingMachines]);
    
    const unallocatedLines = useMemo(() => {
        const allocatedLineIds = new Set(lineGroups.flatMap(g => g.allocatedLines.map(l => l.lineId)));
        return sewingLines.filter(line => !allocatedLineIds.has(line.id));
    }, [sewingLines, lineGroups]);

    const activeGroup = useMemo(() => lineGroups.find(g => g.id === activeGroupId), [lineGroups, activeGroupId]);

    const handleCreateGroup = () => {
        if (!selectedCc) return;
        
        const order = orders.find(o => o.ocn === selectedCc);
        if (!order) return;

        const newGroupName = `SLG-${lineGroups.length + 1}`;

        const operations = SEWING_OPERATIONS_BY_STYLE[order.style] || [];
        const machineCounts = operations.reduce((acc, op) => {
            const machineAbbr = MACHINE_NAME_ABBREVIATIONS[op.machine] || op.machine;
            acc[machineAbbr] = (acc[machineAbbr] || 0) + op.operators;
            return acc;
        }, {} as Record<string, number>);

        const machineRequirements: MachineRequirement[] = Object.entries(machineCounts).map(([type, count]) => ({
            machineType: type,
            required: count,
            allocated: 0,
        }));
        
        const newGroup: SewingLineGroup = {
            id: `lg-${crypto.randomUUID()}`,
            name: newGroupName,
            ccNo: selectedCc,
            allocatedLines: [],
            machineRequirements: machineRequirements,
        };

        setLineGroups([...lineGroups, newGroup]);
        setSelectedCc('');
        setActiveGroupId(newGroup.id);
    };

    const handleDeleteGroup = (groupId: string) => {
        setLineGroups(prev => prev.filter(g => g.id !== groupId));
        if (activeGroupId === groupId) {
            setActiveGroupId(null);
        }
    };
    
    const allocateLine = useCallback((line: SewingLine) => {
        if (!activeGroup) return;

        setLineGroups(prevGroups => prevGroups.map(group => {
            if (group.id !== activeGroup.id) return group;

            const remainingRequirements = group.machineRequirements.map(req => ({
                ...req,
                required: req.required - req.allocated
            }));

            const availableMachinesInLine = line.machines.slice(); // Create a copy to mutate
            let machinesToAllocate: SewingMachine[] = [];
            let isPartial = false;

            remainingRequirements.forEach(req => {
                if (req.required > 0) {
                    const machineTypeAbbr = req.machineType;
                    const machineFullName = Object.keys(MACHINE_NAME_ABBREVIATIONS).find(key => MACHINE_NAME_ABBREVIATIONS[key] === machineTypeAbbr) || machineTypeAbbr;
                    
                    const matchingMachines = availableMachinesInLine.filter(m => m.name === machineFullName);
                    const machinesNeeded = req.required;
                    const allocatedFromThisType = matchingMachines.slice(0, machinesNeeded);
                    machinesToAllocate.push(...allocatedFromThisType);
                    // Remove allocated machines from available pool
                    allocatedFromThisType.forEach(am => {
                        const index = availableMachinesInLine.findIndex(m => m.id === am.id);
                        if (index > -1) availableMachinesInLine.splice(index, 1);
                    });
                }
            });
            
            // Check if we allocated all machines from the line or just some
            isPartial = machinesToAllocate.length > 0 && machinesToAllocate.length < line.machines.length;
            
            if (machinesToAllocate.length === 0) {
                // If no specific machines were needed but we're allocating a full line
                machinesToAllocate = [...line.machines];
                isPartial = false;
            } else if (!isPartial && machinesToAllocate.length > 0) {
                 machinesToAllocate = [...line.machines]; // Ensure all machines are included for a full line
            }

            const newAllocatedLine = {
                lineId: line.id,
                isPartial,
                allocatedMachines: machinesToAllocate
            };
            
            const updatedAllocatedLines = [...group.allocatedLines, newAllocatedLine];

            // Recalculate total allocated machines
            const totalAllocatedMachines = updatedAllocatedLines.flatMap(l => l.allocatedMachines);
            const newAllocatedCounts = totalAllocatedMachines.reduce((acc, machine) => {
                const machineType = MACHINE_NAME_ABBREVIATIONS[machine.name] || machine.name;
                acc[machineType] = (acc[machineType] || 0) + 1;
                return acc;
            }, {} as Record<string, number>);

            const updatedRequirements = group.machineRequirements.map(req => ({
                ...req,
                allocated: newAllocatedCounts[req.machineType] || 0,
            }));

            return { ...group, allocatedLines: updatedAllocatedLines, machineRequirements: updatedRequirements };
        }));

    }, [activeGroup]);
    
    const deallocateLine = useCallback((lineId: string) => {
        if (!activeGroup) return;

        setLineGroups(prevGroups => prevGroups.map(group => {
            if (group.id !== activeGroup.id) return group;

            const updatedAllocatedLines = group.allocatedLines.filter(l => l.lineId !== lineId);

             // Recalculate total allocated machines
            const totalAllocatedMachines = updatedAllocatedLines.flatMap(l => l.allocatedMachines);
            const newAllocatedCounts = totalAllocatedMachines.reduce((acc, machine) => {
                const machineType = MACHINE_NAME_ABBREVIATIONS[machine.name] || machine.name;
                acc[machineType] = (acc[machineType] || 0) + 1;
                return acc;
            }, {} as Record<string, number>);

            const updatedRequirements = group.machineRequirements.map(req => ({
                ...req,
                allocated: newAllocatedCounts[req.machineType] || 0,
            }));
            
            return { ...group, allocatedLines: updatedAllocatedLines, machineRequirements: updatedRequirements };
        }));
    }, [activeGroup]);
    
    const ccOptions = useMemo(() => {
        const assignedCcs = new Set(lineGroups.map(g => g.ccNo));
        return orders
            .filter(o => o.orderType === 'Forecasted' && o.ocn && !assignedCcs.has(o.ocn))
            .map(o => o.ocn)
            .filter((value, index, self) => self.indexOf(value) === index);
    }, [orders, lineGroups]);

    return (
        <div className="flex h-screen flex-col">
            <Header />
            <main className="flex-1 p-4 sm:p-6 lg:p-8 flex flex-col space-y-6">
                <Breadcrumb className="flex-shrink-0">
                    <BreadcrumbList>
                        <BreadcrumbItem>
                            <BreadcrumbLink asChild>
                                <Link href="/">Home</Link>
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
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1 min-h-0">
                    {/* Left Column: Groups & Unallocated */}
                    <div className="lg:col-span-1 flex flex-col gap-6">
                        <Card>
                             <CardHeader>
                                <CardTitle>Create New Line Group</CardTitle>
                             </CardHeader>
                             <CardContent className="space-y-4">
                                <div className="space-y-2">
                                    <Label>Group Name</Label>
                                    <p className="text-lg font-semibold text-muted-foreground p-2 border rounded-md h-10">SLG-{lineGroups.length + 1}</p>
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
                                <Button onClick={handleCreateGroup} disabled={!selectedCc} className="w-full">
                                    <PlusCircle className="mr-2" /> Create Group
                                </Button>
                             </CardContent>
                        </Card>
                        <Card className="flex-1 flex flex-col">
                             <CardHeader>
                                <CardTitle>Unallocated Lines</CardTitle>
                             </CardHeader>
                             <CardContent className="flex-1 overflow-y-auto">
                                <div className="space-y-2">
                                    {unallocatedLines.length > 0 ? (
                                        unallocatedLines.map(line => (
                                            <UnallocatedLineCard key={line.id} line={line} onAllocate={allocateLine} activeGroup={activeGroup} />
                                        ))
                                    ) : (
                                        <p className="text-sm text-muted-foreground text-center py-8">All sewing lines are allocated.</p>
                                    )}
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
                                {lineGroups.length > 0 ? (
                                    <div className="space-y-2">
                                        {lineGroups.map(group => (
                                            <div key={group.id} className={cn("p-3 rounded-md border flex items-center justify-between cursor-pointer", activeGroupId === group.id && "ring-2 ring-primary border-primary")} onClick={() => setActiveGroupId(group.id)}>
                                                <div>
                                                    <p className="font-semibold">{group.name}</p>
                                                    <p className="text-sm text-muted-foreground">CC: {group.ccNo}</p>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <Button variant="ghost" size="icon" className="text-destructive h-8 w-8" onClick={(e) => { e.stopPropagation(); handleDeleteGroup(group.id); }}>
                                                        <Trash2 />
                                                    </Button>
                                                    <ChevronRight className={cn("h-5 w-5 text-muted-foreground transition-transform", activeGroupId === group.id && "text-primary")} />
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                     <p className="text-sm text-muted-foreground text-center py-8">No line groups created yet.</p>
                                )}
                            </CardContent>
                        </Card>
                        
                        {activeGroup && (
                            <Card className="flex-1 flex flex-col">
                                 <CardHeader>
                                    <CardTitle>Details for {activeGroup.name}</CardTitle>
                                    <CardDescription>CC No: {activeGroup.ccNo}</CardDescription>
                                 </CardHeader>
                                 <CardContent className="flex-1 flex flex-col gap-6">
                                    <div>
                                        <h3 className="font-semibold mb-2">Machine Requirements</h3>
                                        <RequirementsTable requirements={activeGroup.machineRequirements} />
                                    </div>
                                    <div className="flex-1 flex flex-col">
                                        <h3 className="font-semibold mb-2">Allocated Lines</h3>
                                        <div className="flex-1 overflow-y-auto space-y-2 border p-2 rounded-md bg-muted/30">
                                            {activeGroup.allocatedLines.length > 0 ? (
                                                activeGroup.allocatedLines.map(alloc => {
                                                    const line = sewingLines.find(l => l.id === alloc.lineId);
                                                    if (!line) return null;
                                                    return (
                                                        <div key={alloc.lineId} className="p-3 rounded-md border bg-background flex items-center justify-between">
                                                            <div>
                                                                <p className="font-medium">{line.name} {alloc.isPartial && <span className="text-xs font-normal text-muted-foreground">(Partial)</span>}</p>
                                                                <p className="text-xs text-muted-foreground">{alloc.allocatedMachines.length} / {line.machines.length} Machines Allocated</p>
                                                            </div>
                                                            <Button size="sm" variant="destructive" onClick={() => deallocateLine(alloc.lineId)}>
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
        </div>
    );
}
