

import type { Order, Process, TnaProcess, RampUpEntry, ScheduledProcess, SewingOperation, Size, FcComposition, FcSnapshot } from './types';
import { WORK_DAY_MINUTES, SEWING_OPERATIONS_BY_STYLE, SIZES } from './data';
import { addDays, subDays, getDay, format, startOfDay, differenceInMinutes, isBefore, isAfter } from 'date-fns';
import { calculateStartDateTime, subBusinessDays } from './utils';


// Helper to add/subtract days while skipping weekends (assuming Sun is non-working)
function addBusinessDays(startDate: Date, days: number): Date {
  let currentDate = new Date(startDate);
  let daysAdded = 0;
  const increment = days > 0 ? 1 : -1;

  // We start counting from the day after, so we iterate up to days.
  while (daysAdded < Math.abs(days)) {
    currentDate.setDate(currentDate.getDate() + increment);
    const dayOfWeek = getDay(currentDate);
    if (dayOfWeek !== 0) { // Not a Sunday
      daysAdded++;
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

export function calculateSewingDurationMinutes(quantity: number, sam: number, rampUpScheme: RampUpEntry[], numLines: number): number {
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
    return totalMinutes;
}


/**
 * Calculates the total sewing duration in days for a given quantity based on a *static* number of lines.
 * This is used for initial estimation and display on UI cards.
 */
export function calculateSewingDurationDays(quantity: number, sam: number, rampUpScheme: RampUpEntry[], numLines: number): number {
    const totalMinutes = calculateSewingDurationMinutes(quantity, sam, rampUpScheme, numLines);
    return totalMinutes === Infinity ? Infinity : Math.ceil(totalMinutes / WORK_DAY_MINUTES);
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

const calculateMoq = (process: Process, days: number, order: Order, numLines: number) => {
    if (days <= 0) return 0;
    if (process.id === 'sewing') {
        const durationMinutes = days * WORK_DAY_MINUTES;
        const peakEfficiency = (order.sewingRampUpScheme || []).reduce((max, s) => Math.max(max, s.efficiency), order.budgetedEfficiency || 85);
        if (peakEfficiency <= 0) return 0;
        const effectiveSam = process.sam / (peakEfficiency / 100);
        const outputPerMinute = (1 / effectiveSam) * numLines;
        return Math.floor(outputPerMinute * durationMinutes);
    } else {
        const totalMinutes = days * WORK_DAY_MINUTES;
        if(process.sam <= 0) return 0;
        const outputPerMinute = 1 / process.sam;
        return Math.floor(outputPerMinute * totalMinutes);
    }
};

export const getProcessBatchSize = (order: Order, processes: Process[], numLines: number): number => {
    if (!order.tna?.minRunDays) return Math.floor(order.quantity / 5) || 1;

    let maxMoq = 0;
    const preSewingAndSewingProcessIds = order.processIds.slice(0, order.processIds.indexOf('sewing') + 1);

    preSewingAndSewingProcessIds.forEach(pid => {
        const process = processes.find(p => p.id === pid)!;
        if (!process) return;
        const days = order.tna?.minRunDays?.[pid] || 1;
        const currentMoq = calculateMoq(process, days, order, numLines);
        if (currentMoq > maxMoq) {
            maxMoq = currentMoq;
        }
    });
    
    const finalBatchSize = maxMoq > order.quantity ? order.quantity : maxMoq;
    return finalBatchSize > 0 ? finalBatchSize : Math.floor(order.quantity / 5) || 1;
};

export const getPackingBatchSize = (order: Order, processes: Process[]): number => {
    if (!order.tna?.minRunDays) return Math.floor(order.quantity / 5) || 1;

    const packingProcess = processes.find(p => p.id === 'packing');
    if (!packingProcess) return Math.floor(order.quantity / 5) || 1;
    
    const days = order.tna.minRunDays['packing'] || 1;
    const moq = calculateMoq(packingProcess, days, order, 1); // numLines is 1 for packing

    const finalBatchSize = moq > order.quantity ? order.quantity : moq;
    return finalBatchSize > 0 ? finalBatchSize : Math.floor(order.quantity / 5) || 1;
};


import { PROCESSES } from './data';

export function generateTnaPlan(
    order: Order, 
    processes: Process[], 
    numLinesForSewing: number,
    processBatchSize: number,
): TnaProcess[] {
    if (!order.dueDate) { // For forecasted orders, return empty TNA
        return order.tna?.processes.map(p => ({...p, durationDays: undefined, earliestStartDate: undefined, latestStartDate: undefined })) || [];
    }

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

    // --- Phase 3: ALAP Calculation (Backward Pass) using new logic ---
    const latestDates: { [key: string]: { latestStartDate: Date } } = {};
    const sewingAnchorDate = calculateLatestSewingStartDate(order, processes, numLinesForSewing);

    if (sewingAnchorDate) {
        // --- Calculate for Sewing ---
        latestDates['sewing'] = { latestStartDate: sewingAnchorDate };

        // --- Calculate for Post-Sewing (e.g., Packing) ---
        const sewingProcessIndex = order.processIds.indexOf('sewing');
        if (sewingProcessIndex !== -1) {
            for (let i = sewingProcessIndex + 1; i < order.processIds.length; i++) {
                const pid = order.processIds[i];
                const packingBatchSize = getPackingBatchSize(order, processes);
                
                // For TNA, we estimate daily output statically as we don't have a live schedule.
                const sewingProcess = processes.find(p => p.id === 'sewing')!;
                const peakEfficiency = (order.sewingRampUpScheme || []).reduce((max, s) => Math.max(max, s.efficiency), order.budgetedEfficiency || 85);
                const effectiveSam = sewingProcess.sam / (peakEfficiency / 100);
                const dailyStaticOutput = (WORK_DAY_MINUTES / effectiveSam) * numLinesForSewing;

                if (packingBatchSize > 0 && dailyStaticOutput > 0) {
                    const daysForFirstBatch = Math.ceil(packingBatchSize / dailyStaticOutput);
                    const packingLatestStartDate = addBusinessDays(sewingAnchorDate, daysForFirstBatch);
                    latestDates[pid] = { latestStartDate: packingLatestStartDate };
                }
            }
        }
        
        // --- Calculate for Pre-Sewing ---
        let predecessorAnchor = sewingAnchorDate;
        for (let i = sewingProcessIndex - 1; i >= 0; i--) {
            const pid = order.processIds[i];
            const process = processes.find(p => p.id === pid)!;
            const batchDurationDays = calculateDaysToProduceBatch(process, processBatchSize, order, numLinesForSewing);
            
            const currentLatestStartDate = subBusinessDays(predecessorAnchor, batchDurationDays);
            latestDates[pid] = { latestStartDate: currentLatestStartDate };
            predecessorAnchor = currentLatestStartDate;
        }
    } else {
      // Fallback for if sewing anchor can't be calculated (shouldn't happen)
       let nextProcessLatestStartDate: Date | null = null;
        [...order.processIds].reverse().forEach((pid) => {
            const metric = metrics.find(m => m.processId === pid)!;
            let currentLatestStartDate: Date;

            if (nextProcessLatestStartDate === null) {
                currentLatestStartDate = subBusinessDays(new Date(order.dueDate!), metric.durationDays);
            } else {
                const currentProcessMetric = metrics.find(m => m.processId === pid)!;
                currentLatestStartDate = subBusinessDays(nextProcessLatestStartDate, currentProcessMetric.daysToProduceBatch);
            }
            latestDates[pid] = { latestStartDate: currentLatestStartDate };
            nextProcessLatestStartDate = currentLatestStartDate;
        });
    }
    
    // --- Finalization ---
    const newTna: TnaProcess[] = order.processIds.map(pid => {
        const originalTnaProcess = order.tna?.processes.find(p => p.processId === pid)!;
        const processMetric = metrics.find(m => m.processId === pid)!;
        return {
            ...originalTnaProcess,
            durationDays: processMetric.durationDays,
            earliestStartDate: earliestDates[pid]?.earliestStartDate,
            latestStartDate: latestDates[pid]?.latestStartDate,
        };
    });

    return newTna;
}


export function calculateLatestSewingStartDate(order: Order, allProcesses: Process[], numLines: number): Date | null {
    if (!order.dueDate) return null; // Cannot calculate for forecasted orders
    const packingProcess = allProcesses.find(p => p.id === 'packing');
    const sewingProcess = allProcesses.find(p => p.id === 'sewing');
    if (!packingProcess || !sewingProcess) return null;

    // Step 1: Determine the Final Packing Batch
    const packingBatchSize = getPackingBatchSize(order, allProcesses);
    const totalQty = order.quantity;
    const finalBatchQty = totalQty % packingBatchSize;
    const lastBatchQuantity = finalBatchQty === 0 ? (totalQty > 0 ? packingBatchSize : 0) : finalBatchQty;

    if (lastBatchQuantity <= 0) return null;

    // Step 2: Calculate the Duration of the Final Packing Task
    const finalPackingDurationMinutes = lastBatchQuantity * packingProcess.sam;

    // Step 3: Find the Critical Sewing Deadline
    const sewingFinishDeadline = calculateStartDateTime(order.dueDate, finalPackingDurationMinutes);

    // Step 4: Calculate the Total Duration of the Entire Sewing Process
    const totalSewingDurationMinutes = calculateSewingDurationMinutes(order.quantity, sewingProcess.sam, order.sewingRampUpScheme || [], numLines);
    if (totalSewingDurationMinutes === Infinity) return null;
    
    // Step 5: Calculate the Final Latest Sewing Start Date
    const latestStartDate = calculateStartDateTime(sewingFinishDeadline, totalSewingDurationMinutes);

    return latestStartDate;
}

export type TrackerRun = {
  runNumber: number;
  startWeek: string;
  endWeek: string;
  quantity: number;
  lines: number;
  offset: number;
};

export type ModelPlanData = {
    poFc: Record<string, number>;
    fgci: Record<string, number>;
    plan: Record<string, number>;
    produced: Record<string, number>;
};

export type CcWisePlanResult = {
    weeklyDemand: Record<string, number>;
    producedData: Record<string, number>;
    planData: Record<string, number>;
    modelData: Record<string, ModelPlanData>;
    allWeeks: string[];
    fgciData: Record<string, number>;
    trackerData: TrackerRun[];
};

type RunCcWisePlanArgs = {
    ordersForCc: Order[];
    snapshotWeek: number;
    producedData: Record<string, number>;
};

const calculateModelFgci = (
    weeks: string[],
    demand: Record<string, number>,
    plan: Record<string, number>,
    produced: Record<string, number>
): Record<string, number> => {
    const fgci: Record<string, number> = {};
    let lastWeekPci = 0;

    for (const week of weeks) {
        const weekNum = parseInt(week.replace('W',''));
        const prevWeek = `W${weekNum-1}`;
        
        const producedPrevWeek = produced[prevWeek] || 0;
        const planPrevWeek = plan[prevWeek] || 0;
        const demandThisWeek = demand[week] || 0;
        
        const currentPci = lastWeekPci + producedPrevWeek + planPrevWeek - demandThisWeek;

        fgci[week] = currentPci;
        lastWeekPci = currentPci;
    }
    return fgci;
};


export const runCcWisePlan = ({
    ordersForCc,
    snapshotWeek,
    producedData,
}: RunCcWisePlanArgs): CcWisePlanResult | null => {
    if (ordersForCc.length === 0) return null;
    
    // 1. Aggregate CC-level demand from the specific snapshot
    const weeklyDemand: Record<string, number> = {};
    ordersForCc.forEach(order => {
        const snapshot = order.fcVsFcDetails?.find(s => s.snapshotWeek === snapshotWeek);
        if (!snapshot) return;
        Object.entries(snapshot.forecasts).forEach(([week, data]) => {
            const weeklyTotal = (data.total?.po || 0) + (data.total?.fc || 0);
            weeklyDemand[week] = (weeklyDemand[week] || 0) + weeklyTotal;
        });
    });

    // 2. Set up week range for display
    const firstSnapshotWeek = ordersForCc.reduce((min, o) => {
        const orderMin = o.fcVsFcDetails?.reduce((m, s) => Math.min(m, s.snapshotWeek), Infinity) ?? Infinity;
        return Math.min(min, orderMin);
    }, Infinity);

    const allDemandWeeks = new Set<string>();
    ordersForCc.forEach(order => order.fcVsFcDetails?.forEach(s => Object.keys(s.forecasts).forEach(w => allDemandWeeks.add(w))));
    const demandWeeksNums = Array.from(allDemandWeeks).map(w => parseInt(w.slice(1))).sort((a,b)=>a-b);
    const sortedWeeks: string[] = [];
    if (demandWeeksNums.length > 0) {
        const lastDemandWeek = demandWeeksNums[demandWeeksNums.length - 1];
        for(let w = firstSnapshotWeek; w <= lastDemandWeek; w++) {
            sortedWeeks.push(`W${w}`);
        }
    }
    
    // 3. Calculate initial inventory for the CC plan based on *all* production before the snapshot week
    let ccOpeningInventory = 0;
    let ccLastWeekPci = 0;
    for(const week of sortedWeeks) {
      if (parseInt(week.slice(1)) >= snapshotWeek) break;
      const prevWeekNum = parseInt(week.slice(1)) - 1;
      const prevWeekKey = `W${prevWeekNum}`;
      
      const producedPrev = producedData[prevWeekKey] || 0;
      const demandCurrent = weeklyDemand[week] || 0;
      
      const currentPci = ccLastWeekPci + producedPrev - demandCurrent;
      ccLastWeekPci = currentPci;
    }
    ccOpeningInventory = ccLastWeekPci;


    // 4. Run CC-level planning
    const { runs: trackerData, plan: planData } = runTentativePlanForHorizon(snapshotWeek, null, weeklyDemand, ordersForCc[0], ccOpeningInventory, producedData);

    // 5. Prepare model-wise data structures
    const newModelData: Record<string, ModelPlanData> = {};
    ordersForCc.forEach(order => {
        const snapshot = order.fcVsFcDetails?.find(s => s.snapshotWeek === snapshotWeek);
        const modelPoFc: Record<string, number> = {};
        if (snapshot) {
            sortedWeeks.forEach(week => {
                const weekForecast = snapshot.forecasts[week];
                let totalModelDemand = 0;
                if(weekForecast) {
                    SIZES.forEach(size => {
                        totalModelDemand += weekForecast[size]?.po || 0;
                        totalModelDemand += weekForecast[size]?.fc || 0;
                    })
                }
                modelPoFc[week] = totalModelDemand;
            });
        }
        newModelData[order.id] = { poFc: modelPoFc, fgci: {}, plan: {}, produced: {} };
    });

    // 6. Allocate historical CC production to models proportionally
    const producedWeeks = Object.keys(producedData).sort((a, b) => parseInt(a.slice(1)) - parseInt(b.slice(1)));

    for(const prodWeek of producedWeeks) {
        const prodQty = producedData[prodWeek];
        if (prodQty <= 0) continue;

        let totalDemandForWeek = 0;
        ordersForCc.forEach(order => {
            totalDemandForWeek += newModelData[order.id]?.poFc?.[prodWeek] || 0;
        });

        if (totalDemandForWeek > 0) {
            ordersForCc.forEach(order => {
                const modelDemand = newModelData[order.id]?.poFc?.[prodWeek] || 0;
                const proportion = modelDemand / totalDemandForWeek;
                const allocatedQty = Math.round(prodQty * proportion);
                newModelData[order.id].produced[prodWeek] = (newModelData[order.id].produced[prodWeek] || 0) + allocatedQty;
            });
        } else {
             let bestModelId = '';
             let minFgci = Infinity;
             for (const order of ordersForCc) {
                const tempModelProduced = { ...newModelData[order.id].produced };
                const modelDemand = newModelData[order.id].poFc;
                const projectedFgci = calculateModelFgci(sortedWeeks, modelDemand, {}, tempModelProduced);
                const fgciForComparison = projectedFgci[prodWeek] || 0;
                if (fgciForComparison < minFgci) {
                    minFgci = fgciForComparison;
                    bestModelId = order.id;
                }
            }
            if (bestModelId) {
                newModelData[bestModelId].produced[prodWeek] = (newModelData[bestModelId].produced[prodWeek] || 0) + prodQty;
            }
        }
    }


    // 7. Allocate CC plan to models
    const modelPlanAllocation: Record<string, Record<string, number>> = {};
    ordersForCc.forEach(order => modelPlanAllocation[order.id] = {});

    const ccPlanWeeks = Object.keys(planData).sort((a, b) => parseInt(a.slice(1)) - parseInt(b.slice(1)));
    
    for (const planWeek of ccPlanWeeks) {
        const planQty = planData[planWeek];
        if (planQty <= 0) continue;

        let bestModelId = '';
        let minFgci = Infinity;

        for (const order of ordersForCc) {
            const modelDemand = newModelData[order.id].poFc;
            const modelProduced = newModelData[order.id].produced;
            const tempModelPlan = { ...modelPlanAllocation[order.id] };
            
            const projectedFgci = calculateModelFgci(sortedWeeks, modelDemand, tempModelPlan, modelProduced);
            
            let lookaheadWeek = planWeek;
            for (let w = parseInt(planWeek.slice(1)); w <= parseInt(sortedWeeks[sortedWeeks.length-1].slice(1)); w++) {
                 if((modelDemand[`W${w}`] || 0) > 0) {
                     lookaheadWeek = `W${w}`;
                     break;
                 }
            }
            const fgciForComparison = projectedFgci[lookaheadWeek] || 0;

            if (fgciForComparison < minFgci) {
                minFgci = fgciForComparison;
                bestModelId = order.id;
            }
        }
        if (bestModelId) {
            modelPlanAllocation[bestModelId][planWeek] = (modelPlanAllocation[bestModelId][planWeek] || 0) + planQty;
        }
    }

    // 8. Set final model data and calculate FGCI for all models
    ordersForCc.forEach(order => {
        newModelData[order.id].plan = modelPlanAllocation[order.id];
        const finalFgci = calculateModelFgci(
            sortedWeeks, 
            newModelData[order.id].poFc, 
            newModelData[order.id].plan, 
            newModelData[order.id].produced
        );
        newModelData[order.id].fgci = finalFgci;
    });

    // 9. Calculate final CC-level FGCI
    const fgciData: Record<string, number> = {};
    let lastWeekPci = 0;
    for (const week of sortedWeeks) {
        const weekNum = parseInt(week.replace('W',''));
        const prevWeek = `W${weekNum-1}`;

        const producedPrev = producedData[prevWeek] || 0;
        const planPrev = planData[prevWeek] || 0;
        const demandThisWeek = weeklyDemand[week] || 0;
        
        const currentPci = lastWeekPci + producedPrev + planPrev - demandThisWeek;
        fgciData[week] = currentPci;
        lastWeekPci = currentPci;
    }

    return {
        weeklyDemand,
        producedData,
        planData,
        modelData: newModelData,
        allWeeks: sortedWeeks,
        fgciData,
        trackerData,
    };
};

export const runTentativePlanForHorizon = (
    simulationStartDate: number,
    endWeek: number | null,
    weeklyDemand: Record<string, number>,
    order: Order,
    initialInventory: number = 0,
    producedData: Record<string, number> = {}
): { runs: TrackerRun[]; plan: Record<string, number> } => {
    const allDemandWeeks = Object.keys(weeklyDemand).sort((a, b) => parseInt(a.slice(1)) - parseInt(b.slice(1)));
    
    let inventory = initialInventory;
    let finalPlan: Record<string, number> = {};
    let finalRuns: TrackerRun[] = [];
    let runCounter = 1;
    let lastRunEndWeek = simulationStartDate - 1;

    while (lastRunEndWeek < (endWeek || 52)) {
        const firstPoFcWeekStr = allDemandWeeks.find(w => (weeklyDemand[w] || 0) > 0);
        if (!firstPoFcWeekStr) break;

        const firstPoFcWeek = parseInt(firstPoFcWeekStr.slice(1));
        const earliestProductionStartWeek = firstPoFcWeek - 3;
        
        const ghostPlanStartDate = earliestProductionStartWeek - 1;
        const ghostPlanResult = runSingleScenarioPlan(ghostPlanStartDate, null, weeklyDemand, order, 0, {}, false);
        const firstGhostPlanWeekStr = Object.keys(ghostPlanResult.plan).find(w => ghostPlanResult.plan[w] > 0);
        const baselineProductionStartWeek = firstGhostPlanWeekStr ? parseInt(firstGhostPlanWeekStr.slice(1)) : firstPoFcWeek;


        if (simulationStartDate < baselineProductionStartWeek) { // On-Time or Intermediate Planning
            let keepLooping = true;
            let numberOfLines = 1;
            while(keepLooping) {
                 const { runs, plan, inventory: finalInventory } = runSingleScenarioPlan(simulationStartDate, endWeek, weeklyDemand, order, initialInventory, producedData, true, numberOfLines);
                 const singleRun = runs[0];
                 if(!singleRun) { keepLooping = false; break; }

                 const requiredOffset = firstPoFcWeek - parseInt(singleRun.startWeek.slice(1));

                 if(requiredOffset <= 3) {
                     finalRuns = runs;
                     finalPlan = plan;
                     inventory = finalInventory;
                     keepLooping = false;
                 } else {
                     numberOfLines++;
                 }
                 if(numberOfLines > 100) keepLooping = false;
            }
        } else { // Late Planning
            let keepLooping = true;
            let numberOfLines = 1;
             while(keepLooping) {
                const { runs, plan, inventory: finalInventory } = runSingleScenarioPlan(simulationStartDate, endWeek, weeklyDemand, order, initialInventory, producedData, false, numberOfLines);
                const minInventory = Object.values(finalInventory).reduce((min, val) => Math.min(min, val), Infinity);
                
                if (minInventory >= 0 || numberOfLines > 100) {
                     finalRuns = runs;
                     finalPlan = plan;
                     inventory = finalInventory;
                     keepLooping = false;
                } else {
                    numberOfLines++;
                }
            }
        }

        if (finalRuns.length > 0) {
            const lastRun = finalRuns[finalRuns.length - 1];
            lastRunEndWeek = parseInt(lastRun.endWeek.slice(1));
        } else {
            break; // No more runs could be generated
        }
         if (runCounter > 20) break; // Safety break
    }

    return { runs: finalRuns, plan: finalPlan };
};


const runSingleScenarioPlan = (
    simulationStartDate: number,
    endWeek: number | null,
    weeklyDemand: Record<string, number>,
    order: Order,
    initialInventory: number = 0,
    producedData: Record<string, number> = {},
    useOffsetLogic: boolean,
    lines: number,
): { runs: TrackerRun[], plan: Record<string, number>, inventory: any } => {
    const allDemandWeeks = Object.keys(weeklyDemand).sort((a, b) => parseInt(a.slice(1)) - parseInt(b.slice(1)));
    
    const obData: SewingOperation[] = SEWING_OPERATIONS_BY_STYLE[order.style] || [];
    if (!obData || obData.length === 0) return { runs: [], plan: {}, inventory: {} };

    const totalSam = obData.reduce((sum, op) => sum + op.sam, 0);
    const totalTailors = obData.reduce((sum, op) => sum + op.operators, 0);
    const budgetedEfficiency = order.budgetedEfficiency || 85;
    const maxWeeklyOutput = (WORK_DAY_MINUTES * 6 * totalTailors * lines * (budgetedEfficiency / 100)) / totalSam;

    const finalPlan: Record<string, number> = {};
    const finalRuns: TrackerRun[] = [];
    let runCounter = 1;

    let inventoryByWeek: Record<string, number> = {};
    let lastWeekInventory = initialInventory;
    
    let processedDemandUpToWeek = simulationStartDate - 1;

    while (processedDemandUpToWeek < (endWeek || 52)) {
        const nextDemandWeekStr = allDemandWeeks.find(w => {
            const weekNum = parseInt(w.slice(1));
            return weekNum > processedDemandUpToWeek && (weeklyDemand[w] || 0) > 0;
        });
        if (!nextDemandWeekStr) break;

        const runDemandStartWeek = parseInt(nextDemandWeekStr.slice(1));
        let runDemandEndWeek = runDemandStartWeek;
        let zeroDemandStreak = 0;
        for (let w = runDemandStartWeek; w <= (endWeek || 52); w++) {
            const weekKey = `W${w}`;
            if ((weeklyDemand[weekKey] || 0) > 0) {
                runDemandEndWeek = w;
                zeroDemandStreak = 0;
            } else {
                zeroDemandStreak++;
            }
            if (zeroDemandStreak >= 4) break;
        }

        let runNetDemand = 0;
        let minProjectedInventory = lastWeekInventory;
        
        let tempInventory = lastWeekInventory;
        for (let w = processedDemandUpToWeek + 1; w <= runDemandEndWeek; w++) {
            const weekKey = `W${w}`;
            const prevWeekKey = `W${w-1}`;
            const supplyPrevWeek = (producedData[prevWeekKey] || 0) + (finalPlan[prevWeekKey] || 0);
            const demandThisWeek = weeklyDemand[weekKey] || 0;
            
            tempInventory = tempInventory + supplyPrevWeek - demandThisWeek;
            minProjectedInventory = Math.min(minProjectedInventory, tempInventory);
        }
        runNetDemand = Math.max(0, -minProjectedInventory);
        
        if (runNetDemand > 0) {
            let planStartWeekNum = runDemandStartWeek;
            let offset = 0;
            if(useOffsetLogic) {
                const requiredOffset = Math.ceil(runNetDemand / maxWeeklyOutput);
                planStartWeekNum = Math.max(simulationStartDate, runDemandStartWeek - requiredOffset);
                offset = runDemandStartWeek - planStartWeekNum;
            }

            const weeksToProduce = Math.ceil(runNetDemand / maxWeeklyOutput);
            const planEndWeekNum = planStartWeekNum + weeksToProduce - 1;
            
            finalRuns.push({
                runNumber: runCounter++,
                startWeek: `W${planStartWeekNum}`,
                endWeek: `W${planEndWeekNum}`,
                lines: lines,
                offset: offset,
                quantity: Math.round(runNetDemand),
            });

            let remainingQtyToPlan = runNetDemand;
            for (let w = planStartWeekNum; w <= planEndWeekNum; w++) {
                const weekKey = `W${w}`;
                const planQty = Math.min(remainingQtyToPlan, maxWeeklyOutput);
                finalPlan[weekKey] = (finalPlan[weekKey] || 0) + Math.round(planQty);
                remainingQtyToPlan -= planQty;
            }
        }
        processedDemandUpToWeek = runDemandEndWeek;
    }
    
    // Final inventory calculation
    const allPlanAndDemandWeeks = new Set([...Object.keys(finalPlan), ...Object.keys(weeklyDemand)]);
    const sortedWeeks = Array.from(allPlanAndDemandWeeks).map(w => parseInt(w.slice(1))).sort((a,b) => a-b);

    if (sortedWeeks.length > 0) {
        lastWeekInventory = initialInventory;
        for (let w = sortedWeeks[0]; w <= sortedWeeks[sortedWeeks.length-1]; w++) {
            const weekKey = `W${w}`;
            const prevWeekKey = `W${w-1}`;
            const supplyPrevWeek = (producedData[prevWeekKey] || 0) + (finalPlan[prevWeekKey] || 0);
            const demandThisWeek = weeklyDemand[weekKey] || 0;
            
            const currentInventory = lastWeekInventory + supplyPrevWeek - demandThisWeek;
            inventoryByWeek[weekKey] = currentInventory;
            lastWeekInventory = currentInventory;
        }
    }

    return { runs: finalRuns, plan: finalPlan, inventory: inventoryByWeek };
};
    
