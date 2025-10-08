
import type { Order, Process, TnaProcess, RampUpEntry } from './types';
import { WORK_DAY_MINUTES } from './data';
import { addDays, subDays, getDay } from 'date-fns';

// Helper to add/subtract days while skipping weekends (assuming Sat/Sun are non-working)
function addBusinessDays(startDate: Date, days: number): Date {
  let currentDate = new Date(startDate);
  let daysAdded = 0;
  const increment = days > 0 ? 1 : -1;

  while (daysAdded < Math.abs(days)) {
    currentDate.setDate(currentDate.getDate() + increment);
    const dayOfWeek = getDay(currentDate);
    // Assuming Sunday (0) and Saturday (6) are non-working days
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      daysAdded++;
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
): TnaProcess[] {

    // --- Phase 1: Calculate Durations & Batch Info ---
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
        const daysToProduceBatch = Math.ceil((processBatchSize / order.quantity) * durationDays);
        return { processId, daysToProduceBatch };
    });

    // --- Phase 2: Backward Pass (Latest Dates) ---
    const latestDates: { [key: string]: { latestStartDate: Date, latestEndDate: Date } } = {};
    let nextProcessStartDate = addDays(new Date(order.dueDate), 1); // Start from the day after due date

    [...order.processIds].reverse().forEach(pid => {
        const processMetric = metrics.find(m => m.processId === pid)!;
        const latestEndDate = subDays(nextProcessStartDate, 1); // Ends the day before the next one starts
        const latestStartDate = addBusinessDays(latestEndDate, -processMetric.durationDays + 1);

        latestDates[pid] = { latestStartDate, latestEndDate };
        nextProcessStartDate = latestStartDate;
    });

    // --- Phase 3: Forward Pass & Finalization (ASAP Plan) ---
    const finalPlan: TnaProcess[] = [];
    let previousProcessPlannedStartDate: Date | null = null;

    order.processIds.forEach((pid, index) => {
        const originalTnaProcess = order.tna?.processes.find(p => p.processId === pid)!;
        const processMetric = metrics.find(m => m.processId === pid)!;

        let plannedStartDate: Date;

        if (index === 0) { // First process
            plannedStartDate = latestDates[pid].latestStartDate;
        } else {
            const predecessorId = order.processIds[index - 1];
            const predecessorBatchMetric = batchMetrics.find(m => m.processId === predecessorId)!;
            const earliestStartDate = addBusinessDays(previousProcessPlannedStartDate!, predecessorBatchMetric.daysToProduceBatch);
            
            plannedStartDate = earliestStartDate;
        }
        
        const plannedEndDate = addBusinessDays(plannedStartDate, processMetric.durationDays - 1);
        
        finalPlan.push({
            ...originalTnaProcess,
            latestStartDate: latestDates[pid].latestStartDate,
            plannedStartDate: plannedStartDate,
            plannedEndDate: plannedEndDate,
        });

        previousProcessPlannedStartDate = plannedStartDate;
    });

    return finalPlan;
}
