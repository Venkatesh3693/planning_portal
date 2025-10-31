

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
    fgoi: Record<string, number>;
    plan: Record<string, number>;
    produced: Record<string, number>;
};

export type CcWisePlanResult = {
    weeklyDemand: Record<string, number>;
    producedData: Record<string, number>;
    planData: Record<string, number>;
    allWeeks: string[];
    fgoiData: Record<string, number>;
    productionStartWeek?: number;
    earliestProductionStartWeek?: number;
    offset?: number;
    lines?: number;
    modelWiseDemand?: Record<string, Record<string, number>>;
};

type CcProdPlannerArgs = {
    ordersForCc: Order[];
    snapshotWeek: number;
    producedData: Record<string, number>;
};

export const calculateFgoiForSingleScenario = (
    weeks: string[],
    demand: Record<string, number>,
    plan: Record<string, number>,
    produced: Record<string, number>,
    openingInventory: number
): Record<string, number> => {
    const fgoi: Record<string, number> = {};
    let lastWeekInventory = openingInventory;

    for (const week of weeks) {
        const weekNum = parseInt(week.slice(1));
        const prevWeek = `W${weekNum - 1}`;
        const producedLastWeek = produced[prevWeek] || 0;
        const planLastWeek = plan[prevWeek] || 0;
        const demandThisWeek = demand[week] || 0;
        
        const currentInventory = lastWeekInventory + producedLastWeek + planLastWeek - demandThisWeek;

        fgoi[week] = currentInventory;
        lastWeekInventory = currentInventory;
    }
    return fgoi;
};

