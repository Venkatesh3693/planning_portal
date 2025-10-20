

'use client';

import { useState, useMemo, forwardRef, type ComponentProps, useEffect } from 'react';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from '@/components/ui/dialog';
import { Header } from '@/components/layout/header';
import Link from 'next/link';
import { PROCESSES, WORK_DAY_MINUTES, SEWING_OPERATIONS_BY_STYLE, MACHINE_NAME_ABBREVIATIONS, SIZES } from '@/lib/data';
import type { Order, ScheduledProcess, TnaProcess, SewingOperation, BomItem, RampUpEntry } from '@/lib/types';
import { format, isAfter, isBefore, startOfDay, subDays } from 'date-fns';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import ColorPicker from '@/components/orders/color-picker';
import { cn } from '@/lib/utils';
import { useSchedule } from '@/context/schedule-provider';
import { Button } from '@/components/ui/button';
import RampUpDialog from '@/components/orders/ramp-up-dialog';
import { Badge } from '@/components/ui/badge';
import { LineChart, Zap, AlertCircle, X, Info, ChevronsRight, ChevronDown, PlusCircle } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { generateTnaPlan } from '@/lib/tna-calculator';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import PoDetailsDialog from '@/components/orders/po-details-dialog';
import DemandDetailsDialog from '@/components/orders/demand-details-dialog';
import ProjectionDetailsDialog from '@/components/orders/projection-details-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';


const SEWING_PROCESS_ID = 'sewing';
const sewingProcess = PROCESSES.find(p => p.id === SEWING_PROCESS_ID);

type RampUpDialogState = {
  order: Order;
  singleLineMinDays: number;
};


// Helper functions moved to module scope to prevent re-definition on each render.
const calculateMinDays = (order: Order, sewingSam: number, rampUpScheme: RampUpEntry[]) => {
    const scheme = rampUpScheme || [];
    if (!order.quantity || !sewingSam || scheme.length === 0) return 0;
  
    // --- Best Practice Fix: Pre-compute efficiency map ---
    const sortedScheme = [...scheme].sort((a, b) => a.day - b.day);
    const peakEfficiency = sortedScheme.length > 0 ? sortedScheme[sortedScheme.length - 1].efficiency : 0;
  
    // Create a dense map for quick lookups.
    const maxMapDays = sortedScheme.length > 0 ? sortedScheme[sortedScheme.length - 1].day + 90 : 90;
    const efficiencyMap = new Array(maxMapDays + 1).fill(0);
    let lastEff = 0;
    let schemeIndex = 0;
  
    for (let day = 1; day <= maxMapDays; day++) {
      // Find the correct efficiency for the current day from the sorted scheme
      while (schemeIndex < sortedScheme.length && day >= sortedScheme[schemeIndex].day) {
        lastEff = sortedScheme[schemeIndex].efficiency;
        schemeIndex++;
      }
      efficiencyMap[day] = lastEff;
    }
    // --- End of Fix ---
  
  
    let remainingQty = order.quantity;
    let minutes = 0;
  
    while (remainingQty > 0) {
      const currentDay = Math.floor(minutes / WORK_DAY_MINUTES) + 1;
      
      // Direct, safe lookup from the map
      const efficiency = currentDay > maxMapDays ? peakEfficiency : efficiencyMap[currentDay];
  
      if (!efficiency || efficiency <= 0) {
        // This should no longer happen with the pre-computed map, but as a safeguard:
        return Infinity; 
      }
  
      const effectiveSam = sewingSam / (efficiency / 100);
      const outputPerMinute = 1 / effectiveSam;
      
      const minutesToNextDay = WORK_DAY_MINUTES - (minutes % WORK_DAY_MINUTES);
      const maxOutputForRestOfDay = minutesToNextDay * outputPerMinute;
  
      if (remainingQty <= maxOutputForRestOfDay) {
        minutes += remainingQty / outputPerMinute;
        remainingQty = 0;
      } else {
        minutes += minutesToNextDay;
        remainingQty -= maxOutputForRestOfDay;
      }
      
      // Safety break for extreme cases
      if (minutes > WORK_DAY_MINUTES * 10000) {
          return Infinity;
      }
    }
    return minutes / WORK_DAY_MINUTES;
};
  
const calculateAverageEfficiency = (
    scheme: RampUpEntry[],
    totalProductionDays: number
): number => {
    if (scheme.length === 0 || totalProductionDays === 0 || totalProductionDays === Infinity) return 0;
  
    let weightedSum = 0;
    const sortedScheme = [...scheme]
      .map(s => ({ ...s, efficiency: Number(s.efficiency) || 0 }))
      .filter(s => s.efficiency > 0)
      .sort((a, b) => a.day - b.day);
  
    if (sortedScheme.length === 0) return 0;
  
    let lastDay = 0;
    let lastEfficiency = 0;
  
    for (const entry of sortedScheme) {
      const daysInThisStep = entry.day - lastDay;
      if (daysInThisStep > 0) {
        weightedSum += daysInThisStep * lastEfficiency;
      }
      lastDay = entry.day;
      lastEfficiency = entry.efficiency;
    }
  
    const daysAtPeak = Math.ceil(totalProductionDays) - lastDay + 1;
    if (daysAtPeak > 0) {
      weightedSum += daysAtPeak * lastEfficiency;
    }
  
    return weightedSum / Math.ceil(totalProductionDays);
};
  
const calculateDaysToMeetBudget = (
    rampUpScheme: RampUpEntry[],
    budgetedEfficiency: number
): string | number => {
    if (!rampUpScheme || rampUpScheme.length === 0 || !budgetedEfficiency) {
      return '-';
    }
  
    const sortedScheme = [...rampUpScheme]
      .filter(s => s.efficiency > 0)
      .sort((a, b) => a.day - b.day);
  
    if (sortedScheme.length === 0) return '-';
  
    const peakEfficiency = sortedScheme[sortedScheme.length - 1].efficiency;
  
    if (peakEfficiency < budgetedEfficiency) {
      return Infinity;
    }
    
    if (sortedScheme[0].efficiency >= budgetedEfficiency) {
      return 1;
    }
    
    let rampUpTotalEfficiency = 0;
    let rampUpTotalDays = 0;
    let lastDay = 0;
    let lastEfficiency = 0;
    
    for (const entry of sortedScheme) {
      const daysInThisStep = entry.day - lastDay;
      if (daysInThisStep > 0) {
        const avgDuringStep = (rampUpTotalEfficiency + (daysInThisStep * lastEfficiency)) / (rampUpTotalDays + daysInThisStep);
        if (avgDuringStep >= budgetedEfficiency) {
            // find the exact day
            let day = rampUpTotalDays + 1;
            while(day < entry.day) {
              const currentTotalEff = rampUpTotalEfficiency + ((day - rampUpTotalDays) * lastEfficiency);
              if(currentTotalEff / day >= budgetedEfficiency) return day;
              day++;
            }
        }
        rampUpTotalEfficiency += daysInThisStep * lastEfficiency;
        rampUpTotalDays += daysInThisStep;
      }
  
      if((rampUpTotalEfficiency + entry.efficiency) / (rampUpTotalDays + 1) >= budgetedEfficiency) {
          return rampUpTotalDays + 1;
      }
  
      lastDay = entry.day;
      lastEfficiency = entry.efficiency;
    }
    
    rampUpTotalDays = lastDay - 1;
    rampUpTotalEfficiency = 0;
  
    let prevDay = 0;
    let prevEff = 0;
  
    for (const entry of sortedScheme) {
      const numDays = entry.day - prevDay;
      if (numDays > 0) {
        rampUpTotalEfficiency += numDays * prevEff;
      }
      if (entry.day > rampUpTotalDays) break;
      prevDay = entry.day;
      prevEff = entry.efficiency;
    }
    
    const numerator = (budgetedEfficiency * rampUpTotalDays) - rampUpTotalEfficiency;
    const denominator = peakEfficiency - budgetedEfficiency;
    
    if (denominator <= 0) {
       return Infinity;
    }
  
    const daysAtPeak = Math.max(0, numerator / denominator);
  
    return Math.ceil(rampUpTotalDays + daysAtPeak);
};

