
'use client';

import { useState, useMemo, useEffect } from 'react';
import type { Order, Process, ScheduledProcess } from '@/lib/types';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PlusCircle, X, Zap } from 'lucide-react';
import { ORDERS, PROCESSES, WORK_DAY_MINUTES } from '@/lib/data';
import { getProcessBatchSize, getPackingBatchSize } from '@/lib/tna-calculator';


type SplitProcessDialogProps = {
  processes: ScheduledProcess[] | null;
  order: Order | null;
  numLines: number;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirmSplit: (
    originalProcesses: ScheduledProcess[],
    newValues: number[]
  ) => void;
  splitBy?: 'quantity' | 'duration';
};


export default function SplitProcessDialog({
  processes,
  order,
  numLines,
  isOpen,
  onOpenChange,
  onConfirmSplit,
  splitBy = 'quantity'
}: SplitProcessDialogProps) {
  const [splits, setSplits] = useState<string[]>([]);
  
  const { totalOriginalValue, unitLabel, isDurationSplit } = useMemo(() => {
    if (!processes || !order) return { totalOriginalValue: 0, unitLabel: 'Units', isDurationSplit: false };

    const isDuration = splitBy === 'duration';
    const total = isDuration
      ? processes.reduce((sum, p) => sum + p.durationMinutes, 0) / WORK_DAY_MINUTES
      : processes.reduce((sum, p) => sum + p.quantity, 0);
      
    return { 
      totalOriginalValue: total, 
      unitLabel: isDuration ? 'Days' : 'Units',
      isDurationSplit: isDuration,
    };
  }, [processes, order, splitBy]);


  useEffect(() => {
    if (processes) {
      const initialSplits = processes.map(p => {
        if (isDurationSplit) {
          return (p.durationMinutes / WORK_DAY_MINUTES).toFixed(2);
        }
        return String(p.quantity);
      });
      setSplits(initialSplits);
    }
  }, [processes, isDurationSplit]);

  const processInfo = useMemo(() => processes ? PROCESSES.find(p => p.id === processes[0].processId) : null, [processes]);
  
  const processBatchSize = useMemo(() => {
    if (!order || !processInfo) return 0;
    if (processInfo.id === 'packing') {
      return getPackingBatchSize(order, PROCESSES);
    }
    return getProcessBatchSize(order, PROCESSES, numLines);
  }, [order, processInfo, numLines]);


  const totalSplitValue = useMemo(() => {
    return splits.reduce((sum, val) => sum + (parseFloat(val) || 0), 0);
  }, [splits]);
  
  const isInvalid = Math.abs(totalSplitValue - totalOriginalValue) > 0.01 || splits.some(q => (parseFloat(q) || 0) < 0);

  const handleAddSplit = () => {
    const newSplits = [...splits, '0'];
    setSplits(newSplits);
  };

  const handleRemoveSplit = (index: number) => {
    if (splits.length <= 1) return;
    const newSplits = splits.filter((_, i) => i !== index);
    setSplits(newSplits);
  };

  const handleQuantityChange = (index: number, value: string) => {
    const newSplits = [...splits];
    newSplits[index] = value;
    setSplits(newSplits);
  };

  const handlePrefillByBatch = () => {
    if (processBatchSize <= 0 || totalOriginalValue <= 0 || isDurationSplit) return;

    const numFullBatches = Math.floor(totalOriginalValue / processBatchSize);
    const remainder = totalOriginalValue % processBatchSize;

    const newSplits: string[] = [];

    for (let i = 0; i < numFullBatches; i++) {
      newSplits.push(String(processBatchSize));
    }

    if (remainder > 0) {
      newSplits.push(String(remainder));
    }

    setSplits(newSplits.length > 0 ? newSplits : ['0']);
  };

  const handleSubmit = () => {
    if (!isInvalid && processes) {
      const numericSplits = splits.map(s => parseFloat(s) || 0).filter(q => q > 0);
      if (numericSplits.length > 0) {
        onConfirmSplit(processes, numericSplits);
      }
    }
  };

  if (!processes || !processInfo || !order) return null;
  const isResplit = processes.length > 1 || processes[0].isSplit;

  const sewingProcessIndex = order.processIds.indexOf('sewing');
  const currentProcessIndex = order.processIds.indexOf(processInfo.id);

  const isPreSewing = sewingProcessIndex !== -1 && currentProcessIndex < sewingProcessIndex;
  
  const canSplitByBatch = processInfo.id !== 'sewing' && !isDurationSplit;


  return (
    <AlertDialog open={isOpen} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{isResplit ? "Re-Split" : "Split"} Process: {processInfo.name}</AlertDialogTitle>
          <AlertDialogDescription>
            For Order {order.id}. Adjust the values for the total of{' '}
            {totalOriginalValue.toLocaleString(undefined, { maximumFractionDigits: 2 })} {unitLabel}. The sum must equal the total.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto">
          {canSplitByBatch && (
            <div className="px-4 pb-4 border-b">
                <div className="flex items-center justify-between text-sm">
                    <p className="text-muted-foreground">{isPreSewing ? 'Process Batch Size:' : 'Packing Batch Size:'}</p>
                    <p className="font-semibold">{Math.round(processBatchSize).toLocaleString()}</p>
                </div>
                <Button variant="outline" size="sm" className="w-full mt-2" onClick={handlePrefillByBatch}>
                    <Zap className="mr-2 h-4 w-4" />
                    Split by Suggested Batch Size
                </Button>
            </div>
          )}
          
          <div className="grid grid-cols-[1fr_120px_40px] items-center gap-x-4 gap-y-2 text-sm font-medium text-muted-foreground px-4">
            <span>Batch</span>
            <span className="text-right">{unitLabel}</span>
            <span></span>
          </div>

          {splits.map((value, index) => (
            <div
              key={index}
              className="grid grid-cols-[1fr_120px_40px] items-center gap-x-4 px-4"
            >
              <Label htmlFor={`split-val-${index}`}>Batch {index + 1}</Label>
              <Input
                id={`split-val-${index}`}
                type="number"
                min="0"
                step={isDurationSplit ? "0.1" : "1"}
                value={value}
                onChange={(e) => handleQuantityChange(index, e.target.value)}
                className="text-right"
              />
              {splits.length > 1 && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleRemoveSplit(index)}
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
                    onClick={handleAddSplit}
                    className="p-0 h-auto"
                >
                    <PlusCircle className="mr-2 h-4 w-4" />
                    Add Batch
                </Button>
            </div>

            <div className="px-4 pt-2 border-t mt-4">
                <div className="flex justify-between font-medium">
                    <span>Total Split {isDurationSplit ? 'Duration' : 'Quantity'}:</span>
                    <span className={isInvalid ? 'text-destructive' : 'text-primary'}>
                        {totalSplitValue.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                    </span>
                </div>
                <div className="flex justify-between font-medium text-sm">
                    <span>Original Total:</span>
                    <span>
                        {totalOriginalValue.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                    </span>
                </div>
                {isInvalid && (
                     <p className="text-sm text-destructive text-right mt-1">
                        Total must be exactly {totalOriginalValue.toLocaleString(undefined, { maximumFractionDigits: 2 })}.
                    </p>
                )}
            </div>

        </div>

        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={handleSubmit} disabled={isInvalid}>
            Confirm Split
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