export const CcProdPlanner = ({
    ordersForCc,
    snapshotWeek,
    producedData: initialProducedData,
}: CcProdPlannerArgs): CcWisePlanResult => {
    const weeklyDemand: Record<string, number> = {};
    const modelWiseDemand: Record<string, Record<string, number>> = {};

    const totalPoFcQty = ordersForCc.reduce((total, order) => {
        if (!modelWiseDemand[order.color]) {
            modelWiseDemand[order.color] = {};
        }
        const snapshot = order.fcVsFcDetails?.find(s => s.snapshotWeek === snapshotWeek);
        if (!snapshot) return total;
        
        let orderTotal = 0;
        Object.entries(snapshot.forecasts).forEach(([week, data]) => {
            const weekTotal = (data.total?.po || 0) + (data.total?.fc || 0);
            weeklyDemand[week] = (weeklyDemand[week] || 0) + weekTotal;
            modelWiseDemand[order.color][week] = (modelWiseDemand[order.color][week] || 0) + weekTotal;
            orderTotal += weekTotal;
        });
        return total + orderTotal;
    }, 0);

    const allDemandWeeks = Object.keys(weeklyDemand)
        .filter(w => weeklyDemand[w] > 0)
        .map(w => parseInt(w.slice(1)))
        .sort((a,b) => a-b);

    if (allDemandWeeks.length === 0) {
        return { weeklyDemand: {}, producedData: {}, planData: {}, allWeeks: [], fgoiData: {}, modelWiseDemand: {} };
    }
    
    const firstPoFcWeek = allDemandWeeks[0];
    const earliestProductionStartWeek = firstPoFcWeek - 3;
    const order = ordersForCc[0]; 
    const obData: SewingOperation[] = SEWING_OPERATIONS_BY_STYLE[order.style] || [];
    const totalSam = obData.reduce((sum, op) => sum + op.sam, 0);

    const getMaxWeeklyOutput = (lines: number) => {
        if (totalSam <= 0) return 0;
        const totalTailors = obData.reduce((sum, op) => sum + op.operators, 0);
        const budgetedEfficiency = order.budgetedEfficiency || 85;
        return (WORK_DAY_MINUTES * 6 * totalTailors * lines * (budgetedEfficiency / 100)) / totalSam;
    };

    const distributePlan = (demandToProduce: number, startWeek: number, capacity: number): Record<string, number> => {
        const plan: Record<string, number> = {};
        if (capacity <= 0 || demandToProduce <= 0) return plan;
        let remainingDemand = demandToProduce;
        let currentWeek = startWeek;
        while(remainingDemand > 0) {
            const planQty = Math.min(remainingDemand, capacity);
            plan[`W${currentWeek}`] = planQty;
            remainingDemand -= planQty;
            currentWeek++;
        }
        return plan;
    };

    let finalPlan: Record<string, number> = {};
    let finalProduced: Record<string, number> = { ...initialProducedData };
    
    let lines = 1;
    let finalLines = 1;
    let finalOffset = 0;
    let finalProdStartWeek = firstPoFcWeek - 1;

    while (true) {
        const capacity = getMaxWeeklyOutput(lines);
        if (capacity <= 0) break;

        const totalProducedQty = Object.values(initialProducedData).reduce((sum, qty) => sum + qty, 0);
        const totalDemandToProduce = totalPoFcQty - totalProducedQty;
        
        let currentStartWeek = firstPoFcWeek - 1;
        
        const tempPlan = distributePlan(totalDemandToProduce, currentStartWeek, capacity);

        const allWeeksForSim = [...new Set([...Object.keys(weeklyDemand), ...Object.keys(tempPlan)])]
            .sort((a, b) => parseInt(a.slice(1)) - parseInt(b.slice(1)));

        const tempFgoi = calculateFgoiForSingleScenario(allWeeksForSim, weeklyDemand, tempPlan, {}, 0);
        const minFgOi = Math.min(0, ...Object.values(tempFgoi));
        
        let offset = 0;
        if (minFgOi < 0) {
            offset = Math.ceil(Math.abs(minFgOi) / capacity);
            currentStartWeek = currentStartWeek - offset;
        }

        if (currentStartWeek >= earliestProductionStartWeek) {
            finalProdStartWeek = currentStartWeek;
            finalLines = lines;
            finalOffset = offset;
            break;
        } else {
            lines++;
        }
        
        if (lines > 20) break; // Safety break
    }


    if (snapshotWeek <= finalProdStartWeek) {
        const capacity = getMaxWeeklyOutput(finalLines);
        const totalToProduce = totalPoFcQty - Object.values(initialProducedData).reduce((s, q) => s + q, 0);
        finalPlan = distributePlan(totalToProduce, finalProdStartWeek, capacity);
    } else { // Snapshot week is after determined production start
        // 1. Simulate what should have been produced
        const idealCapacity = getMaxWeeklyOutput(finalLines);
        const idealPlan = distributePlan(totalPoFcQty, finalProdStartWeek, idealCapacity);
        
        Object.keys(idealPlan).forEach(weekStr => {
            const weekNum = parseInt(weekStr.slice(1));
            if (weekNum < snapshotWeek) {
                finalProduced[weekStr] = (finalProduced[weekStr] || 0) + idealPlan[weekStr];
            }
        });
        
        const alreadyProducedForFuture = Object.values(finalProduced).reduce((sum, qty) => sum + qty, 0);
        const futureDemandToProduce = totalPoFcQty - alreadyProducedForFuture;
        
        // 2. Re-plan for the future
        let futureLines = 1;
        while(true) {
            const capacity = getMaxWeeklyOutput(futureLines);
            if (capacity <= 0) break;
            
            const futurePlan = distributePlan(futureDemandToProduce, snapshotWeek, capacity);
            const allWeeksForSim = [...new Set([...Object.keys(weeklyDemand), ...Object.keys(finalProduced), ...Object.keys(futurePlan)])].sort((a,b) => parseInt(a.slice(1)) - parseInt(b.slice(1)));
            const fgoiSim = calculateFgoiForSingleScenario(allWeeksForSim, weeklyDemand, futurePlan, finalProduced, 0);
            
            const futureWeeks = allWeeksForSim.filter(w => parseInt(w.slice(1)) >= snapshotWeek);
            const minFgOiFuture = Math.min(0, ...futureWeeks.map(w => fgoiSim[w] || 0));

            if (minFgOiFuture >= 0) {
                finalPlan = futurePlan;
                finalLines = futureLines; // Update final lines for the reactive plan
                break;
            } else {
                futureLines++;
            }
             if (futureLines > 20) break; // Safety break
        }
    }
    
    const allWeeks = [...new Set([...Object.keys(weeklyDemand), ...Object.keys(finalPlan), ...Object.keys(finalProduced)])].sort((a,b) => parseInt(a.slice(1)) - parseInt(b.slice(1)));
    const weekHeaders = allWeeks.length > 0 ? Array.from({length: parseInt(allWeeks[allWeeks.length - 1].slice(1)) - parseInt(allWeeks[0].slice(1)) + 1}, (_, i) => `W${parseInt(allWeeks[0].slice(1)) + i}`) : [];
    
    const fgoiData = calculateFgoiForSingleScenario(weekHeaders, weeklyDemand, finalPlan, finalProduced, 0);

    return {
        weeklyDemand,
        producedData: finalProduced,
        planData: finalPlan,
        fgoiData,
        allWeeks: weekHeaders,
        productionStartWeek: finalProdStartWeek,
        earliestProductionStartWeek,
        offset: finalOffset,
        lines: finalLines,
        modelWiseDemand,
    };
};

export type ModelPlanQuantities = {
    produced: Record<string, number>;
    plan: Record<string, number>;
};

