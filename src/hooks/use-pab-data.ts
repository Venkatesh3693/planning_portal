
'use client';

import { useMemo } from 'react';
import type { ScheduledProcess, Order, Process } from '@/lib/types';
import { format, startOfDay, addDays, isAfter, isBefore, getDay } from 'date-fns';
import { WORK_DAY_MINUTES } from '@/lib/data';

export type PabData = {
  data: Record<string, Record<string, Record<string, number>>>; // { orderId: { processId: { date: pab } } }
  processSequences: Record<string, string[]>; // { orderId: [processId1, processId2, ...] }
  processDetails: Record<string, { name: string }>;
  dailyOutputs: Record<string, Record<string, Record<string, number>>>; // { orderId: { processId: { date: output } } }
  dailyInputs: Record<string, Record<string, Record<string, number>>>; // { orderId: { processId: { date: input } } }
  processStartDates: Record<string, Record<string, Date>>; // { orderId: { processId: startDate } }
};

const INITIAL_PAB_DATA: PabData = { data: {}, processSequences: {}, processDetails: {}, dailyOutputs: {}, dailyInputs: {}, processStartDates: {} };

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

    // --- Step A: Aggregate Daily Output & Find Date Ranges ---
    const dailyAggregatedOutput: PabData['dailyOutputs'] = {}; // { orderId: { processId: { date: output } } }
    const processDateRanges: Record<string, Record<string, { start: Date, end: Date }>> = {}; // { orderId: { processId: { start, end } } }

    for (const p of scheduledProcesses) {
      const processInfo = processMap.get(p.processId);
      if (!processInfo) continue;

      // Initialize data structures for the order
      if (!dailyAggregatedOutput[p.orderId]) dailyAggregatedOutput[p.orderId] = {};
      if (!dailyAggregatedOutput[p.orderId][p.processId]) dailyAggregatedOutput[p.orderId][p.processId] = {};
      if (!processDateRanges[p.orderId]) processDateRanges[p.orderId] = {};
      
      // Update the date range for the process
      const currentRange = processDateRanges[p.orderId][p.processId];
      if (!currentRange) {
        processDateRanges[p.orderId][p.processId] = { start: p.startDateTime, end: p.endDateTime };
      } else {
        if (isBefore(p.startDateTime, currentRange.start)) currentRange.start = p.startDateTime;
        if (isAfter(p.endDateTime, currentRange.end)) currentRange.end = p.endDateTime;
      }
      
      const outputPerMinute = 1 / processInfo.sam;

      let current = new Date(p.startDateTime);
      let remainingDuration = p.durationMinutes;

      while (remainingDuration > 0) {
        if (getDay(current) === 0) { // Skip Sundays
            current = startOfDay(addDays(current, 1));
            continue;
        }

        const endOfWorkDay = new Date(current).setHours(17, 0, 0, 0);
        const minutesLeftInCurrentTime = (endOfWorkDay - current.getTime()) / (1000 * 60);
        const minutesToProcessToday = Math.min(remainingDuration, minutesLeftInCurrentTime);

        if (minutesToProcessToday <= 0) {
            current = startOfDay(addDays(current, 1));
            current.setHours(9, 0, 0, 0);
            continue;
        }

        const dateKey = format(startOfDay(current), 'yyyy-MM-dd');
        const outputForDay = minutesToProcessToday * outputPerMinute;
        
        dailyAggregatedOutput[p.orderId][p.processId][dateKey] = (dailyAggregatedOutput[p.orderId][p.processId][dateKey] || 0) + outputForDay;
        
        remainingDuration -= minutesToProcessToday;
        
        const newTime = addMinutes(current, minutesToProcessToday);
        current = newTime;
      }
    }
    
    // --- Step B: Calculate PAB Iteratively ---
    const finalPabData: PabData['data'] = {};
    const dailyInputs: PabData['dailyInputs'] = {};
    const processSequences: PabData['processSequences'] = {};
    const processStartDates: PabData['processStartDates'] = {};
    
    for (const order of orders) {
      const orderProcessRanges = processDateRanges[order.id];
      if (!orderProcessRanges) continue;

      finalPabData[order.id] = {};
      dailyInputs[order.id] = {};
      
      const scheduledProcessIds = Object.keys(orderProcessRanges);
      
      const standardProcessOrder = new Map(order.processIds.map((pid, i) => [pid, i]));
      const dynamicSequence = scheduledProcessIds.sort((a, b) => {
          const timeA = orderProcessRanges[a].start.getTime();
          const timeB = orderProcessRanges[b].start.getTime();
          if (timeA !== timeB) return timeA - timeB;
          return (standardProcessOrder.get(a) ?? 99) - (standardProcessOrder.get(b) ?? 99);
      });

      if (dynamicSequence.length === 0) continue;
      
      processSequences[order.id] = dynamicSequence;
      processStartDates[order.id] = {};
      dynamicSequence.forEach(pid => {
        processStartDates[order.id][pid] = orderProcessRanges[pid].start;
      });


      for (let i = 0; i < dynamicSequence.length; i++) {
        const processId = dynamicSequence[i];
        const predecessorId = i > 0 ? dynamicSequence[i - 1] : null;

        finalPabData[order.id][processId] = {};
        dailyInputs[order.id][processId] = {};
        const dailyOutputs = dailyAggregatedOutput[order.id]?.[processId] || {};
        
        let yesterdayPab = 0;
        let lastPredecessorOutputDayIndex = -1;

        for (let dateIndex = 0; dateIndex < dates.length; dateIndex++) {
          const currentDate = startOfDay(dates[dateIndex]);
          const dateKey = format(currentDate, 'yyyy-MM-dd');
          
          let inputFromPrevious = 0;
          if (i === 0) { // First process
              const firstScheduledDateKey = format(startOfDay(processStartDates[order.id][processId]), 'yyyy-MM-dd');
              if (dateKey === firstScheduledDateKey) {
                  inputFromPrevious = order.quantity;
              }
          } else if (predecessorId) {
              // Look back from yesterday to find the last working day with output
              for (let j = dateIndex - 1; j > lastPredecessorOutputDayIndex; j--) {
                  const prevDateKey = format(dates[j], 'yyyy-MM-dd');
                  const predecessorOutputs = dailyAggregatedOutput[order.id]?.[predecessorId] || {};
                  if ((predecessorOutputs[prevDateKey] || 0) > 0) {
                      inputFromPrevious += predecessorOutputs[prevDateKey];
                      lastPredecessorOutputDayIndex = j;
                  }
              }
          }

          dailyInputs[order.id][processId][dateKey] = inputFromPrevious;
          const outputToday = dailyOutputs[dateKey] || 0;
          const todayPab = yesterdayPab + inputFromPrevious - outputToday;
          
          finalPabData[order.id][processId][dateKey] = todayPab;
          yesterdayPab = todayPab;
        }
      }
    }
    
    const processDetails: PabData['processDetails'] = {};
    for (const p of processes) {
      processDetails[p.id] = { name: p.name };
    }

    return { data: finalPabData, processSequences, processDetails, dailyOutputs: dailyAggregatedOutput, dailyInputs, processStartDates };

  }, [scheduledProcesses, orders, processes, dates]);

  return pabData;
}
