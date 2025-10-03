
'use client';

import { useState } from 'react';
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
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
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

type MachineGroup = {
  name: string;
  unit: Unit;
  quantity: number;
  isMoveable: boolean;
};

type MachinesByProcess = {
  process: Process;
  machineGroups: MachineGroup[];
};

export default function CapacityPage() {
  const [machines, setMachines] = useState<Machine[]>(MACHINES);
  const [selectedUnit, setSelectedUnit] = useState<string>('');
  
  const machinesByProcess: MachinesByProcess[] = PROCESSES.map(process => {
    const machinesInProcess = machines.filter(m => m.processIds.includes(process.id));
    
    const machineGroups: Record<string, Record<string, MachineGroup>> = {};

    machinesInProcess.forEach(machine => {
      const machineType = machine.name.replace(/\s\d+$|\s(Alpha|Beta)$/, '');
      const unit = UNITS.find(u => u.id === machine.unitId)!;

      if (!machineGroups[machineType]) {
        machineGroups[machineType] = {};
      }
      if (!machineGroups[machineType][unit.id]) {
        machineGroups[machineType][unit.id] = {
          name: machineType,
          unit: unit,
          quantity: 0,
          isMoveable: machine.isMoveable,
        };
      }
      machineGroups[machineType][unit.id].quantity++;
    });

    const flattenedGroups = Object.values(machineGroups)
      .flatMap(unitGroup => Object.values(unitGroup))
      .sort((a, b) => a.unit.name.localeCompare(b.unit.name) || a.name.localeCompare(b.name));

    return {
      process,
      machineGroups: flattenedGroups,
    };
  }).sort((a, b) => a.process.name.localeCompare(b.process.name));
  
  const handleReallocate = (machineName: string, fromUnitId: string) => {
    if (!selectedUnit) return;
    
    // This is a placeholder for the actual logic.
    // In a real app, this would involve updating the state and potentially making an API call.
    console.log(`Reallocating ${machineName} from ${fromUnitId} to ${selectedUnit}`);
  }

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
            View your manufacturing resources organized by process and machine.
          </p>

          <Accordion type="multiple" className="w-full space-y-4">
            {machinesByProcess.map(({ process, machineGroups }) => (
              <AccordionItem key={process.id} value={process.id} className="border-b-0 rounded-lg border bg-card text-card-foreground shadow-sm">
                <AccordionTrigger className="p-6 text-lg font-semibold hover:no-underline">
                  {process.name}
                </AccordionTrigger>
                <AccordionContent className="p-6 pt-0">
                  <div className="space-y-3">
                    {machineGroups.length > 0 ? (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Machine</TableHead>
                            <TableHead>Unit</TableHead>
                            <TableHead>Mobility</TableHead>
                            <TableHead className="text-right">Quantity</TableHead>
                            <TableHead className="w-[120px]"></TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {machineGroups.map((group, index) => (
                            <TableRow key={index}>
                              <TableCell className="font-medium">{group.name}</TableCell>
                              <TableCell>{group.unit.name}</TableCell>
                              <TableCell>{group.isMoveable ? 'Moveable' : 'Fixed'}</TableCell>
                              <TableCell className="text-right">{group.quantity}</TableCell>
                              <TableCell>
                                <AlertDialog>
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
                                      <AlertDialogAction onClick={() => handleReallocate(group.name, group.unit.id)}>
                                        Confirm
                                      </AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    ) : (
                      <p className="text-sm text-muted-foreground">No machines assigned to this process.</p>
                    )}
                  </div>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </main>
    </div>
  );
}
