
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
import { Card, CardHeader, CardTitle } from '@/components/ui/card';

type MachinesByProcess = {
  [processId: string]: Machine[];
};

export default function CapacityPage() {
  const machinesByUnit = UNITS.map(unit => {
    const unitMachines = MACHINES.filter(m => m.unitId === unit.id);
    const machinesByProcess = unitMachines.reduce<MachinesByProcess>((acc, machine) => {
      machine.processIds.forEach(processId => {
        if (!acc[processId]) {
          acc[processId] = [];
        }
        acc[processId].push(machine);
      });
      return acc;
    }, {});

    return {
      ...unit,
      processes: Object.entries(machinesByProcess).map(([processId, machines]) => ({
        process: PROCESSES.find(p => p.id === processId)!,
        machines,
      })).sort((a, b) => a.process.name.localeCompare(b.process.name)),
    };
  });

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
            View your manufacturing resources organized by unit and process.
          </p>

          <Accordion type="multiple" className="w-full space-y-4">
            {machinesByUnit.map(unit => (
              <AccordionItem key={unit.id} value={unit.id} className="border-b-0 rounded-lg border bg-card text-card-foreground shadow-sm">
                <AccordionTrigger className="p-6 text-lg font-semibold hover:no-underline">
                  {unit.name}
                </AccordionTrigger>
                <AccordionContent className="p-6 pt-0">
                  <div className="space-y-6">
                    {unit.processes.length > 0 ? unit.processes.map(({ process, machines }) => (
                      <div key={process.id} className="space-y-3">
                        <h3 className="text-md font-semibold text-muted-foreground">{process.name}</h3>
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                          {machines.map(machine => (
                            <Card key={machine.id} className="bg-background">
                              <CardHeader>
                                <CardTitle className="text-base">{machine.name}</CardTitle>
                              </CardHeader>
                            </Card>
                          ))}
                        </div>
                      </div>
                    )) : (
                      <p className="text-sm text-muted-foreground">No machines assigned to this unit.</p>
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
