
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

    // --- Step A: Aggregate Daily Output & Find Earliest Start Times ---
    const dailyAggregatedOutput: Record<string, Record<string, Record<string, number>>> = {}; // { orderId: { processId: { date: output } } }
    const earliestStartTimes: Record<string, Record<string, Date>> = {}; // { orderId: { processId: date } }

    for (const p of scheduledProcesses) {
      const processInfo = processMap.get(p.processId);
      if (!processInfo) continue;

      if (!dailyAggregatedOutput[p.orderId]) dailyAggregatedOutput[p.orderId] = {};
      if (!dailyAggregatedOutput[p.orderId][p.processId]) dailyAggregatedOutput[p.orderId][p.processId] = {};
      
      if (!earliestStartTimes[p.orderId]) earliestStartTimes[p.orderId] = {};
      if (!earliestStartTimes[p.orderId][p.processId] || p.startDateTime < earliestStartTimes[p.orderId][p.processId]) {
        earliestStartTimes[p.orderId][p.processId] = p.startDateTime;
      }

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
      const orderProcessStarts = earliestStartTimes[order.id];
      if (!orderProcessStarts) continue;

      finalPabData[order.id] = {};
      
      // Dynamically sort processes based on their actual earliest start time
      const standardProcessOrder = new Map(order.processIds.map((pid, i) => [pid, i]));
      const dynamicSequence = Object.keys(orderProcessStarts).sort((a, b) => {
          const timeA = orderProcessStarts[a].getTime();
          const timeB = orderProcessStarts[b].getTime();
          if (timeA !== timeB) return timeA - timeB;
          // Tie-break with standard process order
          return (standardProcessOrder.get(a) ?? 99) - (standardProcessOrder.get(b) ?? 99);
      });
      processSequences[order.id] = dynamicSequence;

      let previousProcessId: string | null = null;
      for (const processId of processSequences[order.id]) {
        finalPabData[order.id][processId] = {};
        const dailyOutputs = dailyAggregatedOutput[order.id]?.[processId] || {};
        
        let yesterdayPab = 0;
        for (const date of dates) {
          const dateKey = format(date, 'yyyy-MM-dd');
          
          let inputFromPrevious = 0;
          
          // The FIRST process in the DYNAMIC sequence gets the full order quantity as input.
          if (processId === dynamicSequence[0]) {
            const firstScheduledDateKey = format(orderProcessStarts[processId], 'yyyy-MM-dd');
            if (dateKey === firstScheduledDateKey) {
              inputFromPrevious = order.quantity;
            }
          } else if (previousProcessId) {
            // All other processes get input from the output of their dynamic predecessor
            const prevProcessOutputs = dailyAggregatedOutput[order.id]?.[previousProcessId] || {};
            inputFromPrevious = prevProcessOutputs[dateKey] || 0; // Input for today is output from prev process today
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
