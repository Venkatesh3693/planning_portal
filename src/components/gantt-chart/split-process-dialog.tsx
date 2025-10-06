
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
  process: ScheduledProcess;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirmSplit: (
    originalProcess: ScheduledProcess,
    newQuantities: number[]
  ) => void;
};

export default function SplitProcessDialog({
  process,
  isOpen,
  onOpenChange,
  onConfirmSplit,
}: SplitProcessDialogProps) {
  const [splits, setSplits] = useState<number[]>([process.quantity]);

  useEffect(() => {
    // Reset splits when a new process is selected
    setSplits([process.quantity]);
  }, [process]);

  const processInfo = useMemo(() => PROCESSES.find(p => p.id === process.processId), [process.processId]);
  const orderInfo = useMemo(() => ORDERS.find(o => o.id === process.orderId), [process.orderId]);

  const totalOriginalQuantity = process.quantity;

  const totalSplitQuantity = useMemo(() => {
    return splits.reduce((sum, qty) => sum + qty, 0);
  }, [splits]);

  const isInvalid = totalSplitQuantity !== totalOriginalQuantity || splits.some(q => q <= 0);

  const handleAddSplit = () => {
    // Distribute remaining quantity
    const remaining = totalOriginalQuantity - totalSplitQuantity;
    if (splits.length > 0 && remaining > 0) {
        const lastSplit = splits[splits.length - 1];
        if(lastSplit > 1) {
            const half = Math.floor(lastSplit / 2);
            const newSplits = [...splits.slice(0, -1), half, lastSplit - half];
            setSplits(newSplits);
        }
    } else {
        setSplits(prev => [...prev, 0]);
    }
  };

  const handleRemoveSplit = (index: number) => {
    if (splits.length <= 1) return;
    const removedQty = splits[index];
    const newSplits = splits.filter((_, i) => i !== index);
    // Add the removed quantity back to the first split
    if (newSplits.length > 0) {
        newSplits[0] += removedQty;
    }
    setSplits(newSplits);
  };

  const handleQuantityChange = (index: number, value: string) => {
    const newQuantity = parseInt(value, 10) || 0;
    const newSplits = [...splits];
    newSplits[index] = newQuantity;
    setSplits(newSplits);
  };

  const handleSubmit = () => {
    if (!isInvalid) {
      onConfirmSplit(process, splits);
    }
  };

  if (!processInfo || !orderInfo) return null;

  return (
    <AlertDialog open={isOpen} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Split Process: {processInfo.name}</AlertDialogTitle>
          <AlertDialogDescription>
            For Order {orderInfo.id}. Split the total quantity of{' '}
            {totalOriginalQuantity.toLocaleString()} units into smaller batches. The
            sum of all batches must equal the total quantity.
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
                    <span>Total Split Quantity:</span>
                    <span className={isInvalid ? 'text-destructive' : 'text-primary'}>
                        {totalSplitQuantity.toLocaleString()}
                    </span>
                </div>
                <div className="flex justify-between font-medium text-sm">
                    <span>Original Quantity:</span>
                    <span>
                        {totalOriginalQuantity.toLocaleString()}
                    </span>
                </div>
                {isInvalid && (
                     <p className="text-sm text-destructive text-right mt-1">
                        The sum of batches must equal the original quantity.
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
