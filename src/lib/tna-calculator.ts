

import type { Order, Process, TnaProcess, RampUpEntry, ScheduledProcess } from './types';
import { WORK_DAY_MINUTES } from './data';
import { addDays, subDays, getDay, format, startOfDay, differenceInMinutes, isBefore, isAfter } from 'date-fns';

// Helper to add/subtract days while skipping weekends (assuming Sun is non-working)
function addBusinessDays(startDate: Date, days: number): Date {
  let currentDate = new Date(startDate);
  let daysAdded = 0;
  const increment = days > 0 ? 1 : -1;

  while (daysAdded < Math.abs(days)) {
    currentDate.setDate(currentDate.getDate() + increment);
    const dayOfWeek = getDay(currentDate);
    if (dayOfWeek !== 0) { // Assuming only Sunday (0) is a non-working day
      daysAdded++;
    }
  }
  return currentDate;
}

function subBusinessDays(startDate: Date, days: number): Date {
    let currentDate = new Date(startDate);
    let daysSubtracted = 0;

    while(daysSubtracted < days) {
        currentDate.setDate(currentDate.getDate() - 1);
        const dayOfWeek = getDay(currentDate);
        if (dayOfWeek !== 0) {
            daysSubtracted++;
        }
    }
    return currentDate;
}


function calculateDaysToProduceBatch(
    process: Process,
    processBatchSize: number,
    order: Order,
    numLines: number
): number {
    if (process.id === 'sewing') {
        // This is now an approximation for the TNA card, not for PAB/unplanned batches
        return calculateSewingDurationDays(processBatchSize, process.sam, order.sewingRampUpScheme || [], numLines);
    }
    const totalMinutes = processBatchSize * process.sam;
    return Math.ceil(totalMinutes / WORK_DAY_MINUTES);
};

/**
 * Calculates the total sewing duration in days for a given quantity based on a *static* number of lines.
 * This is used for initial estimation and display on UI cards.
 */
export function calculateSewingDurationDays(quantity: number, sam: number, rampUpScheme: RampUpEntry[], numLines: number): number {
    if (quantity <= 0 || sam <= 0 || numLines <= 0) return 0;
    
    let remainingQty = quantity;
    let totalMinutes = 0;
    
    while (remainingQty > 0) {
        const currentProductionDay = Math.floor(totalMinutes / WORK_DAY_MINUTES) + 1;
        
        let efficiency = rampUpScheme.length > 0 ? rampUpScheme[rampUpScheme.length - 1]?.efficiency : 100;
        for (const entry of rampUpScheme) {
          if(currentProductionDay >= entry.day) {
            efficiency = entry.efficiency;
          }
        }
        
        if (!efficiency || efficiency <= 0) return Infinity;

        const effectiveSam = sam / (efficiency / 100);
        const outputPerMinute = (1 / effectiveSam) * numLines;
        
        const minutesLeftInWorkDay = WORK_DAY_MINUTES - (totalMinutes % WORK_DAY_MINUTES);
        const maxOutputForRestOfDay = minutesLeftInWorkDay * outputPerMinute;

        if (remainingQty <= maxOutputForRestOfDay) {
            totalMinutes += remainingQty / outputPerMinute;
            remainingQty = 0;
        } else {
            totalMinutes += minutesLeftInWorkDay;
            remainingQty -= maxOutputForRestOfDay;
        }

        if (totalMinutes > WORK_DAY_MINUTES * 10000) {
            return Infinity;
        }
    }
    return Math.floor(totalMinutes / WORK_DAY_MINUTES);
};

/**
 * NEW: Centralized utility to calculate the actual sewing output for each day based on the live Gantt schedule.
 * This logic is extracted from the PAB hook to be reusable.
 */
