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
import { PlusCircle, Trash2, ChevronRight, Edit } from 'lucide-react';
import type { SewingLine, SewingMachineType, SewingLineGroup as ISewingLineGroup } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import LineReallocationDialog from '@/components/capacity/line-reallocation-dialog';
import CreateLineDialog from '@/components/capacity/create-line-dialog';
import { useToast } from '@/hooks/use-toast';

// Simplified SewingLineGroup for GUP mode
type SewingLineGroup = Omit<ISewingLineGroup, 'ccNo' | 'machineRequirements' | 'outputMultiplier'>;

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
                    <Button size="sm" variant="outline" onClick={() => onAllocate(line)} disabled={!activeGroup}>
                        Allocate
                    </Button>
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

function getUUID() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `lg-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
}

export default function CapacityPage() {
  const { 
    appMode, 
    sewingLines, 
    setSewingLines, 
    sewingLineGroups: allGroups, 
    setSewingLineGroups: setAllGroups,
  } = useSchedule();
  
  const sewingLineGroups = useMemo(() => allGroups.map(g => ({...g, allocatedLines: g.allocatedLines || [] })), [allGroups]) as SewingLineGroup[];
  const setSewingLineGroups = setAllGroups as React.Dispatch<React.SetStateAction<SewingLineGroup[]>>;

  const [activeGroupId, setActiveGroupId] = useState<string | null>(null);
  const [isCreatingLine, setIsCreatingLine] = useState(false);
  const [lineForReallocation, setLineForReallocation] = useState<SewingLine | null>(null);
  const { toast } = useToast();

  const unallocatedLines = useMemo(() => {
      const allocatedLineIds = new Set(sewingLineGroups.flatMap(g => g.allocatedLines));
      return sewingLines.filter(line => !allocatedLineIds.has(line.id));
  }, [sewingLines, sewingLineGroups]);

  const activeGroup = useMemo(() => sewingLineGroups.find(g => g.id === activeGroupId), [sewingLineGroups, activeGroupId]);

  const handleCreateGroup = () => {
    const newGroupName = `SLG-${sewingLineGroups.length + 1}`;
    const newGroupId = getUUID();

    const newGroup: SewingLineGroup = {
      id: newGroupId,
      name: newGroupName,
      allocatedLines: [],
    };

    // use functional update to avoid stale state
    setSewingLineGroups(prev => [...prev, newGroup]);
    setActiveGroupId(newGroupId);
  };

  const handleDeleteGroup = (groupId: string) => {
    // use functional update to avoid stale state
    setSewingLineGroups(prev => prev.filter(g => g.id !== groupId));
    if (activeGroupId === groupId) {
      setActiveGroupId(null);
    }
  };

  const allocateLine = useCallback((line: SewingLine) => {
    if (!activeGroup) return;
    setSewingLineGroups(prevGroups => prevGroups.map(group => {
      if (group.id !== activeGroup.id) return group;
      return { ...group, allocatedLines: [...group.allocatedLines, line.id] };
    }));
  }, [activeGroup, setSewingLineGroups]);

  const deallocateLine = useCallback((lineId: string) => {
    if (!activeGroup) return;
    setSewingLineGroups(prevGroups => prevGroups.map(group => {
      if (group.id !== activeGroup.id) return group;
      return { ...group, allocatedLines: group.allocatedLines.filter(lId => lId !== lineId) };
    }));
  }, [activeGroup, setSewingLineGroups]);

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

  const handleCreateNewLine = (
    lineName: string,
    transfers: { sourceLineId: string; machineType: SewingMachineType; quantity: number }[]
  ) => {
    setSewingLines(prevLines => {
      const newLines = JSON.parse(JSON.stringify(prevLines)) as SewingLine[];
      const newLine: SewingLine = {
        id: `L${prevLines.length + 1}`,
        name: lineName,
        unitId: 'u1',
        machineCounts: {},
      };

      transfers.forEach(({ sourceLineId, machineType, quantity }) => {
        const sourceLine = newLines.find(l => l.id === sourceLineId);
        if (sourceLine) {
          sourceLine.machineCounts[machineType] = (sourceLine.machineCounts[machineType] || 0) - quantity;
          newLine.machineCounts[machineType] = (newLine.machineCounts[machineType] || 0) + quantity;
        }
      });

      return [...newLines, newLine];
    });

    toast({
      title: "Sewing Line Created",
      description: `Line "${lineName}" has been created successfully.`,
    });
    setIsCreatingLine(false);
  };
  
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


  if (appMode !== 'gup') {
    return (
      <div className="flex h-screen flex-col">
        <Header />
        <main className="flex-1 p-4 sm:p-6 lg:p-8 flex items-center justify-center">
          <div className="text-center">
            <h2 className="text-xl font-semibold">Capacity Management Not Available</h2>
            <p className="mt-2 text-muted-foreground">This view is only applicable for GUP mode.</p>
            <Button asChild className="mt-6">
              <Link href="/orders">View Orders</Link>
            </Button>
          </div>
        </main>
      </div>
    );
  }

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
              <BreadcrumbPage>Capacity Management</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
        <div className="flex justify-between items-center flex-shrink-0">
          <div>
            <h1 className="text-2xl font-bold">Sewing Line Grouping</h1>
            <p className="text-muted-foreground">Create line groups by allocating sewing lines.</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setIsCreatingLine(true)}>
                <PlusCircle className="mr-2 h-4 w-4" /> Sewing Line
            </Button>
            <Button variant="outline" size="sm" onClick={handleCreateGroup}>
              <PlusCircle className="mr-2 h-4 w-4" /> Line Group
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1 min-h-0">
          {/* Left Column: Unallocated Lines */}
          <div className="lg:col-span-1 flex flex-col gap-6">
            <Card className="flex-1 flex flex-col">
              <CardHeader>
                <CardTitle>Unallocated Lines</CardTitle>
              </CardHeader>
              <CardContent className="flex-1 overflow-y-auto">
                <div className="space-y-2">
                  {unallocatedLines.length > 0 ? (
                    unallocatedLines.map(line => (
                      <UnallocatedLineCard 
                        key={line.id} 
                        line={line} 
                        onAllocate={allocateLine} 
                        onEdit={setLineForReallocation} 
                        activeGroup={activeGroup} 
                      />
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-8">All sewing lines are allocated.</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right Column: Groups */}
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
                                <div className="flex items-center justify-between">
                                    <p className="font-semibold">{group.name}</p>
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
                <CardHeader>
                  <CardTitle>Allocated Lines for {activeGroup.name}</CardTitle>
                </CardHeader>
                <CardContent className="flex-1 overflow-y-auto space-y-2 border p-2 rounded-md bg-muted/30">
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
                          <Button size="sm" variant="destructive" onClick={() => deallocateLine(lineId)}>
                            Deallocate
                          </Button>
                        </div>
                      );
                    })
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-8">No lines allocated to this group yet.</p>
                  )}
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
       <CreateLineDialog
          isOpen={isCreatingLine}
          onOpenChange={setIsCreatingLine}
          allLines={sewingLines}
          onSave={handleCreateNewLine}
      />
    </div>
  );
}
