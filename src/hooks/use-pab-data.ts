
'use client';

import { useMemo } from 'react';
import type { ScheduledProcess, Order, Process } from '@/lib/types';
import { format, isSameDay, startOfDay } from 'date-fns';
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
    if (!scheduledProcesses.length || !orders.length || !processes.length) {
      return INITIAL_PAB_DATA;
    }

    const processMap = new Map(processes.map(p => [p.id, p]));
    const ordersWithScheduledItems = new Set(scheduledProcesses.map(p => p.orderId));

    // --- Step A: Aggregate Daily Output ---
    const dailyAggregatedOutput: Record<string, Record<string, Record<string, number>>> = {}; // { orderId: { processId: { date: output } } }
    
    for (const p of scheduledProcesses) {
      const processInfo = processMap.get(p.processId);
      if (!processInfo) continue;

      if (!dailyAggregatedOutput[p.orderId]) dailyAggregatedOutput[p.orderId] = {};
      if (!dailyAggregatedOutput[p.orderId][p.processId]) dailyAggregatedOutput[p.orderId][p.processId] = {};
      
      // Calculate output per minute for this process on this machine
      const outputPerMinute = 1 / processInfo.sam;

      // Distribute the duration of the scheduled process across the relevant days
      let current = new Date(p.startDateTime);
      let remainingDuration = p.durationMinutes;

      while (remainingDuration > 0 && current < p.endDateTime) {
        const dateKey = format(current, 'yyyy-MM-dd');
        const minutesInDay = Math.min(remainingDuration, WORK_DAY_MINUTES); // Simple assumption for now
        
        const outputForDay = minutesInDay * outputPerMinute;

        if (!dailyAggregatedOutput[p.orderId][p.processId][dateKey]) {
          dailyAggregatedOutput[p.orderId][p.processId][dateKey] = 0;
        }
        dailyAggregatedOutput[p.orderId][p.processId][dateKey] += outputForDay;
        
        remainingDuration -= minutesInDay;
        current = startOfDay(new Date(current.getTime() + 86400000)); // Move to next day
      }
    }

    // --- Step B: Calculate PAB Iteratively ---
    const finalPabData: PabData['data'] = {};
    const processSequences: PabData['processSequences'] = {};
    
    for (const order of orders) {
      if (!ordersWithScheduledItems.has(order.id)) continue;
      
      finalPabData[order.id] = {};
      processSequences[order.id] = order.processIds.filter(pid => pid !== 'outsourcing');

      let previousProcessId: string | null = null;
      for (const processId of processSequences[order.id]) {
        finalPabData[order.id][processId] = {};
        const dailyOutputs = dailyAggregatedOutput[order.id]?.[processId] || {};
        
        let yesterdayPab = 0;
        for (const date of dates) {
          const dateKey = format(date, 'yyyy-MM-dd');
          
          let inputFromPrevious = 0;
          if (processId === 'cutting') {
            // Special case for cutting: input is the full order quantity on the first scheduled day
            const scheduledDates = Object.keys(dailyOutputs).sort();
            if (scheduledDates.length > 0 && dateKey === scheduledDates[0]) {
              inputFromPrevious = order.quantity;
            }
          } else if (previousProcessId) {
            const yesterdayKey = format(new Date(date.getTime() - 86400000), 'yyyy-MM-dd');
            const prevProcessOutputs = dailyAggregatedOutput[order.id]?.[previousProcessId] || {};
            inputFromPrevious = prevProcessOutputs[yesterdayKey] || 0;
          }

          const outputToday = dailyOutputs[dateKey] || 0;
          
          // Only calculate PAB if there is some activity (input or output)
          if (inputFromPrevious > 0 || outputToday > 0 || yesterdayPab > 0) {
            const todayPab = yesterdayPab + inputFromPrevious - outputToday;
            finalPabData[order.id][processId][dateKey] = todayPab;
            yesterdayPab = todayPab;
          } else {
             // If no activity, just carry over if it's relevant to show
             // For simplicity, we'll only show PAB on days with activity or a non-zero balance
          }
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