const getEhdForOrder = (orderId: string, scheduledProcesses: ScheduledProcess[]) => {
    const packingProcesses = scheduledProcesses.filter(
      (p) => p.orderId === orderId && p.processId === 'packing'
    );

    if (packingProcesses.length === 0) {
      return null;
    }

    const latestEndDate = packingProcesses.reduce((latest, current) => {
      return isAfter(current.endDateTime, latest) ? current.endDateTime : latest;
    }, packingProcesses[0].endDateTime);

    return latestEndDate;
};

// Use a local state type that can handle string for efficiency and has a unique id
type EditableRampUpEntry = {
  id: number;
  day: number | string;
  efficiency: number | string;
};
let nextId = 0;

const RampUpScheme = ({ 
  order,
  singleLineMinDays,
  numLines,
  onSave,
  calculateAverageEfficiency,
  onNumLinesChange,
}: { 
  order: Order, 
  singleLineMinDays: number, 
  numLines: number, 
  onSave: (orderId: string, scheme: RampUpEntry[]) => void,
  calculateAverageEfficiency: (scheme: RampUpEntry[], totalProductionDays: number) => number,
  onNumLinesChange: (lines: number) => void
}) => {
  const [scheme, setScheme] = useState<EditableRampUpEntry[]>([]);

  useEffect(() => {
    if (order) {
      const initialScheme = (order.sewingRampUpScheme || [
        { day: 1, efficiency: order.budgetedEfficiency || 85 },
      ]).map(s => ({ ...s, id: nextId++ }));
      setScheme(initialScheme);
    }
  }, [order]);

  const totalProductionDays = useMemo(() => {
    if (singleLineMinDays > 0 && numLines > 0) {
      return singleLineMinDays / numLines;
    }
    return 0;
  }, [singleLineMinDays, numLines]);

  const averageEfficiency = useMemo(() => {
    const numericScheme = scheme.map(s => ({...s, day: Number(s.day) || 0, efficiency: Number(s.efficiency) || 0}));
    return calculateAverageEfficiency(numericScheme, totalProductionDays);
  }, [scheme, totalProductionDays, calculateAverageEfficiency]);
  
  const hasDuplicateDays = useMemo(() => {
    const dayCounts = new Map<number, number>();
    scheme.forEach(entry => {
      const day = Number(entry.day);
      if (day > 0) {
        dayCounts.set(day, (dayCounts.get(day) || 0) + 1);
      }
    });
    return Array.from(dayCounts.values()).some(count => count > 1);
  }, [scheme]);


  const handleAddDay = () => {
    const nextDay = scheme.length > 0 ? Math.max(...scheme.map(s => Number(s.day))) + 1 : 1;
    const lastEfficiency = scheme.length > 0 ? scheme[scheme.length - 1].efficiency : 0;
    setScheme([...scheme, { id: nextId++, day: nextDay, efficiency: lastEfficiency }]);
  };

  const handleRemoveDay = (idToRemove: number) => {
    setScheme(prevScheme => {
      const newScheme = prevScheme.filter(s => s.id !== idToRemove);
      return newScheme.sort((a,b) => Number(a.day) - Number(b.day));
    });
  };

  const handleEfficiencyChange = (idToChange: number, newEfficiency: string) => {
    setScheme(
      scheme.map(s =>
        s.id === idToChange ? { ...s, efficiency: newEfficiency } : s
      )
    );
  };
  
  const handleDayChange = (idToChange: number, newDay: string) => {
     setScheme(
      scheme.map(s =>
        s.id === idToChange ? { ...s, day: newDay } : s
      ).sort((a,b) => Number(a.day) - Number(b.day))
    );
  }

  const handleSave = () => {
    if (hasDuplicateDays) return;

    const validScheme: RampUpEntry[] = scheme
      .map(s => ({
          day: Number(s.day) || 0,
          efficiency: Number(s.efficiency) || 0
      }))
      .filter(s => s.efficiency > 0 && s.efficiency <= 100 && s.day > 0)
      .sort((a, b) => a.day - b.day);
      
    const uniqueDayScheme = Object.values(
      validScheme.reduce((acc, curr) => {
        if (!acc[curr.day] || acc[curr.day].efficiency < curr.efficiency) {
          acc[curr.day] = curr;
        }
        return acc;
      }, {} as Record<number, RampUpEntry>)
    );

    onSave(order.id, uniqueDayScheme);
  };
  
  return (
    <div className="space-y-6">
       <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto">
          <div className="grid grid-cols-[1fr_1fr_40px] items-center gap-x-4 gap-y-2 text-sm font-medium text-muted-foreground px-4">
            <span>Day</span>
            <span className="text-left">Target Efficiency (%)</span>
            <span></span>
          </div>

          {scheme.map((entry) => (
            <div
              key={entry.id}
              className="grid grid-cols-[1fr_1fr_40px] items-center gap-x-4 px-4"
            >
              <Input
                id={`day-${entry.id}`}
                type="text"
                value={entry.day}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === '' || /^[1-9]\d*$/.test(val)) {
                    handleDayChange(entry.id, val);
                  }
                }}
              />
              <Input
                id={`eff-${entry.id}`}
                type="text"
                value={entry.efficiency}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === '' || (Number(val) >= 0 && Number(val) <= 100 && !val.includes('.'))) {
                    handleEfficiencyChange(entry.id, val);
                  }
                }}
              />
              {scheme.length > 1 && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleRemoveDay(entry.id)}
                  className="justify-self-center"
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          ))}

          <div className="px-4">
            <Button
              variant="link"
              size="sm"
              onClick={handleAddDay}
              className="p-0 h-auto"
            >
              <PlusCircle className="mr-2 h-4 w-4" />
              Add Day
            </Button>
          </div>
          
          {hasDuplicateDays && (
             <p className="px-4 text-sm text-destructive">
                Duplicate day numbers are not allowed. Please enter a unique day for each entry.
            </p>
          )}

          <div className="px-4 pt-4 border-t mt-4 space-y-2">
            <div className="flex items-center justify-between text-sm">
                <Label htmlFor="num-lines-input" className="text-muted-foreground">Number of Lines:</Label>
                <Input
                    id="num-lines-input"
                    type="number"
                    min="1"
                    value={numLines}
                    onChange={(e) => onNumLinesChange(parseInt(e.target.value, 10) || 1)}
                    className="w-20 h-8 text-center"
                />
            </div>
            <div className="flex justify-between text-sm text-muted-foreground">
                <span>Total Production Days:</span>
                <span>
                    {totalProductionDays.toFixed(2)}
                </span>
            </div>
             <div className="flex justify-between font-medium mt-2">
                <span>Weighted Avg. Efficiency:</span>
                <span className="text-primary">
                    {averageEfficiency.toFixed(2)}%
                </span>
            </div>
          </div>
        </div>

        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={hasDuplicateDays}>
            Save Scheme
          </Button>
        </div>
    </div>
  );
};


