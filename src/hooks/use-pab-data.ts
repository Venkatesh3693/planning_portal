
'use client';

import { useMemo } from 'react';
import type { ScheduledProcess, Order, Process } from '@/lib/types';
import { format, startOfDay, addDays, isAfter, isBefore, getDay, addMinutes } from 'date-fns';
import { WORK_DAY_MINUTES } from '@/lib/data';

export type PabData = {
  data: Record<string, Record<string, Record<string, number>>>; // { orderId: { processId: { date: pab } } }
  processSequences: Record<string, string[]>; // { orderId: [processId1, processId2, ...] }
  processDetails: Record<string, { name: string }>;
  dailyOutputs: Record<string, Record<string, Record<string, number>>>; // { orderId: { processId: { date: output } } }
  dailyInputs: Record<string, Record<string, Record<string, number>>>; // { orderId: { processId: { date: input } } }
  processStartDates: Record<string, Record<string, Date>>; // { orderId: { processId: startDate } }
  processDateRanges: Record<string, Record<string, { start: Date, end: Date }>>;
};

const INITIAL_PAB_DATA: PabData = { data: {}, processSequences: {}, processDetails: {}, dailyOutputs: {}, dailyInputs: {}, processStartDates: {}, processDateRanges: {} };


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
    const orderMap = new Map(orders.map(o => [o.id, o]));

    // --- Step A: Aggregate Daily Output & Find Date Ranges ---
    const dailyAggregatedOutput: PabData['dailyOutputs'] = {}; // { orderId: { processId: { date: output } } }
    const processDateRanges: Record<string, Record<string, { start: Date, end: Date }>> = {}; // { orderId: { processId: { start, end } } }
    
    // Tracks the current production day for each process instance (important for ramp-up)
    const processProductionDayCounter: Record<string, number> = {}; 

    for (const p of scheduledProcesses) {
      const processInfo = processMap.get(p.processId);
      const orderInfo = orderMap.get(p.orderId);
      if (!processInfo || !orderInfo) continue;

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
      
      let current = new Date(p.startDateTime);
      let remainingDuration = p.durationMinutes;
      processProductionDayCounter[p.id] = 0;

      while (remainingDuration > 0) {
        if (getDay(current) === 0) { // Skip Sundays
            current = startOfDay(addDays(current, 1));
            current.setHours(9,0,0,0);
            continue;
        }

        const endOfWorkDay = new Date(current).setHours(17, 0, 0, 0);
        const minutesLeftInCurrentTime = (endOfWorkDay - current.getTime()) / (1000 * 60);
        const minutesToProcessToday = Math.min(remainingDuration, minutesLeftInCurrentTime, WORK_DAY_MINUTES);

        if (minutesToProcessToday <= 0) {
            current = startOfDay(addDays(current, 1));
            current.setHours(9, 0, 0, 0);
            continue;
        }
        
        // This is a new production day for this specific scheduled process part
        processProductionDayCounter[p.id]++; 

        const dateKey = format(startOfDay(current), 'yyyy-MM-dd');
        
        let outputForDay = 0;
        if (processInfo.id === 'sewing') {
            const rampUpScheme = orderInfo.sewingRampUpScheme || [];
            let efficiency = rampUpScheme.length > 0 
                ? rampUpScheme[rampUpScheme.length - 1].efficiency 
                : orderInfo.budgetedEfficiency || 100;
            
            for (const entry of rampUpScheme) {
                if (processProductionDayCounter[p.id] >= entry.day) {
                    efficiency = entry.efficiency;
                }
            }
            if (efficiency > 0) {
              const effectiveSam = processInfo.sam / (efficiency / 100);
              outputForDay = minutesToProcessToday / effectiveSam;
            }
        } else {
            // For non-sewing processes, use the direct SAM calculation
            if (processInfo.sam > 0) {
                outputForDay = minutesToProcessToday / processInfo.sam;
            }
        }

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
      
      const scheduledProcessIds = new Set(Object.keys(orderProcessRanges));
      
      // Use the static sequence from the order, but only include processes that are actually scheduled.
      const staticSequence = order.processIds.filter(pid => scheduledProcessIds.has(pid));

      if (staticSequence.length === 0) continue;
      
      processSequences[order.id] = staticSequence;
      processStartDates[order.id] = {};
      staticSequence.forEach(pid => {
        if (orderProcessRanges[pid]) {
          processStartDates[order.id][pid] = orderProcessRanges[pid].start;
        }
      });

      for (let i = 0; i < staticSequence.length; i++) {
        const processId = staticSequence[i];
        const predecessorId = i > 0 ? staticSequence[i - 1] : null;

        // Skip if this process wasn't actually scheduled
        if (!processStartDates[order.id][processId]) continue;

        finalPabData[order.id][processId] = {};
        dailyInputs[order.id][processId] = {};
        const dailyOutputs = dailyAggregatedOutput[order.id]?.[processId] || {};
        
        let yesterdayPab = 0;
        let consumedInput = 0;

        for (let dateIndex = 0; dateIndex < dates.length; dateIndex++) {
          const currentDate = startOfDay(dates[dateIndex]);
          const dateKey = format(currentDate, 'yyyy-MM-dd');
          
          let inputFromPrevious = 0;
          // First process in the *static sequence* gets the full order quantity as input.
          if (i === 0) { 
              const firstScheduledDateKey = format(startOfDay(processStartDates[order.id][processId]), 'yyyy-MM-dd');
              if (dateKey === firstScheduledDateKey) {
                  inputFromPrevious = order.quantity;
              }
          } else if (predecessorId) {
             const predecessorOutputs = dailyAggregatedOutput[order.id]?.[predecessorId] || {};
              // Sum up all output from the predecessor *up to yesterday*.
              let availableInput = 0;
              for (let d_idx = 0; d_idx < dateIndex; d_idx++) {
                const prevDateKey = format(dates[d_idx], 'yyyy-MM-dd');
                availableInput += predecessorOutputs[prevDateKey] || 0;
              }
              inputFromPrevious = availableInput - consumedInput;
          }

          dailyInputs[order.id][processId][dateKey] = inputFromPrevious;
          consumedInput += inputFromPrevious;
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

    return { data: finalPabData, processSequences, processDetails, dailyOutputs: dailyAggregatedOutput, dailyInputs, processStartDates, processDateRanges };

  }, [scheduledProcesses, orders, processes, dates]);

  return pabData;
}
