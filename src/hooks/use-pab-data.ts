
'use client';

import { useMemo } from 'react';
import type { ScheduledProcess, Order, Process } from '@/lib/types';
import { format, startOfDay } from 'date-fns';
import { WORK_DAY_MINUTES } from '@/lib/data';

export type PabData = {
  data: Record<string, Record<string, Record<string, number>>>; // { orderId: { processId: { date: pab } } }
  processSequences: Record<string, string[]>; // { orderId: [processId1, processId2, ...] }
  processDetails: Record<string, { name: string }>;
};

const INITIAL_PAB_DATA: PabData = { data: {}, processSequences: {}, processDetails: {} };

export function usePabData(
  scheduledProcesses: ScheduledProcess[],
  orders: Order[],
  processes: Process[],
  dates: Date[]
): PabData {

  const pabData = useMemo(() => {
    if (!scheduledProcesses.length || !orders.length || !processes.length || !dates.length) {
      return INITIAL_PAB_DATA;
    }

    const processMap = new Map(processes.map(p => [p.id, p]));

    // --- Step A: Aggregate Daily Output ---
    const dailyAggregatedOutput: Record<string, Record<string, Record<string, number>>> = {}; // { orderId: { processId: { date: output } } }
    
    for (const p of scheduledProcesses) {
      const processInfo = processMap.get(p.processId);
      if (!processInfo) continue;

      if (!dailyAggregatedOutput[p.orderId]) dailyAggregatedOutput[p.orderId] = {};
      if (!dailyAggregatedOutput[p.orderId][p.processId]) dailyAggregatedOutput[p.orderId][p.processId] = {};
      
      const outputPerMinute = 1 / processInfo.sam;

      let current = new Date(p.startDateTime);
      let remainingDuration = p.durationMinutes;

      while (remainingDuration > 0 && current <= p.endDateTime) {
        const dateKey = format(current, 'yyyy-MM-dd');
        // A simple assumption for now - can be refined with working hours logic
        const minutesInDay = Math.min(remainingDuration, WORK_DAY_MINUTES); 
        
        const outputForDay = minutesInDay * outputPerMinute;

        if (!dailyAggregatedOutput[p.orderId][p.processId][dateKey]) {
          dailyAggregatedOutput[p.orderId][p.processId][dateKey] = 0;
        }
        dailyAggregatedOutput[p.orderId][p.processId][dateKey] += outputForDay;
        
        remainingDuration -= minutesInDay;
        current = startOfDay(new Date(current.getTime() + 86400000));
      }
    }
    
    // --- Step B: Calculate PAB Iteratively ---
    const finalPabData: PabData['data'] = {};
    const processSequences: PabData['processSequences'] = {};
    
    for (const order of orders) {
      const scheduledOrderProcesses = dailyAggregatedOutput[order.id];
      if (!scheduledOrderProcesses) continue; // Skip orders with no scheduled processes at all

      finalPabData[order.id] = {};
      // Filter the sequence to only include processes that have been scheduled
      processSequences[order.id] = order.processIds.filter(pid => scheduledOrderProcesses[pid]);

      let previousProcessId: string | null = null;
      for (const processId of processSequences[order.id]) {
        finalPabData[order.id][processId] = {};
        const dailyOutputs = scheduledOrderProcesses[processId] || {};
        
        let yesterdayPab = 0;
        for (const date of dates) {
          const dateKey = format(date, 'yyyy-MM-dd');
          const prevDate = new Date(date.getTime() - 86400000);
          const prevDateKey = format(prevDate, 'yyyy-MM-dd');

          let inputFromPrevious = 0;
          if (processId === 'cutting') {
            const scheduledDates = Object.keys(dailyOutputs).sort();
            if (scheduledDates.length > 0 && dateKey === scheduledDates[0]) {
              inputFromPrevious = order.quantity;
            }
          } else if (previousProcessId) {
            const prevProcessOutputs = dailyAggregatedOutput[order.id]?.[previousProcessId] || {};
            // Input for today is the output from the previous process yesterday
            inputFromPrevious = prevProcessOutputs[prevDateKey] || 0;
          }

          const outputToday = dailyOutputs[dateKey] || 0;
          
          const todayPab = yesterdayPab + inputFromPrevious - outputToday;

          // Only store and display PAB if there's a reason to (activity or remaining balance)
          if (todayPab !== 0 || yesterdayPab !== 0 || inputFromPrevious > 0 || outputToday > 0) {
            finalPabData[order.id][processId][dateKey] = todayPab;
          }
          yesterdayPab = todayPab;
        }
        previousProcessId = processId;
      }
    }
    
    const processDetails: PabData['processDetails'] = {};
    for (const p of processes) {
      processDetails[p.id] = { name: p.name };
    }

    return { data: finalPabData, processSequences, processDetails };

  }, [scheduledProcesses, orders, processes, dates]);

  return pabData;
}
