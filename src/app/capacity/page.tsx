
'use client';

import { useState, useMemo } from 'react';
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
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { FilterDropdown } from '@/components/capacity/filter-dropdown';
import { Badge } from '@/components/ui/badge';
import { X } from 'lucide-react';

type MachineGroup = {
  process: Process;
  name: string;
  unit: Unit;
  quantity: number;
  isMoveable: boolean;
};

export default function CapacityPage() {
  const [machines, setMachines] = useState<Machine[]>(MACHINES);
  const [selectedUnit, setSelectedUnit] = useState<string>('');

  const [selectedProcesses, setSelectedProcesses] = useState<string[]>([]);
  const [selectedMachineTypes, setSelectedMachineTypes] = useState<string[]>([]);
  const [selectedUnits, setSelectedUnitsState] = useState<string[]>([]);
  const [selectedMobilities, setSelectedMobilities] = useState<string[]>([]);

  const allMachineGroups: MachineGroup[] = useMemo(() => {
    return PROCESSES.flatMap(process => {
      const machinesInProcess = machines.filter(m => m.processIds.includes(process.id));
      
      const machineGroupsByUnit: Record<string, Record<string, MachineGroup>> = {};
  
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
            isMoveable: machine.isMoveable,
          };
        }
        machineGroupsByUnit[machineType][unit.id].quantity++;
      });
  
      return Object.values(machineGroupsByUnit).flatMap(unitGroup => Object.values(unitGroup));
    }).sort((a, b) => {
      if (a.process.name !== b.process.name) {
        return a.process.name.localeCompare(b.process.name);
      }
      if (a.name !== b.name) {
        return a.name.localeCompare(a.name);
      }
      return a.unit.name.localeCompare(b.unit.name);
    });
  }, [machines]);
  
  const handleReallocate = (machineName: string, fromUnitId: string) => {
    if (!selectedUnit) return;
    
    setMachines(prevMachines => {
      const newMachines = [...prevMachines];
      const machineToMoveIndex = newMachines.findIndex(m => 
        m.name.startsWith(machineName) && m.unitId === fromUnitId && m.isMoveable
      );

      if (machineToMoveIndex > -1) {
        newMachines[machineToMoveIndex] = {
          ...newMachines[machineToMoveIndex],
          unitId: selectedUnit
        };
      }
      
      return newMachines;
    });

    setSelectedUnit('');
  }

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
                      <TableHead className="w-[120px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredMachineGroups.map((group, index) => (
                      <TableRow key={index}>
                        <TableCell className="font-medium">{group.process.name}</TableCell>
                        <TableCell>{group.name}</TableCell>
                        <TableCell>{group.unit.name}</TableCell>
                        <TableCell>{group.isMoveable ? 'Moveable' : 'Fixed'}</TableCell>
                        <TableCell className="text-right">{group.quantity}</TableCell>
                        <TableCell>
                          <AlertDialog onOpenChange={() => setSelectedUnit('')}>
                            <AlertDialogTrigger asChild>
                              <Button variant="outline" size="sm" disabled={!group.isMoveable}>
                                Reallocate
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Reallocate {group.name}</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Select a new unit to move this machine to.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <Select onValueChange={setSelectedUnit}>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select new unit" />
                                </SelectTrigger>
                                <SelectContent>
                                  {UNITS.filter(u => u.id !== group.unit.id).map(unit => (
                                    <SelectItem key={unit.id} value={unit.id}>
                                      {unit.name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleReallocate(group.name, group.unit.id)} disabled={!selectedUnit}>
                                  Confirm
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </TableCell>
                      </TableRow>
                    ))}
                    {filteredMachineGroups.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={6} className="h-24 text-center">
                          No results found.
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