export const initialAllocation = (
    mainPlan: CcWisePlanResult,
    modelDemands: Record<string, Record<string, number>>,
    allWeeks: string[]
): Record<string, ModelPlanQuantities> => {
    const modelNames = Object.keys(modelDemands);
    
    // Initialize results
    const modelQuantities: Record<string, ModelPlanQuantities> = {};
    modelNames.forEach(name => {
        modelQuantities[name] = { produced: {}, plan: {} };
    });

    const calculateAllModelFgoi = () => {
        const allFgoi: Record<string, Record<string, number>> = {};
        modelNames.forEach(name => {
            const demand = modelDemands[name] || {};
            const { produced, plan } = modelQuantities[name];
            allFgoi[name] = calculateFgoiForSingleScenario(allWeeks, demand, plan, produced, 0);
        });
        return allFgoi;
    };

    const findWinningModel = (weekIndex: number, allModelFgoi: Record<string, Record<string, number>>): string | null => {
        let potentialWinners = [...modelNames];
        
        for (let i = weekIndex; i < allWeeks.length; i++) {
            const currentWeek = allWeeks[i];
            
            let lowestFgoi = Infinity;
            potentialWinners.forEach(name => {
                const fgoi = allModelFgoi[name][currentWeek] ?? 0;
                if (fgoi < lowestFgoi) {
                    lowestFgoi = fgoi;
                }
            });

            const winners = potentialWinners.filter(name => (allModelFgoi[name][currentWeek] ?? 0) === lowestFgoi);

            if (winners.length === 1) {
                return winners[0];
            }
            potentialWinners = winners; // For the next iteration of tie-breaking
        }
        return potentialWinners.length > 0 ? potentialWinners[0] : null; // Default to first if tie persists
    };


    allWeeks.forEach((week, weekIndex) => {
        const ccProducedQty = mainPlan.producedData[week] || 0;
        const ccPlanQty = mainPlan.planData[week] || 0;

        // Allocate Produced Qty
        if (ccProducedQty > 0) {
            const currentFgoiState = calculateAllModelFgoi();
            const winner = findWinningModel(weekIndex, currentFgoiState);
            if (winner) {
                modelQuantities[winner].produced[week] = (modelQuantities[winner].produced[week] || 0) + ccProducedQty;
            }
        }
        
        // Allocate Plan Qty if no Produced Qty was allocated this week
        else if (ccPlanQty > 0) {
             const currentFgoiState = calculateAllModelFgoi();
             const winner = findWinningModel(weekIndex, currentFgoiState);
             if (winner) {
                modelQuantities[winner].plan[week] = (modelQuantities[winner].plan[week] || 0) + ccPlanQty;
            }
        }
    });

    return modelQuantities;
};

export const correctAllocationForNegativeFgoi = (
    initialQuantities: Record<string, ModelPlanQuantities>,
    modelDemands: Record<string, Record<string, number>>,
    allWeeks: string[]
): Record<string, ModelPlanQuantities> => {
    const correctedQuantities = JSON.parse(JSON.stringify(initialQuantities));
    const modelNames = Object.keys(modelDemands);

    for (let i = 0; i < allWeeks.length; i++) {
        const week = allWeeks[i];
        
        const fgoiState: Record<string, Record<string, number>> = {};
        modelNames.forEach(name => {
            fgoiState[name] = calculateFgoiForSingleScenario(
                allWeeks,
                modelDemands[name],
                correctedQuantities[name].plan,
                correctedQuantities[name].produced,
                0
            );
        });

        const deficits: Record<string, number> = {};
        let totalDeficit = 0;
        modelNames.forEach(name => {
            const fgoi = fgoiState[name][week] || 0;
            if (fgoi < 0) {
                deficits[name] = -fgoi;
                totalDeficit += -fgoi;
            }
        });

        if (totalDeficit <= 0) continue;

        // Search backwards for a donor week
        for (let j = i - 1; j >= 0; j--) {
            const actionWeek = allWeeks[j];
            let sourceModel: string | null = null;
            let sourceType: 'produced' | 'plan' | null = null;
            let availableToRedistribute = 0;

            // Find a week with production that's large enough
            for (const name of modelNames) {
                const producedQty = correctedQuantities[name].produced[actionWeek] || 0;
                if (producedQty >= totalDeficit) {
                    sourceModel = name;
                    sourceType = 'produced';
                    availableToRedistribute = producedQty;
                    break;
                }
                const planQty = correctedQuantities[name].plan[actionWeek] || 0;
                 if (planQty >= totalDeficit) {
                    sourceModel = name;
                    sourceType = 'plan';
                    availableToRedistribute = planQty;
                    break;
                }
            }

            if (sourceModel && sourceType) {
                const quantityToMove = totalDeficit;
                
                // Deduct from the source
                correctedQuantities[sourceModel][sourceType][actionWeek] -= quantityToMove;
                
                // Distribute to models with deficits
                Object.entries(deficits).forEach(([deficitModel, amount]) => {
                    correctedQuantities[deficitModel][sourceType!][actionWeek] = 
                        (correctedQuantities[deficitModel][sourceType!][actionWeek] || 0) + amount;
                });
                
                // Deficit for week 'i' is fixed, so break the inner backward search
                // and let the outer loop continue from the next week.
                break; 
            }
        }
    }

    return correctedQuantities;
};