const OperationBulletin = ({ order }: { order: Order }) => {
  const operations = SEWING_OPERATIONS_BY_STYLE[order.style] || [];

  const summary = useMemo(() => {
    if (operations.length === 0) {
      return { totalSam: 0, gradeCounts: { A: 0, B: 0, C: 0, D: 0 }, machineCounts: {} };
    }
    const totalSam = operations.reduce((sum, op) => sum + op.sam, 0);
    const gradeCounts = operations.reduce((counts, op) => {
      counts[op.grade] = (counts[op.grade] || 0) + 1;
      return counts;
    }, { A: 0, B: 0, C: 0, D: 0 } as Record<string, number>);
    
    const machineCounts = operations.reduce((counts, op) => {
      const machineAbbr = MACHINE_NAME_ABBREVIATIONS[op.machine] || op.machine;
      counts[machineAbbr] = (counts[machineAbbr] || 0) + 1;
      return counts;
    }, {} as Record<string, number>);

    return { totalSam, gradeCounts, machineCounts };
  }, [operations]);

  if (operations.length === 0) {
    return (
      <div className="text-center text-muted-foreground py-10">
        No detailed sewing operations defined for style: {order.style}
      </div>
    );
  }

  return (
    <div className="space-y-6">
       <div className="flex rounded-lg border bg-background dark:bg-card p-4">
        <div className="flex flex-col justify-center items-center pr-6">
          <p className="text-sm text-muted-foreground">Total SAM</p>
          <p className="text-3xl font-bold">{summary.totalSam.toFixed(2)}</p>
        </div>
        <Separator orientation="vertical" className="h-auto" />
        <div className="flex-1 pl-6 space-y-2">
          <div>
            <p className="text-sm text-muted-foreground">Tailor Grades</p>
            <div className="flex flex-wrap gap-2 mt-1">
              {(['A', 'B', 'C', 'D'] as const).map(grade => (
                <Badge key={grade} variant="secondary" className="text-base">
                  {grade}: {summary.gradeCounts[grade]}
                </Badge>
              ))}
            </div>
          </div>
          <Separator />
          <div>
            <p className="text-sm text-muted-foreground">Machine Types</p>
            <div className="flex flex-wrap gap-2 mt-1">
               {Object.entries(summary.machineCounts).map(([machine, count]) => (
                <Badge key={machine} variant="secondary" className="text-base">
                  {machine}: {count}
                </Badge>
              ))}
            </div>
          </div>
        </div>
      </div>
      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50 hover:bg-muted/50">
              <TableHead>Operation</TableHead>
              <TableHead>Machine</TableHead>
              <TableHead>Grade</TableHead>
              <TableHead className="text-center">Operators</TableHead>
              <TableHead className="text-right">Time (SAM)</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {operations.map((op, index) => (
              <TableRow key={index}>
                <TableCell className="font-medium">{op.operation}</TableCell>
                <TableCell>{op.machine}</TableCell>
                <TableCell>
                  <Badge variant="secondary" className="w-6 h-6 justify-center">{op.grade}</Badge>
                </TableCell>
                <TableCell className="text-center">{op.operators}</TableCell>
                <TableCell className="text-right">{op.sam.toFixed(2)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

const BillOfMaterials = ({ order, onBomChange }: { order: Order, onBomChange: (orderId: string, componentName: string, field: keyof BomItem, value: any) => void }) => {
  const bom = order.bom || [];
  
  const sortedBom = useMemo(() => {
    return [...bom].sort((a, b) => b.leadTime - a.leadTime);
  }, [bom]);

  if (bom.length === 0) {
    return (
      <div className="text-center text-muted-foreground py-10">
        No Bill of Materials (BOM) defined for this order.
      </div>
    );
  }

  return (
    <div className="border rounded-lg overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50 hover:bg-muted/50">
            <TableHead>Component Name</TableHead>
            <TableHead>Size Dependent</TableHead>
            <TableHead>Import / Local</TableHead>
            <TableHead>Lead Time</TableHead>
            <TableHead>Supplier</TableHead>
            <TableHead>Projection / FRC</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedBom.map((item, index) => (
            <TableRow key={index}>
              <TableCell className="font-medium">{item.componentName}</TableCell>
              <TableCell>
                <Select
                  value={item.sizeDependent ? 'yes' : 'no'}
                  onValueChange={(value) => onBomChange(order.id, item.componentName, 'sizeDependent', value === 'yes')}
                >
                  <SelectTrigger className="w-[100px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="yes">Yes</SelectItem>
                    <SelectItem value="no">No</SelectItem>
                  </SelectContent>
                </Select>
              </TableCell>
              <TableCell>{item.source}</TableCell>
              <TableCell>{item.leadTime} days</TableCell>
              <TableCell>{item.supplier}</TableCell>
              <TableCell>
                 <Select
                    value={item.forecastType}
                    onValueChange={(value: 'Projection' | 'FRC') => onBomChange(order.id, item.componentName, 'forecastType', value)}
                  >
                    <SelectTrigger className="w-[120px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Projection">Projection</SelectItem>
                      <SelectItem value="FRC">FRC</SelectItem>
                    </SelectContent>
                  </Select>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};


// Sub-components defined at the module level for stability
const TnaPlan = ({
    order,
    scheduledProcesses,
    minRunDays,
    moqs,
    processBatchSize,
    onMinRunDaysChange,
    totalProductionDays,
}: {
    order: Order;
    scheduledProcesses: ScheduledProcess[];
    minRunDays: Record<string, string>;
    moqs: Record<string, number>;
    processBatchSize: number;
    onMinRunDaysChange: (processId: string, value: string) => void;
    totalProductionDays: number;
}) => {
    if (!order.tna) return null;
    
    const sewingProcessIndex = order.processIds.indexOf('sewing');
    
    const calculatedCkDate = useMemo(() => {
        if (!order.processIds.length || !order.tna?.processes.length) return null;
        const firstProcessId = order.processIds[0];
        const firstTnaProcess = order.tna.processes.find(p => p.processId === firstProcessId);
        if (!firstTnaProcess?.latestStartDate) return null;

        return subDays(new Date(firstTnaProcess.latestStartDate), 7);
    }, [order.tna?.processes, order.processIds]);

    const getAggregatedScheduledTimes = (processId: string) => {
        const relevantProcesses = scheduledProcesses.filter(p => p.orderId === order.id && p.processId === processId);
        if (relevantProcesses.length === 0) {
            return { start: null, end: null };
        }

        let earliestStart = relevantProcesses[0].startDateTime;
        let latestEnd = relevantProcesses[0].endDateTime;

        for (let i = 1; i < relevantProcesses.length; i++) {
            if (isBefore(relevantProcesses[i].startDateTime, earliestStart)) {
                earliestStart = relevantProcesses[i].startDateTime;
            }
            if (isAfter(relevantProcesses[i].endDateTime, latestEnd)) {
                latestEnd = relevantProcesses[i].endDateTime;
            }
        }
        return { start: earliestStart, end: latestEnd };
    };

    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 text-sm">
            {order.orderType === 'Firm PO' && (
              <>
                <div className="p-3 bg-muted rounded-md flex flex-col justify-center">
                    <div className="font-medium text-muted-foreground text-xs">CK Date</div>
                    <div className="font-semibold text-base">{calculatedCkDate ? format(calculatedCkDate, 'MMM dd, yyyy') : 'N/A'}</div>
                </div>
                <div className="p-3 bg-muted rounded-md flex flex-col justify-center">
                    <div className="font-medium text-muted-foreground text-xs">Shipment Date</div>
                    <div className="font-semibold text-base">{order.dueDate ? format(new Date(order.dueDate), 'MMM dd, yyyy') : '-'}</div>
                </div>
                <div className="p-3 bg-muted rounded-md flex flex-col justify-center">
                    <div className="font-medium text-muted-foreground text-xs">Order Quantity</div>
                    <div className="font-semibold text-base">{order.quantity.toLocaleString()} units</div>
                </div>
              </>
            )}
            {order.orderType === 'Forecasted' && (
              <>
                <div className="p-3 bg-muted rounded-md flex flex-col justify-center">
                    <div className="font-medium text-muted-foreground text-xs">Season</div>
                    <div className="font-semibold text-base">{order.season || '-'}</div>
                </div>
                <div className="p-3 bg-muted rounded-md flex flex-col justify-center">
                    <div className="font-medium text-muted-foreground text-xs">Style</div>
                    <div className="font-semibold text-base">{order.style}</div>
                </div>
                 <div className="p-3 bg-muted rounded-md flex flex-col justify-center">
                    <div className="font-medium text-muted-foreground text-xs">Selection Qty</div>
                    <div className="font-semibold text-base">{order.quantity.toLocaleString()}</div>
                </div>
              </>
            )}
            <div className="p-3 bg-muted rounded-md flex flex-col justify-center">
                <div className="font-medium text-muted-foreground text-xs">Budgeted Efficiency</div>
                <div className="font-semibold text-base">{order.budgetedEfficiency || 'N/A'}%</div>
            </div>
            <div className="p-3 bg-amber-100 dark:bg-amber-900/50 border border-amber-300 dark:border-amber-700 rounded-md flex flex-col justify-center text-center">
                <div className="font-medium text-amber-800 dark:text-amber-200 text-xs flex items-center justify-center gap-1">
                    Process Batch Size
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger><Info className="h-3 w-3" /></TooltipTrigger>
                            <TooltipContent><p>The max of all Calculated MOQs (excluding Packing). <br/>This drives the overlap in the T&A Plan.</p></TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                </div>
                <div className="font-bold text-lg">{Math.round(processBatchSize).toLocaleString()}</div>
            </div>
        </div>

        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50 hover:bg-muted/50">
                <TableHead>Process</TableHead>
                <TableHead className="text-right">SAM</TableHead>
                <TableHead>Min Run Days</TableHead>
                <TableHead>Calculated MOQ</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead>Earliest Start</TableHead>
                <TableHead>Latest Start</TableHead>
                <TableHead>Scheduled Start</TableHead>
                <TableHead>Scheduled End</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {order.processIds
                .map((pid, index) => ({ process: PROCESSES.find(p => p.id === pid)!, index }))
                .map(({ process, index }) => {
                const tnaProcess = order.tna?.processes.find(p => p.processId === process.id);
                const { start, end } = getAggregatedScheduledTimes(process.id);
                const isAfterSewing = sewingProcessIndex !== -1 && index > sewingProcessIndex;
                const canEditMinRunDays = !isAfterSewing || process.id === 'packing';
                const canShowMoq = !isAfterSewing || process.id === 'packing';
                
                const durationDisplay = process.id === SEWING_PROCESS_ID ? Math.ceil(totalProductionDays) : tnaProcess?.durationDays;

                return (
                  <TableRow key={process.id}>
                    <TableCell className="font-medium">{process.name}</TableCell>
                    <TableCell className="text-right">{process.sam}</TableCell>
                    <TableCell>
                      {canEditMinRunDays ? (
                       <Input
                            type="number"
                            min="1"
                            value={minRunDays[process.id] || ''}
                            onChange={(e) => onMinRunDaysChange(process.id, e.target.value)}
                            className="w-20 h-8 text-center"
                        />
                      ) : (
                        <span className="text-center w-20 inline-block">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                        {canShowMoq ? Math.round(moqs[process.id] || 0).toLocaleString() : '-'}
                    </TableCell>
                    <TableCell className="text-right">{durationDisplay ? `${durationDisplay}d` : '-'}</TableCell>
                    <TableCell>{tnaProcess?.earliestStartDate ? format(new Date(tnaProcess.earliestStartDate), 'MMM dd') : '-'}</TableCell>
                    <TableCell>{tnaProcess?.latestStartDate ? format(new Date(tnaProcess.latestStartDate), 'MMM dd') : '-'}</TableCell>
                    <TableCell>{start ? format(start, 'MMM dd, h:mm a') : <span className="text-muted-foreground">Not set</span>}</TableCell>
                    <TableCell>{end ? format(end, 'MMM dd, h:mm a') : <span className="text-muted-foreground">Not set</span>}</TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      </div>
    );
};
  
interface OrderRowProps extends ComponentProps<typeof TableRow> {
  order: Order;
  onColorChange: (orderId: string, color: string) => void;
  onTnaGenerate: (order: Order, processBatchSize: number) => void;
  onRampUpSave: (orderId: string, scheme: RampUpEntry[]) => void;
  onSetSewingLines: (orderId: string, lines: number) => void;
  numLines: number;
  scheduledProcesses: ScheduledProcess[];
  updateOrderMinRunDays: (orderId: string, minRunDays: Record<string, number>) => void;
}

const OrderRow = forwardRef<HTMLTableRowElement, OrderRowProps>(
  ({ order, onColorChange, onTnaGenerate, onRampUpSave, onSetSewingLines, numLines, scheduledProcesses, updateOrderMinRunDays, ...props }, ref) => {
  const [isTnaOpen, setIsTnaOpen] = useState(false);
  const [activeView, setActiveView] = useState<'tna' | 'ob' | 'ramp-up'>('tna');

  const [minRunDays, setMinRunDays] = useState<Record<string, string>>({});
  
  const { processBatchSizes } = useSchedule();
  const processBatchSize = processBatchSizes[order.id] || 0;

  useEffect(() => {
    if (isTnaOpen) {
      const initialDays: Record<string, string> = {};
      const savedDays = order.tna?.minRunDays || {};

      order.processIds.forEach(pid => {
        initialDays[pid] = String(savedDays[pid] || "1");
      });
      setMinRunDays(initialDays);
      setActiveView('tna'); // Reset to TNA view on open
    }
  }, [isTnaOpen, order.id, order.processIds, order.tna?.minRunDays]);

  const handleMinRunDaysChange = (processId: string, value: string) => {
      const newMinRunDays = {...minRunDays, [processId]: value};
      setMinRunDays(newMinRunDays);

      const numericMinRunDays: Record<string, number> = {};
      for (const [key, val] of Object.entries(newMinRunDays)) {
          numericMinRunDays[key] = Number(val) || 1;
      }
      updateOrderMinRunDays(order.id, numericMinRunDays);
  };

  const { sewingLines } = useSchedule();

  const moqs = useMemo(() => {
    const calculatedMoqs: Record<string, number> = {};
    order.processIds.forEach((processId) => {
      const process = PROCESSES.find(p => p.id === processId)!;
      const days = Number(minRunDays[processId]) || 1;
      let currentMoq = 0;
      if (days > 0) {
        if (process.id === 'sewing') {
          const durationMinutes = days * WORK_DAY_MINUTES;
          const peakEfficiency = (order.sewingRampUpScheme || []).reduce((max, s) => Math.max(max, s.efficiency), order.budgetedEfficiency || 85);
          const effectiveSam = process.sam / (peakEfficiency / 100);
          const outputPerMinute = (1 / effectiveSam) * (sewingLines[order.id] || 1);
          currentMoq = Math.floor(outputPerMinute * durationMinutes);
        } else {
          const totalMinutes = days * WORK_DAY_MINUTES;
          const outputPerMinute = 1 / process.sam;
          currentMoq = Math.floor(outputPerMinute * totalMinutes);
        }
      }
      calculatedMoqs[processId] = currentMoq;
    });
    return calculatedMoqs;
  }, [minRunDays, order, sewingLines]);

  const singleLineMinDays = useMemo(() => 
    sewingProcess ? calculateMinDays(order, sewingProcess.sam, order.sewingRampUpScheme || []) : 0,
    [order]
  );
  
  const totalProductionDays = useMemo(() => 
    singleLineMinDays > 0 && numLines > 0 ? singleLineMinDays / numLines : 0,
    [singleLineMinDays, numLines]
  );
  
  const avgEfficiency = useMemo(() => 
    calculateAverageEfficiency(order.sewingRampUpScheme || [], totalProductionDays),
    [order.sewingRampUpScheme, totalProductionDays]
  );
  
  const daysToBudget = useMemo(() => 
    calculateDaysToMeetBudget(order.sewingRampUpScheme || [], order.budgetedEfficiency || 0),
    [order.sewingRampUpScheme, order.budgetedEfficiency]
  );

  const ehd = useMemo(() => getEhdForOrder(order.id, scheduledProcesses), [order.id, scheduledProcesses]);
  
  const isLate = ehd && order.dueDate && isAfter(startOfDay(ehd), startOfDay(new Date(order.dueDate)));
  
  const isBudgetUnreachable = daysToBudget === Infinity;
  const isSchemeInefficient = typeof daysToBudget === 'number' && totalProductionDays > 0 && daysToBudget > totalProductionDays;
  const showWarning = isBudgetUnreachable || isSchemeInefficient;

  const handleRecalculate = () => {
    onTnaGenerate(order, processBatchSize);
  };


  return (
    <TableRow ref={ref} {...props}>
        <TableCell>
          <Dialog open={isTnaOpen} onOpenChange={setIsTnaOpen}>
            <DialogTrigger asChild>
              <span 
                className="font-medium text-primary cursor-pointer hover:underline"
              >
                {order.id}
              </span>
            </DialogTrigger>
            <DialogContent className="max-w-7xl p-0" hideClose>
                <DialogHeader className="flex-row justify-between items-center p-6 pb-0">
                    <div>
                        <DialogTitle>{order.ocn} - {order.style} ({order.color})</DialogTitle>
                        <DialogDescription>
                            Order ID: {order.id} &bull; Buyer: {order.buyer}
                        </DialogDescription>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1 rounded-md bg-muted p-1">
                            <Button size="sm" variant={activeView === 'ob' ? 'default' : 'ghost'} onClick={() => setActiveView('ob')}>OB</Button>
                            <Button size="sm" variant={activeView === 'tna' ? 'default' : 'ghost'} onClick={() => setActiveView('tna')}>T&A Plan</Button>
                            <Button size="sm" variant={activeView === 'ramp-up' ? 'default' : 'ghost'} onClick={() => setActiveView('ramp-up')}>Ramp-up</Button>
                        </div>
                        {activeView === 'tna' && (
                            <Button size="sm" variant="outline" onClick={handleRecalculate}>
                                <Zap className="h-4 w-4 mr-2"/> Recalculate T&A Plan
                            </Button>
                        )}
                        <DialogClose asChild>
                            <Button variant="ghost" size="icon" className="rounded-full">
                                <X className="h-4 w-4" />
                            </Button>
                        </DialogClose>
                    </div>
                </DialogHeader>
              <div className="p-6 pt-4" id={`tna-plan-${order.id}`}>
                {activeView === 'tna' ? (
                    <TnaPlan 
                        order={order}
                        scheduledProcesses={scheduledProcesses}
                        minRunDays={minRunDays}
                        moqs={moqs}
                        processBatchSize={processBatchSize}
                        onMinRunDaysChange={handleMinRunDaysChange}
                        totalProductionDays={totalProductionDays}
                    />
                ) : activeView === 'ob' ? (
                    <OperationBulletin order={order} />
                ) : (
                    <RampUpScheme 
                        order={order}
                        singleLineMinDays={singleLineMinDays}
                        numLines={numLines}
                        onSave={onRampUpSave}
                        calculateAverageEfficiency={calculateAverageEfficiency}
                        onNumLinesChange={(lines) => onSetSewingLines(order.id, lines)}
                    />
                )}
              </div>
            </DialogContent>
          </Dialog>
        </TableCell>
        <TableCell>{order.buyer}</TableCell>
        <TableCell>{order.orderType}</TableCell>
        <TableCell>{order.budgetedEfficiency}%</TableCell>
        <TableCell>
          <TooltipProvider delayDuration={100}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge variant={avgEfficiency < (order.budgetedEfficiency || 0) ? 'destructive' : 'secondary'} className={showWarning ? 'border-2 border-destructive' : ''}>
                  {avgEfficiency.toFixed(2)}%
                </Badge>
              </TooltipTrigger>
              {showWarning && (
                <TooltipContent>
                  <p className="flex items-center gap-2">
                    <AlertCircle className="h-4 w-4" />
                    {isBudgetUnreachable
                      ? "Budgeted efficiency is unreachable."
                      : "Ramp-up too slow for production time."}
                  </p>
                </TooltipContent>
              )}
            </Tooltip>
          </TooltipProvider>
        </TableCell>
        <TableCell>
           <Badge variant={isBudgetUnreachable ? 'destructive' : 'secondary'}>
              {isBudgetUnreachable ? '∞' : (typeof daysToBudget === 'number' ? `${daysToBudget} days` : daysToBudget)}
           </Badge>
        </TableCell>
        <TableCell>
          {singleLineMinDays > 0 && singleLineMinDays !== Infinity ? (
            <Badge variant="secondary" title="Minimum days to complete sewing on a single line">
              {Math.ceil(singleLineMinDays)} days
            </Badge>
          ) : (
            <span className="text-muted-foreground">-</span>
          )}
        </TableCell>
        <TableCell>
          <ColorPicker 
            color={order.displayColor}
            onColorChange={(newColor) => onColorChange(order.id, newColor)}
          />
        </TableCell>
        <TableCell className="text-right">{order.quantity}</TableCell>
        <TableCell>{order.leadTime ? `${order.leadTime} days` : '-'}</TableCell>
        <TableCell>{order.dueDate ? format(new Date(order.dueDate), 'PPP') : '-'}</TableCell>
        <TableCell className={cn(isLate && "text-destructive font-semibold")}>
          {ehd ? (
            format(ehd, 'PPP')
          ) : (
            <span className="text-muted-foreground">{order.dueDate ? 'Not Packed' : '-'}</span>
          )}
        </TableCell>
    </TableRow>
  );
});
OrderRow.displayName = 'OrderRow';

const ForecastedOrderRow = forwardRef<
  HTMLTableRowElement,
  {
    order: Order;
    onRampUpSave: (orderId: string, scheme: RampUpEntry[]) => void;
    onBomChange: (orderId: string, componentName: string, field: keyof BomItem, value: any) => void;
    onSetSewingLines: (orderId: string, lines: number) => void;
    numLines: number;
    children?: React.ReactNode;
  }
>(({ order, onRampUpSave, onBomChange, onSetSewingLines, numLines, children, ...props }, ref) => {
  const [isTnaOpen, setIsTnaOpen] = useState(false);
  const [activeView, setActiveView] = useState<'tna' | 'ob' | 'bom' | 'ramp-up'>('tna');
  const [poDetailsOrder, setPoDetailsOrder] = useState<Order | null>(null);
  const [demandDetailsOrder, setDemandDetailsOrder] = useState<Order | null>(null);
  const [projectionDetailsOrder, setProjectionDetailsOrder] = useState<Order | null>(null);

  const { scheduledProcesses, processBatchSizes, updateOrderMinRunDays } = useSchedule();
  const [minRunDays, setMinRunDays] = useState<Record<string, string>>({});
  const handleMinRunDaysChange = (processId: string, value: string) => {
    const newMinRunDays = { ...minRunDays, [processId]: value };
    setMinRunDays(newMinRunDays);

    const numericMinRunDays: Record<string, number> = {};
    for (const [key, val] of Object.entries(newMinRunDays)) {
      numericMinRunDays[key] = Number(val) || 1;
    }
    updateOrderMinRunDays(order.id, numericMinRunDays);
  };
  const moqs = useMemo(() => ({}), []);
  const processBatchSize = processBatchSizes[order.id] || 0;

  const singleLineMinDays = useMemo(() =>
    sewingProcess ? calculateMinDays(order, sewingProcess.sam, order.sewingRampUpScheme || []) : 0,
    [order]
  );
  
  return (
    <TableRow ref={ref} {...props}>
      <TableCell>
        <Dialog open={isTnaOpen} onOpenChange={setIsTnaOpen}>
          <DialogTrigger asChild>
            <span className="font-medium text-primary cursor-pointer hover:underline">
              {order.id}
            </span>
          </DialogTrigger>
          <DialogContent className="max-w-7xl p-0" hideClose>
            <DialogHeader className="flex-row justify-between items-center p-6 pb-0">
              <div>
                <DialogTitle>{order.ocn} - {order.style} ({order.color})</DialogTitle>
                <DialogDescription>
                  Forecasted Order ID: {order.id} &bull; Buyer: {order.buyer}
                </DialogDescription>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1 rounded-md bg-muted p-1">
                  <Button size="sm" variant={activeView === 'tna' ? 'default' : 'ghost'} onClick={() => setActiveView('tna')}>T&A Plan</Button>
                  <Button size="sm" variant={activeView === 'ob' ? 'default' : 'ghost'} onClick={() => setActiveView('ob')}>OB</Button>
                  <Button size="sm" variant={activeView === 'bom' ? 'default' : 'ghost'} onClick={() => setActiveView('bom')}>BOM</Button>
                  <Button size="sm" variant={activeView === 'ramp-up' ? 'default' : 'ghost'} onClick={() => setActiveView('ramp-up')}>Ramp-up</Button>
                </div>
                <DialogClose asChild>
                  <Button variant="ghost" size="icon" className="rounded-full">
                    <X className="h-4 w-4" />
                  </Button>
                </DialogClose>
              </div>
            </DialogHeader>
            <div className="p-6 pt-4">
              {activeView === 'tna' ? (
                <TnaPlan 
                  order={order}
                  scheduledProcesses={scheduledProcesses}
                  minRunDays={minRunDays}
                  moqs={moqs}
                  processBatchSize={processBatchSize}
                  onMinRunDaysChange={handleMinRunDaysChange}
                  totalProductionDays={0}
                />
              ) : activeView === 'ob' ? (
                <OperationBulletin order={order} />
              ) : activeView === 'bom' ? (
                <BillOfMaterials order={order} onBomChange={onBomChange} />
              ) : (
                <RampUpScheme 
                  order={order}
                  singleLineMinDays={singleLineMinDays}
                  numLines={numLines}
                  onSave={onRampUpSave}
                  calculateAverageEfficiency={calculateAverageEfficiency}
                  onNumLinesChange={(lines) => onSetSewingLines(order.id, lines)}
                />
              )}
            </div>
          </DialogContent>
        </Dialog>
      </TableCell>
      <TableCell>{order.season || '-'}</TableCell>
      <TableCell>{order.style}</TableCell>
      <TableCell>{order.modelNo || '-'}</TableCell>
      <TableCell className="text-right">{(order.quantity || 0).toLocaleString()}</TableCell>
      <TableCell className="text-right font-medium">
        {order.demandDetails ? (
          <Dialog onOpenChange={(isOpen) => !isOpen && setDemandDetailsOrder(null)}>
            <DialogTrigger asChild>
              <span className="cursor-pointer text-primary hover:underline" onClick={() => setDemandDetailsOrder(order)}>
                {(order.poFcQty || 0).toLocaleString()}
              </span>
            </DialogTrigger>
          </Dialog>
        ) : (
          <span>{(order.poFcQty || 0).toLocaleString()}</span>
        )}
      </TableCell>
      
      {children}
      
      {demandDetailsOrder && (
          <DemandDetailsDialog
          order={demandDetailsOrder}
          isOpen={!!demandDetailsOrder}
          onOpenChange={(isOpen) => !isOpen && setDemandDetailsOrder(null)}
          />
      )}
    </TableRow>
  );
});
ForecastedOrderRow.displayName = 'ForecastedOrderRow';


export default function OrdersPage() {
  const { 
    orders, 
    scheduledProcesses, 
    updateSewingRampUpScheme, 
    sewingLines, 
    setSewingLines,
    updateOrderTna,
    updateOrderColor,
    updateOrderMinRunDays,
    updateOrderBom,
    processBatchSizes,
  } = useSchedule();

  const [expandedColumns, setExpandedColumns] = useState({
    projection: false,
    frc: false,
    cutOrder: false,
    produced: false,
    shipped: false,
  });
  const [poDetailsOrder, setPoDetailsOrder] = useState<Order | null>(null);
  const [demandDetailsOrder, setDemandDetailsOrder] = useState<Order | null>(null);
  const [projectionDetailsOrder, setProjectionDetailsOrder] = useState<Order | null>(null);

  const handleToggleColumn = (column: keyof typeof expandedColumns) => {
    setExpandedColumns(prev => ({ ...prev, [column]: !prev[column] }));
  };

  const handleGenerateTna = (order: Order) => {
    const numLines = sewingLines[order.id] || 1;
    const processBatchSize = processBatchSizes[order.id] || 0;
    const newTna = generateTnaPlan(order, PROCESSES, numLines, processBatchSize);
    updateOrderTna(order.id, newTna);
  };
  
  const firmOrders = useMemo(() => orders.filter(o => o.orderType === 'Firm PO'), [orders]);
  const forecastedOrders = useMemo(() => orders.filter(o => o.orderType === 'Forecasted'), [orders]);

  const isAnyForecastColumnExpanded = Object.values(expandedColumns).some(v => v);

  return (
    <div className="flex h-screen flex-col">
      <Header />
      <main className="flex-1 p-4 sm:p-6 lg:p-8">
        <Breadcrumb className="mb-4">
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link href="/">Home</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>Order Management</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
        <div className="space-y-4">
          <h1 className="text-2xl font-bold">Order Management</h1>
          <p className="text-muted-foreground">
            View all your orders in one place. Click on an Order ID to see details.
          </p>

          <Tabs defaultValue="firm">
            <TabsList>
              <TabsTrigger value="firm">Firm POs ({firmOrders.length})</TabsTrigger>
              <TabsTrigger value="forecasted">Forecasted ({forecastedOrders.length})</TabsTrigger>
            </TabsList>
            <TabsContent value="firm">
              <Card>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Order ID</TableHead>
                        <TableHead>Buyer</TableHead>
                        <TableHead>Order Type</TableHead>
                        <TableHead>Budgeted Eff.</TableHead>
                        <TableHead>Avg. Eff.</TableHead>
                        <TableHead>Days to Budget</TableHead>
                        <TableHead>Single Line Days</TableHead>
                        <TableHead>Display Color</TableHead>
                        <TableHead className="text-right">Quantity</TableHead>
                        <TableHead>Lead Time</TableHead>
                        <TableHead>Due Date</TableHead>
                        <TableHead>EHD</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {firmOrders.map((order) => (
                        <OrderRow 
                          key={order.id} 
                          order={order} 
                          onColorChange={updateOrderColor}
                          onTnaGenerate={() => handleGenerateTna(order)}
                          onRampUpSave={updateSewingRampUpScheme}
                          onSetSewingLines={setSewingLines}
                          numLines={sewingLines[order.id] || 1}
                          scheduledProcesses={scheduledProcesses}
                          updateOrderMinRunDays={updateOrderMinRunDays}
                        />
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>
            <TabsContent value="forecasted">
              <Card>
                 <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead rowSpan={isAnyForecastColumnExpanded ? 2 : 1}>Order ID</TableHead>
                        <TableHead rowSpan={isAnyForecastColumnExpanded ? 2 : 1}>Season</TableHead>
                        <TableHead rowSpan={isAnyForecastColumnExpanded ? 2 : 1}>Style</TableHead>
                        <TableHead rowSpan={isAnyForecastColumnExpanded ? 2 : 1}>Model no.</TableHead>
                        <TableHead className="text-right" rowSpan={isAnyForecastColumnExpanded ? 2 : 1}>Selection Quantity</TableHead>
                        <TableHead className="text-right" rowSpan={isAnyForecastColumnExpanded ? 2 : 1}>PO + FC</TableHead>
                        
                        <TableHead
                          colSpan={expandedColumns.projection ? 4 : 1}
                          rowSpan={expandedColumns.projection ? 1 : (isAnyForecastColumnExpanded ? 2 : 1)}
                          className="text-center"
                        >
                           <Button variant="ghost" size="sm" onClick={() => handleToggleColumn('projection')} className="w-full">
                              Projection
                              {expandedColumns.projection ? <ChevronDown className="h-4 w-4 ml-2" /> : <ChevronsRight className="h-4 w-4 ml-2" />}
                           </Button>
                        </TableHead>

                        <TableHead
                          colSpan={expandedColumns.frc ? 4 : 1}
                          rowSpan={expandedColumns.frc ? 1 : (isAnyForecastColumnExpanded ? 2 : 1)}
                          className="text-center"
                        >
                           <Button variant="ghost" size="sm" onClick={() => handleToggleColumn('frc')} className="w-full">
                              FRC
                              {expandedColumns.frc ? <ChevronDown className="h-4 w-4 ml-2" /> : <ChevronsRight className="h-4 w-4 ml-2" />}
                           </Button>
                        </TableHead>

                        <TableHead rowSpan={isAnyForecastColumnExpanded ? 2 : 1}>Confirmed PO</TableHead>
                        
                        <TableHead
                          colSpan={expandedColumns.cutOrder ? SIZES.length + 1 : 1}
                          rowSpan={expandedColumns.cutOrder ? 1 : (isAnyForecastColumnExpanded ? 2 : 1)}
                          className="text-center"
                        >
                           <Button variant="ghost" size="sm" onClick={() => handleToggleColumn('cutOrder')} className="w-full">
                              Cut Order
                              {expandedColumns.cutOrder ? <ChevronDown className="h-4 w-4 ml-2" /> : <ChevronsRight className="h-4 w-4 ml-2" />}
                           </Button>
                        </TableHead>
                        
                        <TableHead
                          colSpan={expandedColumns.produced ? SIZES.length + 1 : 1}
                          rowSpan={expandedColumns.produced ? 1 : (isAnyForecastColumnExpanded ? 2 : 1)}
                          className="text-center"
                        >
                           <Button variant="ghost" size="sm" onClick={() => handleToggleColumn('produced')} className="w-full">
                              Produced
                              {expandedColumns.produced ? <ChevronDown className="h-4 w-4 ml-2" /> : <ChevronsRight className="h-4 w-4 ml-2" />}
                           </Button>
                        </TableHead>

                        <TableHead
                          colSpan={expandedColumns.shipped ? SIZES.length + 1 : 1}
                          rowSpan={expandedColumns.shipped ? 1 : (isAnyForecastColumnExpanded ? 2 : 1)}
                          className="text-center"
                        >
                           <Button variant="ghost" size="sm" onClick={() => handleToggleColumn('shipped')} className="w-full">
                              Shipped
                              {expandedColumns.shipped ? <ChevronDown className="h-4 w-4 ml-2" /> : <ChevronsRight className="h-4 w-4 ml-2" />}
                           </Button>
                        </TableHead>

                        <TableHead rowSpan={isAnyForecastColumnExpanded ? 2 : 1}>Lead Time</TableHead>
                      </TableRow>
                      {isAnyForecastColumnExpanded && (
                        <TableRow>
                          {expandedColumns.projection && (
                            <>
                              <TableHead className="text-right">No PO</TableHead>
                              <TableHead className="text-right">Open POs</TableHead>
                              <TableHead className="text-right">GRN</TableHead>
                              <TableHead className="text-right font-bold">Total</TableHead>
                            </>
                          )}
                          
                          {expandedColumns.frc && (
                             <>
                              <TableHead className="text-right">No PO</TableHead>
                              <TableHead className="text-right">Open POs</TableHead>
                              <TableHead className="text-right">GRN</TableHead>
                              <TableHead className="text-right font-bold">Total</TableHead>
                             </>
                          )}
                          
                          {expandedColumns.cutOrder && (
                            <>
                              {SIZES.map(size => <TableHead key={`cut-${size}`} className="text-right">{size}</TableHead>)}
                              <TableHead className="text-right font-bold">Total</TableHead>
                            </>
                          )}
                          
                          {expandedColumns.produced && (
                            <>
                              {SIZES.map(size => <TableHead key={`prod-${size}`} className="text-right">{size}</TableHead>)}
                              <TableHead className="text-right font-bold">Total</TableHead>
                            </>
                          )}

                          {expandedColumns.shipped && (
                            <>
                              {SIZES.map(size => <TableHead key={`ship-${size}`} className="text-right">{size}</TableHead>)}
                              <TableHead className="text-right font-bold">Total</TableHead>
                            </>
                          )}
                        </TableRow>
                      )}
                    </TableHeader>
                    <TableBody>
                      {forecastedOrders.map((order) => (
                        <ForecastedOrderRow
                          key={order.id}
                          order={order}
                          onRampUpSave={updateSewingRampUpScheme}
                          onBomChange={updateOrderBom}
                          onSetSewingLines={setSewingLines}
                          numLines={sewingLines[order.id] || 1}
                        >
                          {expandedColumns.projection ? (
                            <>
                              <TableCell className="text-right">{order.projection?.noPo.toLocaleString() || '-'}</TableCell>
                              <TableCell className="text-right">{order.projection?.openPos.toLocaleString() || '-'}</TableCell>
                              <TableCell className="text-right">{order.projection?.grn.toLocaleString() || '-'}</TableCell>
                              <TableCell className="text-right font-bold">
                                {order.projectionDetails ? (
                                  <Dialog onOpenChange={(isOpen) => !isOpen && setProjectionDetailsOrder(null)}>
                                    <DialogTrigger asChild>
                                      <span className="cursor-pointer text-primary hover:underline" onClick={() => setProjectionDetailsOrder(order)}>
                                        {order.projection?.total.toLocaleString() || '-'}
                                      </span>
                                    </DialogTrigger>
                                  </Dialog>
                                ) : (
                                  <span>{order.projection?.total.toLocaleString() || '-'}</span>
                                )}
                              </TableCell>
                            </>
                          ) : (
                             <TableCell className="text-right font-bold">
                                {order.projection?.total && order.projectionDetails ? (
                                  <Dialog onOpenChange={(isOpen) => !isOpen && setProjectionDetailsOrder(null)}>
                                    <DialogTrigger asChild>
                                      <span className="cursor-pointer text-primary hover:underline" onClick={() => setProjectionDetailsOrder(order)}>
                                        {order.projection.total.toLocaleString()}
                                      </span>
                                    </DialogTrigger>
                                  </Dialog>
                                ) : (
                                  <span>{order.projection?.total?.toLocaleString() || '-'}</span>
                                )}
                              </TableCell>
                          )}
                          
                          {expandedColumns.frc ? (
                             <>
                              <TableCell className="text-right">{order.frc?.noPo.toLocaleString() || '-'}</TableCell>
                              <TableCell className="text-right">{order.frc?.openPos.toLocaleString() || '-'}</TableCell>
                              <TableCell className="text-right">{order.frc?.grn.toLocaleString() || '-'}</TableCell>
                              <TableCell className="text-right font-bold">{order.frc?.total.toLocaleString() || '-'}</TableCell>
                             </>
                          ) : (
                              <TableCell className="text-right font-bold">{order.frc?.total.toLocaleString() || '-'}</TableCell>
                          )}

                          <TableCell className="text-right font-bold">
                            {(order.poDetails && order.confirmedPoQty) ? (
                              <Dialog onOpenChange={(isOpen) => !isOpen && setPoDetailsOrder(null)}>
                                <DialogTrigger asChild>
                                  <span className="cursor-pointer text-primary hover:underline whitespace-nowrap" onClick={() => setPoDetailsOrder(order)}>
                                    {(order.confirmedPoQty || 0).toLocaleString()}
                                  </span>
                                </DialogTrigger>
                              </Dialog>
                            ) : (
                              <span>{(order.confirmedPoQty || 0).toLocaleString()}</span>
                            )}
                          </TableCell>
                          
                          {expandedColumns.cutOrder ? (
                            <>
                              {SIZES.map(size => <TableCell key={`cut-val-${size}`} className="text-right">{order.cutOrder?.[size]?.toLocaleString() || '-'}</TableCell>)}
                              <TableCell className="text-right font-bold">{order.cutOrder?.total.toLocaleString() || '-'}</TableCell>
                            </>
                          ) : (
                             <TableCell className="text-right font-bold">{order.cutOrder?.total.toLocaleString() || '-'}</TableCell>
                          )}

                          {expandedColumns.produced ? (
                            <>
                              {SIZES.map(size => <TableCell key={`prod-val-${size}`} className="text-right">{order.produced?.[size]?.toLocaleString() || '-'}</TableCell>)}
                              <TableCell className="text-right font-bold">{order.produced?.total.toLocaleString() || '-'}</TableCell>
                            </>
                          ) : (
                             <TableCell className="text-right font-bold">{order.produced?.total.toLocaleString() || '-'}</TableCell>
                          )}

                          {expandedColumns.shipped ? (
                            <>
                              {SIZES.map(size => <TableCell key={`ship-val-${size}`} className="text-right">{order.shipped?.[size]?.toLocaleString() || '-'}</TableCell>)}
                              <TableCell className="text-right font-bold">{order.shipped?.total.toLocaleString() || '-'}</TableCell>
                            </>
                          ) : (
                             <TableCell className="text-right font-bold">{order.shipped?.total.toLocaleString() || '-'}</TableCell>                          )}
                          
                          <TableCell>{order.leadTime ? `${order.leadTime} days` : '-'}</TableCell>
                        </ForecastedOrderRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </main>
      
      {poDetailsOrder && (
        <PoDetailsDialog 
          order={poDetailsOrder}
          isOpen={!!poDetailsOrder}
          onOpenChange={(isOpen) => !isOpen && setPoDetailsOrder(null)}
        />
      )}

      {demandDetailsOrder && (
        <DemandDetailsDialog
          order={demandDetailsOrder}
          isOpen={!!demandDetailsOrder}
          onOpenChange={(isOpen) => !isOpen && setDemandDetailsOrder(null)}
        />
      )}

      {projectionDetailsOrder && (
        <ProjectionDetailsDialog
          order={projectionDetailsOrder}
          isOpen={!!projectionDetailsOrder}
          onOpenChange={(isOpen) => !isOpen && setProjectionDetailsOrder(null)}
        />
      )}
    </div>
  );
}

    