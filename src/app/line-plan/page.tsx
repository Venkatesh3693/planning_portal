
'use client';

import { useMemo } from 'react';
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
import { startOfToday, addDays, getDay } from 'date-fns';
import LinePlanGanttChart from '@/components/line-plan/line-plan-gantt-chart';

export default function LinePlanPage() {
  const { sewingLineGroups, isScheduleLoaded } = useSchedule();

  const dates = useMemo(() => {
    const today = startOfToday();
    const dateArray: Date[] = [];
    let currentDate = today;
    const endDate = addDays(today, 90); // Default to 90 days for now

    while (currentDate <= endDate) {
      if (getDay(currentDate) !== 0) { // Exclude Sundays
        dateArray.push(new Date(currentDate));
      }
      currentDate = addDays(currentDate, 1);
    }
    return dateArray;
  }, []);

  if (!isScheduleLoaded) {
    return (
      <div className="flex h-screen flex-col">
        <Header />
        <main className="flex-1 flex items-center justify-center">
          <p>Loading schedule data...</p>
        </main>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col">
      <Header />
      <main className="flex-1 p-4 sm:p-6 lg:p-8 flex flex-col">
        <Breadcrumb className="mb-4 flex-shrink-0">
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link href="/">Home</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>Line Plan</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
        <div className="flex justify-between items-center mb-4 flex-shrink-0">
          <div>
            <h1 className="text-2xl font-bold">Line Plan</h1>
            <p className="text-muted-foreground">
              Visualize the production plan across sewing line groups.
            </p>
          </div>
        </div>
        <div className="flex-1 overflow-auto rounded-lg border bg-card">
          {sewingLineGroups.length > 0 ? (
            <LinePlanGanttChart rows={sewingLineGroups} dates={dates} />
          ) : (
            <div className="flex items-center justify-center h-full text-muted-foreground">
                <p>No Sewing Line Groups created yet. Go to Capacity Allocation to create SLGs.</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
