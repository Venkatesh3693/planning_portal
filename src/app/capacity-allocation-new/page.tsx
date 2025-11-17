
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
import { PlusCircle, Trash2, ChevronRight, Edit, Save } from 'lucide-react';
import { SEWING_OPERATIONS_BY_STYLE, MACHINE_NAME_ABBREVIATIONS, sewingMachineTypes } from '@/lib/data';
import type { Order, SewingLine, SewingMachine, SewingLineGroup, MachineRequirement } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import LineReallocationDialog from '@/components/capacity/line-reallocation-dialog';
import { useToast } from '@/hooks/use-toast';


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
                {Object.entries(machineCounts)
                    .filter(([type]) => ['SNLS', 'OLM', 'FLM', 'BTM'].includes(type))
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

    const [lineForReallocation, setLineForReallocation] = useState<SewingLine | null>(null);
    const { toast } = useToast();
    
    const { unallocatedLines, bufferLine } = useMemo(() => {
        const allocatedLineIds = new Set(sewingLineGroups.flatMap(g => g.allocatedLines.map(l => l.lineId)));
        const allUnallocatedLines = sewingLines.filter(line => !allocatedLineIds.has(line.id));

        const buffer = allUnallocatedLines.find(l => l.id === 'buffer');
        const regularLines = allUnallocatedLines.filter(l => l.id !== 'buffer');
        
        return { unallocatedLines: regularLines, bufferLine: buffer };
    }, [sewingLines, sewingLineGroups]);

    const activeGroup = useMemo(() => sewingLineGroups.find(g => g.id === activeGroupId), [sewingLineGroups, activeGroupId]);
    
    const activeGroupMachineTotals = useMemo(() => {
        if (!activeGroup) return {};
         const allocatedMachines = activeGroup.allocatedLines.flatMap(l => {
            const line = sewingLines.find(sl => sl.id === l.lineId);
            return line ? line.machines.filter(m => l.allocatedMachines.some(am => am.id === m.id)) : [];
        });

         return allocatedMachines.reduce((acc, machine) => {
            const machineType = MACHINE_NAME_ABBREVIATIONS[machine.name] || machine.name;
            acc[machineType] = (acc[machineType] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);
    }, [activeGroup, sewingLines]);


    const handleCreateGroup = () => {
        if (!selectedCc) return;
        
        const order = orders.find(o => o.ocn === selectedCc);
        if (!order) return;

        const newGroupName = `SLG-${sewingLineGroups.length + 1}`;

        const operations = (SEWING_OPERATIONS_BY_STYLE[order.style] || []).filter(op => sewingMachineTypes.includes(op.machine));
        const machineCounts = operations.reduce((acc, op) => {
            const machineAbbr = MACHINE_NAME_ABBREVIATIONS[op.machine] || op.machine;
            acc[machineAbbr] = (acc[machineAbbr] || 0) + op.operators;
            return acc;
        }, {} as Record<string, number>);

        const machineRequirements: MachineRequirement[] = Object.entries(machineCounts).map(([type, count]) => ({
            machineType: type,
            required: count,
        }));
        
        const newGroup: SewingLineGroup = {
            id: `lg-${crypto.randomUUID()}`,
            name: newGroupName,
            ccNo: selectedCc,
            allocatedLines: [],
            machineRequirements: machineRequirements,
        };

        setSewingLineGroups([...sewingLineGroups, newGroup]);
        setSelectedCc('');
        setActiveGroupId(newGroup.id);
        setIsCreatingGroup(false);
    };

    const handleDeleteGroup = (groupId: string) => {
        setSewingLineGroups(prev => prev.filter(g => g.id !== groupId));
        if (activeGroupId === groupId) {
            setActiveGroupId(null);
        }
    };
    
    const allocateLine = useCallback((line: SewingLine) => {
        if (!activeGroup) return;

        setSewingLineGroups(prevGroups => prevGroups.map(group => {
            if (group.id !== activeGroup.id) return group;

            const remainingRequirements = group.machineRequirements.map(req => ({
                ...req,
                required: req.required - (activeGroupMachineTotals[req.machineType] || 0)
            }));

            const availableMachinesInLine = line.machines.slice();
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
                    
                    allocatedFromThisType.forEach(am => {
                        const index = availableMachinesInLine.findIndex(m => m.id === am.id);
                        if (index > -1) availableMachinesInLine.splice(index, 1);
                    });
                }
            });
            
            isPartial = machinesToAllocate.length > 0 && machinesToAllocate.length < line.machines.length;
            
            if (machinesToAllocate.length === 0) {
                machinesToAllocate = [...line.machines];
                isPartial = false;
            } else if (!isPartial && machinesToAllocate.length > 0) {
                 machinesToAllocate = [...line.machines]; 
            }

            const newAllocatedLine = {
                lineId: line.id,
                isPartial,
                allocatedMachines: machinesToAllocate
            };
            
            const updatedAllocatedLines = [...group.allocatedLines, newAllocatedLine];
            
            return { ...group, allocatedLines: updatedAllocatedLines };
        }));

    }, [activeGroup, activeGroupMachineTotals, setSewingLineGroups]);
    
    const deallocateLine = useCallback((lineId: string) => {
        if (!activeGroup) return;

        setSewingLineGroups(prevGroups => prevGroups.map(group => {
            if (group.id !== activeGroup.id) return group;

            const updatedAllocatedLines = group.allocatedLines.filter(l => l.lineId !== lineId);
            
            return { ...group, allocatedLines: updatedAllocatedLines };
        }));
    }, [activeGroup, setSewingLineGroups]);
    
    const ccOptions = useMemo(() => {
        const assignedCcs = new Set(sewingLineGroups.map(g => g.ccNo));
        return orders
            .filter(o => o.orderType === 'Forecasted' && o.ocn && !assignedCcs.has(o.ocn))
            .map(o => o.ocn)
            .filter((value, index, self) => self.indexOf(value) === index);
    }, [orders, sewingLineGroups]);
    
    const handleReallocationSave = (targetLineId: string, movedMachines: SewingMachine[]) => {
        setSewingLines(prevLines => {
            const currentLines = JSON.parse(JSON.stringify(prevLines)) as SewingLine[];
            
            const machineIdsToMove = new Set(movedMachines.map(m => m.id));

            // Remove machines from their original lines
            currentLines.forEach(line => {
                line.machines = line.machines.filter(m => !machineIdsToMove.has(m.id));
            });

            // Add moved machines to the target line
            const targetLine = currentLines.find(l => l.id === targetLineId);
            if (targetLine) {
                targetLine.machines.push(...movedMachines.map(m => ({ ...m, lineId: targetLineId })));
            }
            
            return currentLines;
        });

        setLineForReallocation(null);
    };

    const handleSaveConfiguration = () => {
        // The saving is handled by the useEffect in the provider, but we can show a toast
        toast({
          title: "Configuration Saved",
          description: "Your sewing line group settings have been saved successfully.",
        });
        setActiveGroupId(null);
    };

    const calculateGroupMachineTotals = (group: SewingLineGroup) => {
      if (!group) return {};
      const allocatedMachines = group.allocatedLines.flatMap(l => {
          const line = sewingLines.find(sl => sl.id === l.lineId);
          return line ? line.machines.filter(m => l.allocatedMachines.some(am => am.id === m.id)) : [];
      });

       return allocatedMachines.reduce((acc, machine) => {
          const machineType = MACHINE_NAME_ABBREVIATIONS[machine.name] || machine.name;
          acc[machineType] = (acc[machineType] || 0) + 1;
          return acc;
      }, {} as Record<string, number>);
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
                                    <div className="space-y-2">
                                        <Label>Group Name</Label>
                                        <p className="text-lg font-semibold text-muted-foreground p-2 border rounded-md h-10">SLG-{sewingLineGroups.length + 1}</p>
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
                                    {unallocatedLines.length > 0 ? (
                                        unallocatedLines.map(line => (
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
                                                <div key={group.id} className={cn("p-3 rounded-md border flex flex-col cursor-pointer", activeGroupId === group.id && "ring-2 ring-primary border-primary")} onClick={() => setActiveGroupId(prevId => prevId === group.id ? null : group.id)}>
                                                    <div className="flex items-center justify-between">
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
                                 <CardHeader className="flex flex-row items-center justify-between">
                                    <div>
                                        <CardTitle>Details for {activeGroup.name}</CardTitle>
                                        <CardDescription>CC No: {activeGroup.ccNo}</CardDescription>
                                    </div>
                                    <Button size="sm" onClick={handleSaveConfiguration}>
                                        <Save className="mr-2 h-4 w-4" /> Save Configuration
                                    </Button>
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
                                                activeGroup.allocatedLines.map(alloc => {
                                                    const line = sewingLines.find(l => l.id === alloc.lineId);
                                                    if (!line) return null;
                                                    
                                                    const machinesInLine = line.machines.filter(m => alloc.allocatedMachines.some(am => am.id === m.id));

                                                    const machineCounts = machinesInLine.reduce((acc, m) => {
                                                        const type = MACHINE_NAME_ABBREVIATIONS[m.name] || m.name;
                                                        acc[type] = (acc[type] || 0) + 1;
                                                        return acc;
                                                    }, {} as Record<string, number>)

                                                    return (
                                                        <div key={alloc.lineId} className="p-3 rounded-md border bg-background flex items-start justify-between">
                                                            <div>
                                                                <p className="font-medium">{line.name} {alloc.isPartial && <span className="text-xs font-normal text-muted-foreground">(Partial)</span>}</p>
                                                                <p className="text-xs text-muted-foreground">{alloc.allocatedMachines.length} / {line.machines.length} Machines Allocated</p>
                                                                <div className="flex flex-wrap gap-1 mt-2">
                                                                    {Object.entries(machineCounts).map(([type, count]) => (
                                                                        <Badge key={type} variant="secondary" className="font-normal">{type}: {count}</Badge>
                                                                    ))}
                                                                </div>
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
            {lineForReallocation && (
                <LineReallocationDialog
                    targetLine={lineForReallocation}
                    allLines={sewingLines}
                    isOpen={!!lineForReallocation}
                    onOpenChange={(isOpen) => !isOpen && setLineForReallocation(null)}
                    onSave={handleReallocationSave}
                />
            )}
        </div>
    );
}
