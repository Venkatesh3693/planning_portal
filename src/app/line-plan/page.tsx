
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
import { CcProdPlanner, initialAllocation, correctAllocationForNegativeFgoi } from '@/lib/tna-calculator';
import type { Order } from '@/lib/types';
import { Button } from '@/components/ui/button';


export type LinePlanRow = {
  id: string;
  name: string;
  ccNo: string;
  planData: Record<string, {
    totalPlan: number;
    models: {
        color: string;
        planQty: number;
        orderId: string;
        displayColor: string;
    }[];
  }>;
};

export default function LinePlanPage() {
  const { orders, sewingLineGroups, isScheduleLoaded, appMode } = useSchedule();

  const dates = useMemo(() => {
    const today = startOfToday();
    const dateArray: Date[] = [];
    let currentDate = today;
    const endDate = addDays(today, 90);

    while (currentDate <= endDate) {
      if (getDay(currentDate) !== 0) { // Exclude Sundays
        dateArray.push(new Date(currentDate));
      }
      currentDate = addDays(currentDate, 1);
    }
    return dateArray;
  }, []);

  const linePlanData = useMemo((): LinePlanRow[] => {
    if (!isScheduleLoaded || sewingLineGroups.length === 0) return [];
    
    return sewingLineGroups.map(slg => {
        const ordersForCc = orders.filter(o => o.ocn === slg.ccNo);
        if (ordersForCc.length === 0) {
            return { id: slg.id, name: slg.name, ccNo: slg.ccNo, planData: {} };
        }

        const latestSnapshotWeek = Math.max(
            ...ordersForCc.flatMap(o => o.fcVsFcDetails?.map(f => f.snapshotWeek) || [0])
        );

        const ccPlan = CcProdPlanner({ ordersForCc, snapshotWeek: latestSnapshotWeek, producedData: {} });
        
        const modelProduction = ccPlan.modelWiseDemand ? correctAllocationForNegativeFgoi(
          initialAllocation(ccPlan, ccPlan.modelWiseDemand, ccPlan.allWeeks),
          ccPlan.modelWiseDemand,
          ccPlan.allWeeks
        ) : {};
        
        const planData: LinePlanRow['planData'] = {};

        Object.keys(ccPlan.planData).forEach(week => {
            const totalPlan = ccPlan.planData[week];
            if (totalPlan > 0) {
                planData[week] = {
                    totalPlan: totalPlan,
                    models: Object.entries(modelProduction).map(([color, data]) => {
                        const order = orders.find(o => o.ocn === slg.ccNo && o.color === color);
                        return {
                            color: color,
                            planQty: data.plan[week] || 0,
                            orderId: order?.id || '',
                            displayColor: order?.displayColor || '#A1A1AA' // Default color
                        }
                    }).filter(m => m.planQty > 0)
                };
            }
        });

        return {
            id: slg.id,
            name: slg.name,
            ccNo: slg.ccNo,
            planData,
        };
    });

  }, [sewingLineGroups, orders, isScheduleLoaded]);

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

  if (appMode === 'gup') {
    return (
      <div className="flex h-screen flex-col">
        <Header />
        <main className="flex-1 p-4 sm:p-6 lg:p-8 flex items-center justify-center">
          <div className="text-center">
            <h2 className="text-xl font-semibold">Line Plan Not Available</h2>
            <p className="mt-2 text-muted-foreground">
              This view is only applicable for GUT mode.
            </p>
            <Button asChild className="mt-6">
              <Link href="/">View GUP Schedule</Link>
            </Button>
          </div>
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
                <Link href="/orders">Order Management</Link>
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
            <LinePlanGanttChart rows={linePlanData} dates={dates} orders={orders} />
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