export function calculateDailySewingOutput(
    order: Order,
    allSewingProcessesForOrder: ScheduledProcess[],
    processInfo: Process
): Record<string, number> {
    const dailyOutput: Record<string, number> = {};
    const processProductionDayCounter: Record<string, number> = {}; // Tracks ramp-up day per scheduled instance

    for (const p of allSewingProcessesForOrder) {
        if (!processProductionDayCounter[p.id]) processProductionDayCounter[p.id] = 0;

        let current = new Date(p.startDateTime);
        let remainingDuration = p.durationMinutes;

        while (remainingDuration > 0) {
            if (getDay(current) === 0) { // Skip Sundays
                current = startOfDay(addDays(current, 1));
                current.setHours(9, 0, 0, 0);
                continue;
            }

            const endOfWorkDay = new Date(current).setHours(17, 0, 0, 0);
            const minutesLeftInCurrentTime = differenceInMinutes(endOfWorkDay, current);
            const minutesToProcessToday = Math.min(remainingDuration, minutesLeftInCurrentTime, WORK_DAY_MINUTES);

            if (minutesToProcessToday <= 0) {
                current = startOfDay(addDays(current, 1));
                current.setHours(9, 0, 0, 0);
                continue;
            }

            processProductionDayCounter[p.id]++;
            const dateKey = format(startOfDay(current), 'yyyy-MM-dd');

            const rampUpScheme = order.sewingRampUpScheme || [];
            let efficiency = rampUpScheme.length > 0 ? rampUpScheme[rampUpScheme.length - 1].efficiency : order.budgetedEfficiency || 100;
            
            for (const entry of rampUpScheme) {
                if (processProductionDayCounter[p.id] >= entry.day) {
                    efficiency = entry.efficiency;
                }
            }

            let outputForDay = 0;
            if (efficiency > 0) {
                const effectiveSam = processInfo.sam / (efficiency / 100);
                outputForDay = minutesToProcessToday / effectiveSam;
            }

            dailyOutput[dateKey] = (dailyOutput[dateKey] || 0) + outputForDay;
            remainingDuration -= minutesToProcessToday;
            current = new Date(current.getTime() + minutesToProcessToday * 60000);
        }
    }
    return dailyOutput;
}

/**
 * NEW: Calculates how many days it takes to produce a target quantity,
 * given a map of dynamic daily outputs.
 */
export function getSewingDaysForQuantity(
    targetQuantity: number,
    dailyOutputMap: Record<string, number>,
    startDate: Date
): number {
    if (targetQuantity <= 0) return 0;
    
    const totalAvailableOutput = Object.values(dailyOutputMap).reduce((sum, output) => sum + output, 0);
    if(totalAvailableOutput === 0) return Infinity;


    const sortedDates = Object.keys(dailyOutputMap).sort((a, b) => new Date(a).getTime() - new Date(b).getTime());
    let quantityProduced = 0;
    let daysCounted = 0;
    let currentDate = new Date(startDate);

    while (quantityProduced < targetQuantity) {
        const dateKey = format(currentDate, 'yyyy-MM-dd');
        const outputToday = dailyOutputMap[dateKey] || 0;
        
        quantityProduced += outputToday;
        daysCounted++;

        // If we still haven't produced enough, move to the next day
        if (quantityProduced < targetQuantity) {
            const currentIndex = sortedDates.indexOf(dateKey);
            if (currentIndex + 1 < sortedDates.length) {
                // This logic is complex, for now, just increment day by day
                 currentDate = addBusinessDays(currentDate, 1);
            } else {
                // If we run out of scheduled days, it will take "infinite" time based on schedule.
                // A better approach might be to extrapolate using peak efficiency.
                // For now, let's break to avoid infinite loop.
                return daysCounted + 1; // Approximate
            }
        }
         if(daysCounted > 1000) return Infinity; // Safety break
    }

    return daysCounted;
}



export const calculateProcessBatchSize = (order: Order, numLines: number, forProcessId?: string): number => {
    if (!order.tna?.minRunDays) return order.quantity / 5;

    let maxMoq = 0;
    
    const processesToConsider = forProcessId ? [forProcessId] : order.processIds.slice(0, order.processIds.indexOf('sewing') + 1);

    processesToConsider.forEach((processId) => {
        const process = PROCESSES.find(p => p.id === processId)!;
        if (!process) return;

        const days = order.tna?.minRunDays?.[process.id] || 1;
        let currentMoq = 0;

        if (days > 0) {
            if (process.id === 'sewing') {
                const durationMinutes = days * WORK_DAY_MINUTES;
                const peakEfficiency = (order.sewingRampUpScheme || []).reduce((max, s) => Math.max(max, s.efficiency), order.budgetedEfficiency || 85);
                const effectiveSam = process.sam / (peakEfficiency / 100);
                const outputPerMinute = (1 / effectiveSam) * numLines;
                currentMoq = Math.floor(outputPerMinute * durationMinutes);
            } else {
                const totalMinutes = days * WORK_DAY_MINUTES;
                const outputPerMinute = 1 / process.sam;
                currentMoq = Math.floor(outputPerMinute * totalMinutes);
            }
        }

        if (currentMoq > maxMoq) {
            maxMoq = currentMoq;
        }
    });
    
    const finalBatchSize = maxMoq > order.quantity ? order.quantity : maxMoq;

    return finalBatchSize > 0 ? finalBatchSize : order.quantity / 5; // Fallback
};

