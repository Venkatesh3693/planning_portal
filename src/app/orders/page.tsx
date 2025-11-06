

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
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
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
import { Badge } from '@/components/ui/badge';
import { LineChart, Zap, AlertCircle, X, Info, ChevronsRight, ChevronDown, PlusCircle } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { generateTnaPlan } from '@/lib/tna-calculator';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import PoDetailsDialog from '@/components/orders/po-details-dialog';
import DemandDetailsDialog from '@/components/orders/demand-details-dialog';
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
       <Card>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 text-sm p-4">
            <div className="p-3 bg-muted rounded-md">
                <div className="font-medium text-muted-foreground text-xs">Budgeted Efficiency</div>
                <div className="font-semibold text-base">{order.budgetedEfficiency || 'N/A'}%</div>
            </div>
            <div className="p-3 bg-muted rounded-md">
                <div className="font-medium text-muted-foreground text-xs">Total Production Days</div>
                <div className="font-semibold text-base">{totalProductionDays.toFixed(2)}</div>
            </div>
            <div className="p-3 bg-muted rounded-md">
                <div className="font-medium text-muted-foreground text-xs">Weighted Avg. Efficiency</div>
                <div className="font-semibold text-base text-primary">{averageEfficiency.toFixed(2)}%</div>
            </div>
             <div className="p-3 bg-muted rounded-md flex flex-col justify-center">
                <Label htmlFor="num-lines-input" className="font-medium text-muted-foreground text-xs">Number of Lines</Label>
                <Input
                    id="num-lines-input"
                    type="number"
                    min="1"
                    value={numLines}
                    onChange={(e) => onNumLinesChange(parseInt(e.target.value, 10) || 1)}
                    className="w-full h-8 text-base bg-transparent border-0 shadow-none focus-visible:ring-0 px-0"
                />
            </div>
        </CardContent>
       </Card>

       <div className="space-y-4 py-4 max-h-[40vh] overflow-y-auto">
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
        </div>

        <div className="flex justify-end pt-4 border-t">
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
      return { totalSam: 0, totalTailors: 0, gradeCounts: { A: 0, B: 0, C: 0, D: 0 }, machineCounts: {} };
    }
    const totalSam = operations.reduce((sum, op) => sum + op.sam, 0);
    const totalTailors = operations.reduce((sum, op) => sum + op.operators, 0);
    const gradeCounts = operations.reduce((counts, op) => {
      counts[op.grade] = (counts[op.grade] || 0) + 1;
      return counts;
    }, { A: 0, B: 0, C: 0, D: 0 } as Record<string, number>);
    
    const machineCounts = operations.reduce((counts, op) => {
      const machineAbbr = MACHINE_NAME_ABBREVIATIONS[op.machine] || op.machine;
      counts[machineAbbr] = (counts[machineAbbr] || 0) + 1;
      return counts;
    }, {} as Record<string, number>);

    return { totalSam, totalTailors, gradeCounts, machineCounts };
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
       <div className="flex rounded-lg border bg-background dark:bg-card p-4 items-center">
        <div className="flex flex-col justify-center items-center px-6">
          <p className="text-sm text-muted-foreground">Total SAM</p>
          <p className="text-3xl font-bold">{summary.totalSam.toFixed(2)}</p>
        </div>
        <Separator orientation="vertical" className="h-16" />
        <div className="flex flex-col justify-center items-center px-6">
          <p className="text-sm text-muted-foreground">Total Tailors</p>
          <p className="text-3xl font-bold">{summary.totalTailors}</p>
        </div>
        <Separator orientation="vertical" className="h-16" />
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
  scheduledProcesses: ScheduledProcess[];
  updateOrderMinRunDays: (orderId: string, minRunDays: Record<string, number>) => void;
}

