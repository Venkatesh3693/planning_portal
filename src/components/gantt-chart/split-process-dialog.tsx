
'use client';

import { useState, useMemo, useEffect } from 'react';
import type { ScheduledProcess } from '@/lib/types';
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
import { PlusCircle, X } from 'lucide-react';
import { ORDERS, PROCESSES } from '@/lib/data';

type SplitProcessDialogProps = {
  processes: ScheduledProcess[] | null;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirmSplit: (
    originalProcesses: ScheduledProcess[],
    newQuantities: number[]
  ) => void;
};

export default function SplitProcessDialog({
  processes,
  isOpen,
  onOpenChange,
  onConfirmSplit,
}: SplitProcessDialogProps) {
  const [splits, setSplits] = useState<string[]>([]);
  
  const totalOriginalQuantity = useMemo(() => {
    if (!processes) return 0;
    // If it's a re-split, the parent is the source of truth for total quantity.
    // We find an original order to get this.
    const order = ORDERS.find(o => o.id === processes[0].orderId);
    const processInfo = PROCESSES.find(p => p.id === processes[0].processId);
    if (!order || !processInfo) return 0;
    
    // Find the original order quantity for this process
    const scheduledForThisProcess = processes.filter(p => p.processId === processInfo.id);
    const alreadyScheduled = scheduledForThisProcess.reduce((sum, p) => sum + p.quantity, 0);

    // If it's a fresh split, the process quantity is the original
    if (processes.length === 1 && !processes[0].isSplit) {
      return processes[0].quantity;
    }
    // If it is a re-split, the total is the sum of all siblings.
    return processes.reduce((sum, p) => sum + p.quantity, 0);

  }, [processes]);

  useEffect(() => {
    // Reset splits when a new process group is selected
    if (processes) {
      const initialSplits = processes.map(p => String(p.quantity));
      setSplits(initialSplits);
    }
  }, [processes]);

  const processInfo = useMemo(() => processes ? PROCESSES.find(p => p.id === processes[0].processId) : null, [processes]);
  const orderInfo = useMemo(() => processes ? ORDERS.find(o => o.id === processes[0].orderId) : null, [processes]);

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

  const handleSubmit = () => {
    if (!isInvalid && processes) {
      const numericSplits = splits.map(s => parseInt(s, 10) || 0).filter(q => q > 0);
      if (numericSplits.length > 0) {
        onConfirmSplit(processes, numericSplits);
      }
    }
  };

  if (!processes || !processInfo || !orderInfo) return null;
  const isResplit = processes.length > 1 || processes[0].isSplit;

  return (
    <AlertDialog open={isOpen} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{isResplit ? "Re-Split" : "Split"} Process: {processInfo.name}</AlertDialogTitle>
          <AlertDialogDescription>
            For Order {orderInfo.id}. Adjust the quantities for the total of{' '}
            {totalOriginalQuantity.toLocaleString()} units. The sum must equal the total.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto">
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
                readOnly={index === 0}
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

    