import { PROCESSES } from './data';

export function generateTnaPlan(
    order: Order, 
    processes: Process[], 
    numLinesForSewing: number,
    processBatchSize: number,
): { newTna: TnaProcess[], newCkDate: Date } {

    // --- Phase 1: Calculate Durations ---
    const metrics = order.processIds.map(pid => {
        const process = processes.find(p => p.id === pid)!;
        let durationDays;
        if (pid === 'sewing') {
            durationDays = calculateSewingDurationDays(order.quantity, process.sam, order.sewingRampUpScheme || [], numLinesForSewing);
        } else {
            const totalMinutes = order.quantity * process.sam;
            durationDays = Math.ceil(totalMinutes / WORK_DAY_MINUTES);
        }
        const daysToProduceBatch = calculateDaysToProduceBatch(process, processBatchSize, order, numLinesForSewing);
        return { processId: pid, durationDays, daysToProduceBatch };
    });

    // --- Phase 2: ASAP Calculation (Forward Pass) ---
    // First, find the critical path latest start date (Finish-to-Start) to anchor our ASAP plan
    let ftsLatestStartDateAnchor = new Date(order.dueDate);
    [...order.processIds].reverse().forEach(pid => {
        const metric = metrics.find(m => m.processId === pid)!;
        ftsLatestStartDateAnchor = subBusinessDays(ftsLatestStartDateAnchor, metric.durationDays);
    });
    
    const earliestDates: { [key: string]: { earliestStartDate: Date } } = {};
    let previousProcessStartDate: Date | null = ftsLatestStartDateAnchor;
    
    order.processIds.forEach((pid, index) => {
        let currentEarliestStartDate: Date;

        if (index === 0) {
            currentEarliestStartDate = ftsLatestStartDateAnchor;
        } else {
            const predecessorId = order.processIds[index-1];
            const predecessorBatchMetric = metrics.find(m => m.processId === predecessorId)!;
            currentEarliestStartDate = addBusinessDays(previousProcessStartDate!, predecessorBatchMetric.daysToProduceBatch);
        }
        earliestDates[pid] = { earliestStartDate: currentEarliestStartDate };
        previousProcessStartDate = currentEarliestStartDate;
    });

    // --- Phase 3: ALAP Calculation (Backward Pass) ---
    const latestDates: { [key: string]: { latestStartDate: Date } } = {};
    let nextProcessLatestStartDate: Date | null = null;
    
    [...order.processIds].reverse().forEach((pid) => {
        const metric = metrics.find(m => m.processId === pid)!;
        let currentLatestStartDate: Date;

        if (nextProcessLatestStartDate === null) {
            // This is the last process in the sequence
            currentLatestStartDate = subBusinessDays(new Date(order.dueDate), metric.durationDays);
        } else {
            // This process is a predecessor to `nextProcessLatestStartDate`
            const currentProcessMetric = metrics.find(m => m.processId === pid)!;
            currentLatestStartDate = subBusinessDays(nextProcessLatestStartDate, currentProcessMetric.daysToProduceBatch);
        }
        
        latestDates[pid] = { latestStartDate: currentLatestStartDate };
        nextProcessLatestStartDate = currentLatestStartDate;
    });
    
    // --- Finalization ---
    const newTna: TnaProcess[] = order.processIds.map(pid => {
        const originalTnaProcess = order.tna?.processes.find(p => p.processId === pid)!;
        const processMetric = metrics.find(m => m.processId === pid)!;
        return {
            ...originalTnaProcess,
            durationDays: processMetric.durationDays,
            earliestStartDate: earliestDates[pid].earliestStartDate,
            latestStartDate: latestDates[pid].latestStartDate,
        };
    });

    const newCkDate = subBusinessDays(ftsLatestStartDateAnchor, 3);

    return { newTna, newCkDate };
}
