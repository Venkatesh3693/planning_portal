
'use client';

import { useState, useMemo, useEffect } from 'react';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { Header } from '@/components/layout/header';
import Link from 'next/link';
import { UNITS, MACHINES, PROCESSES } from '@/lib/data';
import type { Machine, Process, Unit } from '@/lib/types';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from '@/components/ui/card';
import { FilterDropdown } from '@/components/capacity/filter-dropdown';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { X, PlusCircle } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type MachineGroup = {
  process: Process;
  name: string;
  unit: Unit;
  quantity: number;
  isMoveable: boolean;
};

type ReallocationEntry = {
  unitId: string;
  quantity: number;
};

type ReallocationState = {
  machineName: string;
  sourceUnitId: string;
  totalQuantity: number;
  allocations: ReallocationEntry[];
};


export default function CapacityPage() {
  const [machines, setMachines] = useState<Machine[]>(MACHINES);
  const [reallocationState, setReallocationState] = useState<ReallocationState | null>(null);

  const [selectedProcesses, setSelectedProcesses] = useState<string[]>([]);
  const [selectedMachineTypes, setSelectedMachineTypes] = useState<string[]>([]);
  const [selectedUnits, setSelectedUnitsState] = useState<string[]>([]);
  const [selectedMobilities, setSelectedMobilities] = useState<string[]>([]);

  const allMachineGroups: MachineGroup[] = useMemo(() => {
    return PROCESSES.flatMap(process => {
      const machinesInProcess = machines.filter(m => m.processIds.includes(process.id));
      
      const machineGroupsByUnit: Record<string, Record<string, {
          process: Process;
          name: string;
          unit: Unit;
          quantity: number;
          isMoveable: boolean;
      }>> = {};
  
      machinesInProcess.forEach(machine => {
        const machineType = machine.name.replace(/\s\d+$|\s(Alpha|Beta)$/, '');
        const unit = UNITS.find(u => u.id === machine.unitId)!;
  
        if (!machineGroupsByUnit[machineType]) {
          machineGroupsByUnit[machineType] = {};
        }
        if (!machineGroupsByUnit[machineType][unit.id]) {
          machineGroupsByUnit[machineType][unit.id] = {
            process: process,
            name: machineType,
            unit: unit,
            quantity: 0,
            isMoveable: false,
          };
        }
        machineGroupsByUnit[machineType][unit.id].quantity++;
        if (machine.isMoveable) {
          machineGroupsByUnit[machineType][unit.id].isMoveable = true;
        }
      });
  
      return Object.values(machineGroupsByUnit).flatMap(unitGroup => Object.values(unitGroup));

    }).sort((a, b) => {
      if (a.process.name !== b.process.name) {
        return a.process.name.localeCompare(b.process.name);
      }
      if (a.name !== b.name) {
        return a.name.localeCompare(a.name);
      }
      return a.unit.name.localeCompare(a.unit.name);
    });
  }, [machines]);

  const handleOpenReallocation = (group: MachineGroup) => {
    setReallocationState({
      machineName: group.name,
      sourceUnitId: group.unit.id,
      totalQuantity: group.quantity,
      allocations: [
        { unitId: group.unit.id, quantity: group.quantity },
        { unitId: '', quantity: 0 },
      ],
    });
  };

  const handleAllocationChange = (index: number, newEntry: ReallocationEntry) => {
    setReallocationState(prev => {
      if (!prev) return null;
      
      const newAllocations = [...prev.allocations];
      newAllocations[index] = newEntry;

      const allocatedQuantity = newAllocations.slice(1).reduce((sum, alloc) => sum + alloc.quantity, 0);
      newAllocations[0] = { ...newAllocations[0], quantity: prev.totalQuantity - allocatedQuantity };

      return { ...prev, allocations: newAllocations };
    });
  };

  const addAllocationRow = () => {
    setReallocationState(prev => {
      if (!prev) return null;
      return {
        ...prev,
        allocations: [...prev.allocations, { unitId: '', quantity: 0 }],
      };
    });
  };

  const removeAllocationRow = (index: number) => {
    setReallocationState(prev => {
      if (!prev) return null;
      const newAllocations = prev.allocations.filter((_, i) => i !== index);
      const allocatedQuantity = newAllocations.slice(1).reduce((sum, alloc) => sum + alloc.quantity, 0);
      newAllocations[0] = { ...newAllocations[0], quantity: prev.totalQuantity - allocatedQuantity };

      return { ...prev, allocations: newAllocations };
    });
  };
  
  const handleConfirmReallocation = () => {
    if (!reallocationState) return;
    const { machineName, allocations } = reallocationState;
    
    setMachines(prevMachines => {
      let updatedMachines = [...prevMachines];
      
      // First, remove all moveable machines of this type from all units to create a pool
      const machinePool = updatedMachines.filter(m => 
        m.name.startsWith(machineName) && m.isMoveable
      );
      updatedMachines = updatedMachines.filter(m => 
        !m.name.startsWith(machineName) || !m.isMoveable
      );

      // Now, distribute the machines from the pool to the units as per the new allocations
      const finalMachines = [...updatedMachines];
      let poolIndex = 0;

      allocations.forEach(({ unitId, quantity }) => {
        if (!unitId || quantity === 0) return;

        for (let i = 0; i < quantity; i++) {
          if (poolIndex < machinePool.length) {
            const machineToPlace = { ...machinePool[poolIndex], unitId: unitId };
            finalMachines.push(machineToPlace);
            poolIndex++;
          }
        }
      });
      
      // Add back any remaining (un-allocated) moveable machines to their original unit to be safe
      // Although ideally the pool should be empty
      while(poolIndex < machinePool.length) {
        finalMachines.push(machinePool[poolIndex]);
        poolIndex++;
      }
      
      // Also add back the fixed machines for this machine type
      const fixedMachines = prevMachines.filter(m => m.name.startsWith(machineName) && !m.isMoveable);
      finalMachines.push(...fixedMachines);


      return finalMachines;
    });

    setReallocationState(null);
  };

  const remainingQuantity = reallocationState?.allocations[0]?.quantity ?? 0;
  const isReallocationInvalid = remainingQuantity < 0 || reallocationState?.allocations.slice(1).some(a => !a.unitId && a.quantity > 0);
  
  const processOptions = useMemo(() => [...new Set(allMachineGroups.map(g => g.process.name))], [allMachineGroups]);
  const machineTypeOptions = useMemo(() => [...new Set(allMachineGroups.map(g => g.name))], [allMachineGroups]);
  const unitOptions = useMemo(() => [...new Set(allMachineGroups.map(g => g.unit.name))], [allMachineGroups]);
  const mobilityOptions = ['Moveable', 'Fixed'];
  
  const filteredMachineGroups = useMemo(() => {
    return allMachineGroups.filter(group => {
      const processMatch = selectedProcesses.length === 0 || selectedProcesses.includes(group.process.name);
      const machineTypeMatch = selectedMachineTypes.length === 0 || selectedMachineTypes.includes(group.name);
      const unitMatch = selectedUnits.length === 0 || selectedUnits.includes(group.unit.name);
      const mobilityMatch = selectedMobilities.length === 0 || selectedMobilities.includes(group.isMoveable ? 'Moveable' : 'Fixed');
      return processMatch && machineTypeMatch && unitMatch && mobilityMatch;
    });
  }, [allMachineGroups, selectedProcesses, selectedMachineTypes, selectedUnits, selectedMobilities]);

  const activeFilters = [
    ...selectedProcesses.map(v => ({ type: 'process', value: v })),
    ...selectedMachineTypes.map(v => ({ type: 'machine', value: v })),
    ...selectedUnits.map(v => ({ type: 'unit', value: v })),
    ...selectedMobilities.map(v => ({ type: 'mobility', value: v })),
  ];

  const removeFilter = (type: string, value: string) => {
    switch (type) {
      case 'process':
        setSelectedProcesses(prev => prev.filter(p => p !== value));
        break;
      case 'machine':
        setSelectedMachineTypes(prev => prev.filter(m => m !== value));
        break;
      case 'unit':
        setSelectedUnitsState(prev => prev.filter(u => u !== value));
        break;
      case 'mobility':
        setSelectedMobilities(prev => prev.filter(m => m !== value));
        break;
    }
  };

  const availableUnitsForAllocation = (index: number) => {
    if (!reallocationState) return UNITS;
    const usedUnitIds = reallocationState.allocations
      .map(a => a.unitId)
      .filter((id, i) => id && i !== index);
    return UNITS.filter(u => !usedUnitIds.includes(u.id));
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
              <BreadcrumbPage>Capacity Management</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
        <div className="space-y-4">
          <h1 className="text-2xl font-bold">Capacity Management</h1>
          <p className="text-muted-foreground">
            View your manufacturing resources. Use filters to narrow down your view.
          </p>

          <Card>
            <CardContent className="p-0">
                {activeFilters.length > 0 && (
                  <div className="flex flex-wrap items-center gap-2 p-4 border-b">
                    <span className="text-sm font-medium">Active Filters:</span>
                    {activeFilters.map(({type, value}) => (
                      <Badge key={`${type}-${value}`} variant="secondary" className="gap-1">
                        {value}
                        <button onClick={() => removeFilter(type, value)} className="rounded-full hover:bg-muted-foreground/20">
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                )}
                <AlertDialog onOpenChange={(isOpen) => !isOpen && setReallocationState(null)}>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>
                          <FilterDropdown title="Process" options={processOptions} selected={selectedProcesses} onSelectedChange={setSelectedProcesses} />
                        </TableHead>
                        <TableHead>
                          <FilterDropdown title="Machine" options={machineTypeOptions} selected={selectedMachineTypes} onSelectedChange={setSelectedMachineTypes} />
                        </TableHead>
                        <TableHead>
                          <FilterDropdown title="Unit" options={unitOptions} selected={selectedUnits} onSelectedChange={setSelectedUnitsState} />
                        </TableHead>
                        <TableHead>
                          <FilterDropdown title="Mobility" options={mobilityOptions} selected={selectedMobilities} onSelectedChange={setSelectedMobilities} />
                        </TableHead>
                        <TableHead className="text-right">Quantity</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredMachineGroups.map((group, index) => (
                        <TableRow key={index}>
                          <TableCell className="font-medium">{group.process.name}</TableCell>
                          <TableCell>{group.name}</TableCell>
                          <TableCell>
                            {group.isMoveable ? (
                              <AlertDialogTrigger 
                                asChild
                                onClick={() => handleOpenReallocation(group)}
                              >
                                <span className="cursor-pointer font-medium text-primary hover:underline">
                                  {group.unit.name}
                                </span>
                              </AlertDialogTrigger>
                            ) : (
                              <span>{group.unit.name}</span>
                            )}
                          </TableCell>
                          <TableCell>{group.isMoveable ? `Moveable` : 'Fixed'}</TableCell>
                          <TableCell className="text-right">{group.quantity}</TableCell>
                        </TableRow>
                      ))}
                      {filteredMachineGroups.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={5} className="h-24 text-center">
                            No results found.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>

                  {reallocationState && (
                    <AlertDialogContent className="max-w-2xl">
                      <AlertDialogHeader>
                        <AlertDialogTitle>Reallocate {reallocationState.machineName}</AlertDialogTitle>
                        <AlertDialogDescription>
                          Distribute the total of {reallocationState.totalQuantity} machines across different units.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      
                      <div className="space-y-4 py-4">
                        <div className="grid grid-cols-[1fr_100px_40px] items-center gap-x-4 gap-y-2 text-sm font-medium text-muted-foreground px-4">
                          <span>Unit</span>
                          <span className="text-right">Quantity</span>
                          <span></span>
                        </div>

                        {reallocationState.allocations.map((alloc, index) => (
                          <div key={index} className="grid grid-cols-[1fr_100px_40px] items-center gap-x-4 px-4">
                            {index === 0 ? (
                              <Input
                                readOnly
                                value={UNITS.find(u => u.id === alloc.unitId)?.name || 'Source Unit'}
                                className="border-none bg-transparent shadow-none px-0"
                              />
                            ) : (
                              <Select
                                value={alloc.unitId}
                                onValueChange={(unitId) => handleAllocationChange(index, { ...alloc, unitId })}
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="Select unit" />
                                </SelectTrigger>
                                <SelectContent>
                                  {availableUnitsForAllocation(index).map(unit => (
                                    <SelectItem key={unit.id} value={unit.id}>
                                      {unit.name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            )}

                            <Input
                              type="number"
                              min="0"
                              max={reallocationState.totalQuantity}
                              value={alloc.quantity}
                              readOnly={index === 0}
                              onChange={(e) => {
                                const newQuantity = parseInt(e.target.value, 10) || 0;
                                handleAllocationChange(index, { ...alloc, quantity: newQuantity });
                              }}
                              className="text-right"
                            />

                            {index > 0 && (
                               <Button variant="ghost" size="icon" onClick={() => removeAllocationRow(index)} className="justify-self-center">
                                <X className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        ))}
                         
                        {remainingQuantity < 0 && (
                          <p className="px-4 text-sm text-destructive">Total allocated quantity cannot exceed {reallocationState.totalQuantity}.</p>
                        )}
                        
                        <div className="px-4">
                          <Button variant="link" size="sm" onClick={addAllocationRow} className="p-0 h-auto">
                            <PlusCircle className="mr-2 h-4 w-4" />
                            Add unit
                          </Button>
                        </div>

                      </div>
                      
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleConfirmReallocation} disabled={isReallocationInvalid}>
                          Confirm
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  )}

                </AlertDialog>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}

    