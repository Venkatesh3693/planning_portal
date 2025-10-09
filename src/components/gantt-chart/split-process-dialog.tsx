
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

type SplitProcessDialogProps = {
  processes: ScheduledProcess[] | null;
  order: Order | null;
  numLines: number;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirmSplit: (
    originalProcesses: ScheduledProcess[],
    newQuantities: number[]
  ) => void;
};

// This function needs to be self-contained or imported if it's in a shared utility file.
const calculateProcessBatchSize = (order: Order, sewingLines: number) => {
    if (!order.tna?.minRunDays) return order.quantity / 5;

    let maxMoq = 0;
    const sewingProcessIndex = order.processIds.indexOf('sewing');
    
    order.processIds.forEach((processId, index) => {
        if (sewingProcessIndex !== -1 && index > sewingProcessIndex) {
            return;
        }

        const process = PROCESSES.find(p => p.id === processId)!;
        const days = order.tna?.minRunDays?.[process.id] || 1;
        let currentMoq = 0;

        if (days > 0) {
            if (process.id === 'sewing') {
                const durationMinutes = days * WORK_DAY_MINUTES;
                const peakEfficiency = (order.sewingRampUpScheme || []).reduce((max, s) => Math.max(max, s.efficiency), order.budgetedEfficiency || 85);
                const effectiveSam = process.sam / (peakEfficiency / 100);
                const outputPerMinute = (1 / effectiveSam) * sewingLines;
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


export default function SplitProcessDialog({
  processes,
  order,
  numLines,
  isOpen,
  onOpenChange,
  onConfirmSplit,
}: SplitProcessDialogProps) {
  const [splits, setSplits] = useState<string[]>([]);
  
  const totalOriginalQuantity = useMemo(() => {
    if (!processes || !order) return 0;
    
    // If it's a fresh split, the process quantity is the original
    if (processes.length === 1 && !processes[0].isSplit) {
      return processes[0].quantity;
    }
    // If it is a re-split, the total is the sum of all siblings.
    return processes.reduce((sum, p) => sum + p.quantity, 0);

  }, [processes, order]);

  useEffect(() => {
    // Reset splits when a new process group is selected
    if (processes) {
      const initialSplits = processes.map(p => String(p.quantity));
      setSplits(initialSplits);
    }
  }, [processes]);

  const processInfo = useMemo(() => processes ? PROCESSES.find(p => p.id === processes[0].processId) : null, [processes]);
  
  const processBatchSize = useMemo(() => {
    if (!order) return 0;
    return calculateProcessBatchSize(order, numLines);
  }, [order, numLines]);


  const totalSplitQuantity = useMemo(() => {
    return splits.reduce((sum, qty) => sum + (parseInt(qty, 10) || 0), 0);
  }, [splits]);
  
  const remainingQuantity = totalOriginalQuantity - splits.slice(1).reduce((sum, qty) => sum + (parseInt(qty, 10) || 0), 0);

  const isInvalid = totalSplitQuantity !== totalOriginalQuantity || splits.some(q => (parseInt(q, 10) || 0) < 0);

  const handleAddSplit = () => {
    const newSplits = [...splits, '0'];
    const subsequentSplitsQuantity = newSplits.slice(1).reduce((sum, qty) => sum + (parseInt(qty, 10) || 0), 0);
    const newFirstSplitQuantity = totalOriginalQuantity - subsequentSplitsQuantity;
    newSplits[0] = String(newFirstSplitQuantity);
    setSplits(newSplits);
  };

  const handleRemoveSplit = (index: number) => {
    if (splits.length <= 1) return;
    const newSplits = splits.filter((_, i) => i !== index);
    const subsequentSplitsQuantity = newSplits.slice(1).reduce((sum, qty) => sum + (parseInt(qty, 10) || 0), 0);
    const newFirstSplitQuantity = totalOriginalQuantity - subsequentSplitsQuantity;
    newSplits[0] = String(newFirstSplitQuantity);
    setSplits(newSplits);
  };

  const handleQuantityChange = (index: number, value: string) => {
    const newSplits = [...splits];
    newSplits[index] = value;
    
    // Recalculate the first split's quantity if other batches change
    if (index > 0) {
      const subsequentSplitsQuantity = newSplits.slice(1).reduce((sum, qty) => sum + (parseInt(qty, 10) || 0), 0);
      const newFirstSplitQuantity = totalOriginalQuantity - subsequentSplitsQuantity;
      newSplits[0] = String(newFirstSplitQuantity < 0 ? 0 : newFirstSplitQuantity);
    }
    
    setSplits(newSplits);
  };

  const handlePrefillByBatch = () => {
    if (processBatchSize <= 0 || totalOriginalQuantity <= 0) return;

    const numFullBatches = Math.floor(totalOriginalQuantity / processBatchSize);
    const remainder = totalOriginalQuantity % processBatchSize;

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
      const numericSplits = splits.map(s => parseInt(s, 10) || 0).filter(q => q > 0);
      if (numericSplits.length > 0) {
        onConfirmSplit(processes, numericSplits);
      }
    }
  };

  if (!processes || !processInfo || !order) return null;
  const isResplit = processes.length > 1 || processes[0].isSplit;

  const sewingProcessIndex = order.processIds.indexOf('sewing');
  const packingProcessIndex = order.processIds.indexOf('packing');
  const currentProcessIndex = order.processIds.indexOf(processInfo.id);

  const canSplitByBatch = (sewingProcessIndex > -1 && currentProcessIndex < sewingProcessIndex) || 
                          (packingProcessIndex > -1 && currentProcessIndex < packingProcessIndex);


  return (
    <AlertDialog open={isOpen} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{isResplit ? "Re-Split" : "Split"} Process: {processInfo.name}</AlertDialogTitle>
          <AlertDialogDescription>
            For Order {order.id}. Adjust the quantities for the total of{' '}
            {totalOriginalQuantity.toLocaleString()} units. The sum must equal the total.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto">
          {canSplitByBatch && (
            <div className="px-4 pb-4 border-b">
                <div className="flex items-center justify-between text-sm">
                    <p className="text-muted-foreground">Process Batch Size:</p>
                    <p className="font-semibold">{Math.round(processBatchSize).toLocaleString()}</p>
                </div>
                <Button variant="outline" size="sm" className="w-full mt-2" onClick={handlePrefillByBatch}>
                    <Zap className="mr-2 h-4 w-4" />
                    Split by Process Batch
                </Button>
            </div>
          )}
          {processInfo.id === 'sewing' && numLines > 0 && !canSplitByBatch && (
            <div className="px-4">
              <p className="text-sm text-muted-foreground">
                Recommended number of lines: <span className="font-semibold text-foreground">{numLines}</span>
              </p>
            </div>
          )}
          <div className="grid grid-cols-[1fr_100px_40px] items-center gap-x-4 gap-y-2 text-sm font-medium text-muted-foreground px-4">
            <span>Batch</span>
            <span className="text-right">Quantity</span>
            <span></span>
          </div>

          {splits.map((quantity, index) => (
            <div
              key={index}
              className="grid grid-cols-[1fr_100px_40px] items-center gap-x-4 px-4"
            >
              <Label htmlFor={`split-qty-${index}`}>Batch {index + 1}</Label>
              <Input
                id={`split-qty-${index}`}
                type="number"
                min="0"
                value={quantity}
                readOnly={index > 0 && canSplitByBatch} // Make subsequent splits read-only if we are using the batch prefill logic as primary
                onChange={(e) => handleQuantityChange(index, e.target.value)}
                className="text-right"
              />
              {index > 0 && (
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
                    <span>Total Split Quantity:</span>
                    <span className={totalSplitQuantity !== totalOriginalQuantity ? 'text-destructive' : 'text-primary'}>
                        {totalSplitQuantity.toLocaleString()}
                    </span>
                </div>
                <div className="flex justify-between font-medium text-sm">
                    <span>Original Quantity:</span>
                    <span>
                        {totalOriginalQuantity.toLocaleString()}
                    </span>
                </div>
                {isInvalid && totalSplitQuantity !== totalOriginalQuantity && (
                     <p className="text-sm text-destructive text-right mt-1">
                        Total must be exactly {totalOriginalQuantity.toLocaleString()}.
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
