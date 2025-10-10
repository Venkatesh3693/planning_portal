
'use client';

import { useState, useMemo, useEffect } from 'react';
import type { Order, ScheduledProcess } from '@/lib/types';
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
import { PROCESSES } from '@/lib/data';
import { calculateProcessBatchSize } from '@/lib/tna-calculator';


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
    if (processes) {
      const initialSplits = processes.map(p => String(p.quantity));
      if (initialSplits.length === 1 && totalOriginalQuantity > 0) {
        // For a new split, show the remainder as the first item
        setSplits([String(totalOriginalQuantity), '0']);
      } else {
        setSplits(initialSplits);
      }
    } else {
       setSplits([]);
    }
  }, [processes, totalOriginalQuantity]);


  const processInfo = useMemo(() => processes ? PROCESSES.find(p => p.id === processes[0].processId) : null, [processes]);
  
  const processBatchSize = useMemo(() => {
    if (!order) return 0;
    return calculateProcessBatchSize(order, numLines);
  }, [order, numLines]);

  const remainingQuantity = useMemo(() => {
    const allocated = splits.slice(1).reduce((sum, qty) => sum + (parseInt(qty, 10) || 0), 0);
    return totalOriginalQuantity - allocated;
  }, [splits, totalOriginalQuantity]);

  const isInvalid = remainingQuantity < 0 || splits.some((q, i) => i > 0 && (parseInt(q, 10) || 0) < 0);
  
  const handleAddSplit = () => {
    setSplits(prev => [...prev, '0']);
  };

  const handleRemoveSplit = (index: number) => {
    if (splits.length <= 2) return; // Always keep remainder and at least one user batch
    setSplits(prev => prev.filter((_, i) => i !== index));
  };

  const handleQuantityChange = (index: number, value: string) => {
    const newSplits = [...splits];
    newSplits[index] = value;
    setSplits(newSplits);
  };
  
  const handleSubmit = () => {
    if (!isInvalid && processes) {
      const finalSplits = [remainingQuantity, ...splits.slice(1).map(s => parseInt(s, 10) || 0)];
      const numericSplits = finalSplits.filter(q => q > 0);
      if (numericSplits.length > 0) {
        onConfirmSplit(processes, numericSplits);
      }
    }
  };

  if (!processes || !processInfo || !order) return null;
  const isResplit = processes.length > 1 || processes[0].isSplit;

  return (
    <AlertDialog open={isOpen} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{isResplit ? "Re-Split" : "Split"} Process: {processInfo.name}</AlertDialogTitle>
          <AlertDialogDescription>
            For Order {order.id}. Define the quantities for each batch. The total must equal {totalOriginalQuantity.toLocaleString()} units.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto">
          <div className="grid grid-cols-[1fr_120px_40px] items-center gap-x-4 gap-y-2 text-sm font-medium text-muted-foreground px-4">
            <span>Batch</span>
            <span className="text-right">Quantity</span>
            <span></span>
          </div>

          <div className="grid grid-cols-[1fr_120px_40px] items-center gap-x-4 px-4">
             <Label>Remainder</Label>
             <Input
                readOnly
                value={remainingQuantity}
                className="text-right bg-muted"
             />
             <span></span>
          </div>
          
          {splits.slice(1).map((quantity, index) => {
            const realIndex = index + 1;
            return (
                <div
                    key={realIndex}
                    className="grid grid-cols-[1fr_120px_40px] items-center gap-x-4 px-4"
                >
                    <Label htmlFor={`split-qty-${realIndex}`}>Batch {realIndex}</Label>
                    <Input
                    id={`split-qty-${realIndex}`}
                    type="number"
                    min="0"
                    value={quantity}
                    onChange={(e) => handleQuantityChange(realIndex, e.target.value)}
                    className="text-right"
                    />
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleRemoveSplit(realIndex)}
                        className="justify-self-center"
                        >
                        <X className="h-4 w-4" />
                    </Button>
                </div>
            );
          })}

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

            {isInvalid && (
                 <p className="px-4 text-sm text-destructive text-right mt-1">
                    Total allocated quantity cannot exceed {totalOriginalQuantity.toLocaleString()}.
                </p>
            )}

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
