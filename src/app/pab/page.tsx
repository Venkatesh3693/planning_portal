
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
import { ORDERS, PROCESSES } from '@/lib/data';
import { useAppContext } from '@/context/app-provider';
import { usePabData } from '@/hooks/use-pab-data';
import PabTable from '@/components/pab/pab-table';
import { addDays, startOfToday, getDay } from 'date-fns';

export default function PabPage() {
  const { scheduledProcesses } = useAppContext();
  
  const today = startOfToday();
  const dates = Array.from({ length: 90 }, (_, i) => addDays(today, i))
    .filter(date => getDay(date) !== 0); // Exclude Sundays
    
  const pabData = usePabData(scheduledProcesses, ORDERS, PROCESSES, dates);

  return (
    <div className="flex h-screen flex-col">
      <Header />
      <main className="flex-1 p-4 sm:p-6 lg:p-8 flex flex-col overflow-hidden">
        <Breadcrumb className="mb-4 flex-shrink-0">
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link href="/">Home</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>PAB Mode</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
        <div className="space-y-4 flex-shrink-0">
          <h1 className="text-2xl font-bold">Projected Average Balance (PAB)</h1>
          <p className="text-muted-foreground">
            Track cumulative work-in-progress for each process across all orders.
          </p>
        </div>
        <div className="flex-1 overflow-auto mt-4">
          <PabTable pabData={pabData} dates={dates} />
        </div>
      </main>
    </div>
  );
}
