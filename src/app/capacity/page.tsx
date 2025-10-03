
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
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

type MachinesWithUnit = (Machine & { unit: Unit })[];

type MachinesByProcess = {
  process: Process;
  machines: MachinesWithUnit;
};

export default function CapacityPage() {
  const machinesWithUnits = MACHINES.map(machine => ({
    ...machine,
    unit: UNITS.find(u => u.id === machine.unitId)!,
  }));

  const machinesByProcess = PROCESSES.map(process => {
    const processMachines = machinesWithUnits
      .filter(m => m.processIds.includes(process.id))
      .sort((a, b) => a.name.localeCompare(b.name));
    
    return {
      process,
      machines: processMachines,
    };
  }).sort((a, b) => a.process.name.localeCompare(b.process.name));

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
            {machinesByProcess.map(({ process, machines }) => (
              <AccordionItem key={process.id} value={process.id} className="border-b-0 rounded-lg border bg-card text-card-foreground shadow-sm">
                <AccordionTrigger className="p-6 text-lg font-semibold hover:no-underline">
                  {process.name}
                </AccordionTrigger>
                <AccordionContent className="p-6 pt-0">
                  <div className="space-y-3">
                    {machines.length > 0 ? (
                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                        {machines.map(machine => (
                          <Card key={machine.id} className="bg-background">
                            <CardHeader>
                              <CardTitle className="text-base">{machine.name}</CardTitle>
                              <CardDescription>{machine.unit.name}</CardDescription>
                            </CardHeader>
                          </Card>
                        ))}
                      </div>
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