const OrderRow = forwardRef<HTMLTableRowElement, OrderRowProps>(
  ({ order, onColorChange, onTnaGenerate, onRampUpSave, onSetSewingLines, scheduledProcesses, updateOrderMinRunDays, ...props }, ref) => {
  const [isTnaOpen, setIsTnaOpen] = useState(false);
  const [activeView, setActiveView] = useState<'tna' | 'ob' | 'ramp-up'>('tna');

  const [minRunDays, setMinRunDays] = useState<Record<string, string>>({});
  
  const { processBatchSizes, sewingLines, setSewingLines: setGlobalSewingLines } = useSchedule();
  const numLines = sewingLines[order.id] || 1;
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
  
  const handleSetSewingLines = (lines: number) => {
    onSetSewingLines(order.id, lines);
    // Also update global state if needed, assuming the function exists
    if(setGlobalSewingLines) setGlobalSewingLines(order.id, lines);
  }

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
                {order.ocn} - {order.color}
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
                            <Button size="sm" variant={activeView === 'tna' ? 'default' : 'ghost'} onClick={() => setActiveView('tna')}>T&A Plan</Button>
                            <Button size="sm" variant={activeView === 'ob' ? 'default' : 'ghost'} onClick={() => setActiveView('ob')}>OB</Button>
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
                        onNumLinesChange={handleSetSewingLines}
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
          <ColorPicker 
            color={order.displayColor}
            onColorChange={(newColor) => onColorChange(order.id, newColor)}
          />
        </TableCell>
        <TableCell className="text-right">{order.quantity}</TableCell>
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

const WeeklyHotBreakdown = () => {
    // Dummy data for the weekly breakdown
    const weeklyData = [
        { week: 40, hot: 92.5 },
        { week: 41, hot: 95.1 },
        { week: 42, hot: 98.3 },
        { week: 43, hot: 97.2 },
    ];
    return (
        <Table>
            <TableHeader>
                <TableRow>
                    <TableHead>Week</TableHead>
                    <TableHead className="text-right">HOT %</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {weeklyData.map(d => (
                    <TableRow key={d.week}>
                        <TableCell>Week {d.week}</TableCell>
                        <TableCell className="text-right font-medium">{d.hot.toFixed(1)}%</TableCell>
                    </TableRow>
                ))}
            </TableBody>
        </Table>
    )
}

const ForecastedOrderRow = forwardRef<
  HTMLTableRowElement,
  {
    order: Order;
    onRampUpSave: (orderId: string, scheme: RampUpEntry[]) => void;
    onBomChange: (orderId: string, componentName: string, field: keyof BomItem, value: any) => void;
    onSetSewingLines: (orderId: string, lines: number) => void;
    onDemandDetailsOpen: (order: Order) => void;
    children?: React.ReactNode;
  }
>(({ order, onRampUpSave, onBomChange, onSetSewingLines, onDemandDetailsOpen, children, ...props }, ref) => {
  const [isTnaOpen, setIsTnaOpen] = useState(false);
  const [activeView, setActiveView] = useState<'tna' | 'ob' | 'bom' | 'ramp-up'>('tna');
  
  const { scheduledProcesses, processBatchSizes, updateOrderMinRunDays, sewingLines } = useSchedule();
  const [minRunDays, setMinRunDays] = useState<Record<string, string>>({});
  const numLines = sewingLines[order.id] || 1;

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
  
  const latestPoFcQty = useMemo(() => {
    if (!order.fcVsFcDetails || order.fcVsFcDetails.length === 0) {
      return order.poFcQty || 0;
    }
    const latestSnapshot = [...order.fcVsFcDetails].sort((a, b) => b.snapshotWeek - a.snapshotWeek)[0];
    
    return Object.values(latestSnapshot.forecasts).reduce((total, weekData) => {
      const weekTotal = weekData.total;
      return total + (weekTotal?.po || 0) + (weekTotal?.fc || 0);
    }, 0);
  }, [order]);

  // Dummy alert data
  const alerts = useMemo(() => {
    const hash = order.id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const critical = (hash % 3); // 0, 1, or 2
    const notCritical = (hash % 4) + 1; // 1, 2, 3, or 4
    return {
      critical: {
        count: critical,
        items: Array.from({ length: critical }, (_, i) => `Critical alert for ${order.ocn} #${i + 1}`)
      },
      notCritical: {
        count: notCritical,
        items: Array.from({ length: notCritical }, (_, i) => `Non-critical issue for ${order.ocn} #${i + 1}`)
      },
    };
  }, [order.id, order.ocn]);

  
  return (
    <TableRow ref={ref} {...props}>
      <TableCell>
        <Dialog open={isTnaOpen} onOpenChange={setIsTnaOpen}>
          <DialogTrigger asChild>
            <span className="font-medium text-primary cursor-pointer hover:underline">
              {order.ocn} - {order.color}
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
      <TableCell className="text-right">
          <span className="cursor-pointer text-primary hover:underline" onClick={() => onDemandDetailsOpen(order)}>
            {(order.quantity || 0).toLocaleString()}
          </span>
      </TableCell>
      <TableCell className="text-right font-medium">
        <Link href={`/demand-analysis?orderId=${order.id}`} passHref>
            <span className="text-primary cursor-pointer hover:underline">
                {(latestPoFcQty || 0).toLocaleString()}
            </span>
        </Link>
      </TableCell>
      
      <TableCell className="text-right font-bold">
        <Link href={`/projection-planning?ccNo=${order.ocn}&color=${order.color}`} passHref>
          <span className="text-primary cursor-pointer hover:underline">
            {(order.totalProjectionQty || 0).toLocaleString()}
          </span>
        </Link>
      </TableCell>
      
      <TableCell className="text-right font-bold">
        <Link href={`/frc-planning?ccNos=${order.ocn}&models=${encodeURIComponent(order.style + ' / ' + order.color)}`} passHref>
          <span className="text-primary cursor-pointer hover:underline">
              {(order.totalFrcQty || 0).toLocaleString()}
          </span>
        </Link>
      </TableCell>

      <TableCell className="text-right font-bold">
        <Link href={`/po-status?orderId=${order.id}`} passHref>
          <span className="text-primary cursor-pointer hover:underline">
            {(order.confirmedPoQty || 0).toLocaleString()}
          </span>
        </Link>
      </TableCell>
      
      <TableCell className="text-right font-bold">
        <Link href={`/cut-order?orderId=${order.id}`} passHref>
          <span className="text-primary cursor-pointer hover:underline">
            {order.cutOrder?.total.toLocaleString() || '-'}
          </span>
        </Link>
      </TableCell>

      <TableCell className="text-right font-bold">{order.produced?.total.toLocaleString() || '-'}</TableCell>

      <TableCell className="text-right font-bold">{order.shipped?.total.toLocaleString() || '-'}</TableCell>                          
      
       <TableCell>
        <Dialog>
            <DialogTrigger asChild>
                <span className="font-medium text-primary cursor-pointer hover:underline">95.5%</span>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Weekly HOT% for {order.id}</DialogTitle>
                </DialogHeader>
                <WeeklyHotBreakdown />
            </DialogContent>
        </Dialog>
      </TableCell>
      
      <TableCell>
        <Sheet>
          <SheetTrigger asChild>
            <div className="flex items-center gap-2 cursor-pointer text-sm">
                {alerts.critical.count > 0 && <Badge variant="destructive">{alerts.critical.count} Crit</Badge>}
                {alerts.notCritical.count > 0 && <Badge variant="secondary">{alerts.notCritical.count} Not Crit</Badge>}
            </div>
          </SheetTrigger>
          <SheetContent>
            <SheetHeader>
              <SheetTitle>Alerts for {order.ocn} - {order.color}</SheetTitle>
              <SheetDescription>
                Review critical and non-critical issues for this order.
              </SheetDescription>
            </SheetHeader>
            <div className="py-4 space-y-6">
                {alerts.critical.count > 0 && (
                    <div>
                        <h3 className="text-lg font-semibold text-destructive mb-2">Critical Alerts</h3>
                        <ul className="space-y-2">
                            {alerts.critical.items.map((alert, i) => (
                                <li key={`crit-${i}`} className="p-3 bg-destructive/10 border-l-4 border-destructive rounded-r-md">{alert}</li>
                            ))}
                        </ul>
                    </div>
                )}
                {alerts.notCritical.count > 0 && (
                    <div>
                        <h3 className="text-lg font-semibold text-yellow-600 mb-2">Not Critical Alerts</h3>
                         <ul className="space-y-2">
                            {alerts.notCritical.items.map((alert, i) => (
                                <li key={`noncrit-${i}`} className="p-3 bg-muted rounded-md">{alert}</li>
                            ))}
                        </ul>
                    </div>
                )}
            </div>
          </SheetContent>
        </Sheet>
      </TableCell>
    </TableRow>
  );
});
ForecastedOrderRow.displayName = 'ForecastedOrderRow';


export default function OrdersPage() {
  const { 
    appMode,
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

  const [demandDetailsOrder, setDemandDetailsOrder] = useState<Order | null>(null);

  const handleGenerateTna = (order: Order) => {
    const numLines = sewingLines[order.id] || 1;
    const processBatchSize = processBatchSizes[order.id] || 0;
    const newTna = generateTnaPlan(order, PROCESSES, numLines, processBatchSize);
    updateOrderTna(order.id, newTna);
  };
  
  const firmOrders = useMemo(() => orders.filter(o => o.orderType === 'Firm PO'), [orders]);
  const forecastedOrders = useMemo(() => orders.filter(o => o.orderType === 'Forecasted'), [orders]);

  return (
    <div className="flex h-screen flex-col">
      <Header />
      <main className="flex-1 p-4 sm:p-6 lg:p-8">
        <Breadcrumb className="mb-4">
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbPage>Order Management</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
        <div className="space-y-4">
          <h1 className="text-2xl font-bold">Order Management</h1>
          <p className="text-muted-foreground">
            View all your {appMode === 'gup' ? 'GUP' : 'GUT'} orders. Click on an Order ID to see details.
          </p>

          {appMode === 'gup' ? (
              <Card>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>CC-Color</TableHead>
                        <TableHead>Buyer</TableHead>
                        <TableHead>Order Type</TableHead>
                        <TableHead>Budgeted Eff.</TableHead>
                        <TableHead>Avg. Eff.</TableHead>
                        <TableHead>Days to Budget</TableHead>
                        <TableHead>Display Color</TableHead>
                        <TableHead className="text-right">Quantity</TableHead>
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
                          scheduledProcesses={scheduledProcesses}
                          updateOrderMinRunDays={updateOrderMinRunDays}
                        />
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
          ) : (
              <Card>
                 <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>CC-Color</TableHead>
                        <TableHead>Season</TableHead>
                        <TableHead>Style</TableHead>
                        <TableHead>Model no.</TableHead>
                        <TableHead className="text-right">Selection Quantity</TableHead>
                        <TableHead className="text-right">PO + FC</TableHead>
                        <TableHead className="text-right">PRJ Qty</TableHead>
                        <TableHead className="text-right">FRC Qty</TableHead>
                        <TableHead className="text-right">Confirmed PO</TableHead>
                        <TableHead className="text-right">Cut Order</TableHead>
                        <TableHead className="text-right">Produced</TableHead>
                        <TableHead className="text-right">Shipped</TableHead>
                        <TableHead>HOT</TableHead>
                        <TableHead>Alerts</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {forecastedOrders.map((order) => (
                        <ForecastedOrderRow
                          key={order.id}
                          order={order}
                          onRampUpSave={updateSewingRampUpScheme}
                          onBomChange={updateOrderBom}
                          onSetSewingLines={setSewingLines}
                          onDemandDetailsOpen={setDemandDetailsOrder}
                        />
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
          )}
        </div>
      </main>
      
      {demandDetailsOrder && (
        <DemandDetailsDialog
          order={demandDetailsOrder}
          isOpen={!!demandDetailsOrder}
          onOpenChange={(isOpen) => !isOpen && setDemandDetailsOrder(null)}
        />
      )}
    </div>
  );
}

