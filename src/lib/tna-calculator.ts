
import type { Order, Process, TnaProcess, RampUpEntry } from './types';
import { WORK_DAY_MINUTES } from './data';
import { addDays, subDays, getDay } from 'date-fns';

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


function calculateProcessBatchSize(order: Order, processes: Process[]): number {
    if (!order.tna) return 0;

    const sewingProcess = processes.find(p => p.id === 'sewing');
    if (!sewingProcess) return 0;

    const samSewing = sewingProcess.sam;
    
    let maxSetupRatio = 0;
    let maxSingleRunOutput = 0;

    order.processIds.forEach(pid => {
        const process = processes.find(p => p.id === pid);
        const tnaProcess = order.tna?.processes.find(tp => tp.processId === pid);

        if (process && tnaProcess) {
            const samDiff = samSewing - process.sam;
            if (samDiff > 0) {
                const ratio = tnaProcess.setupTime / samDiff;
                if (ratio > maxSetupRatio) {
                    maxSetupRatio = ratio;
                }
            }

            if (process.singleRunOutput > maxSingleRunOutput) {
                maxSingleRunOutput = process.singleRunOutput;
            }
        }
    });

    return Math.ceil(Math.max(maxSetupRatio, maxSingleRunOutput));
};

function calculateSewingDurationDays(quantity: number, sam: number, rampUpScheme: RampUpEntry[], numLines: number): number {
    if (quantity <= 0 || sam <= 0 || numLines <= 0) return 0;
    
    let remainingQty = quantity;
    let totalMinutes = 0;
    
    while (remainingQty > 0) {
        const currentProductionDay = Math.floor(totalMinutes / WORK_DAY_MINUTES) + 1;
        
        let efficiency = rampUpScheme[rampUpScheme.length - 1]?.efficiency;
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
    }
    return Math.ceil(totalMinutes / WORK_DAY_MINUTES);
};

export function generateTnaPlan(
    order: Order, 
    processes: Process[], 
    numLinesForSewing: number
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
        return { processId: pid, durationDays };
    });

    const processBatchSize = calculateProcessBatchSize(order, processes);
    const batchMetrics = metrics.map(({ processId, durationDays }) => {
        let daysToProduceBatch;
        if (order.quantity < processBatchSize) {
            daysToProduceBatch = durationDays;
        } else {
            daysToProduceBatch = Math.ceil((processBatchSize / order.quantity) * durationDays);
        }
        return { processId, daysToProduceBatch };
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
            const predecessorBatchMetric = batchMetrics.find(m => m.processId === predecessorId)!;
            currentEarliestStartDate = addBusinessDays(previousProcessStartDate!, predecessorBatchMetric.daysToProduceBatch);
        }
        earliestDates[pid] = { earliestStartDate: currentEarliestStartDate };
        previousProcessStartDate = currentEarliestStartDate;
    });

    // --- Phase 3: ALAP Calculation (Backward Pass) ---
    const latestDates: { [key: string]: { latestStartDate: Date } } = {};
    let nextProcessLatestStartDate = new Date(order.dueDate);
    
    [...order.processIds].reverse().forEach((pid, index) => {
        const isLastProcess = index === 0;
        let currentLatestStartDate: Date;

        if (isLastProcess) {
            const metric = metrics.find(m => m.processId === pid)!;
            currentLatestStartDate = subBusinessDays(nextProcessLatestStartDate, metric.durationDays);
        } else {
            const successorId = order.processIds[order.processIds.length - index];
            const successorBatchMetric = batchMetrics.find(b => b.processId === successorId)!;
            currentLatestStartDate = subBusinessDays(nextProcessLatestStartDate, successorBatchMetric.daysToProduceBatch);
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

    