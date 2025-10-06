
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
  process: ScheduledProcess | null;
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
  const [splits, setSplits] = useState<string[]>([]);

  useEffect(() => {
    // Reset splits when a new process is selected
    if (process) {
      setSplits([String(process.quantity)]);
    }
  }, [process]);
  
  const processInfo = useMemo(() => process ? PROCESSES.find(p => p.id === process.processId) : null, [process]);
  const orderInfo = useMemo(() => process ? ORDERS.find(o => o.id === process.orderId) : null, [process]);

  const totalOriginalQuantity = process?.quantity ?? 0;

  const totalSplitQuantity = useMemo(() => {
    return splits.reduce((sum, qty) => sum + (parseInt(qty, 10) || 0), 0);
  }, [splits]);

  const isInvalid = totalSplitQuantity !== totalOriginalQuantity || splits.some(q => (parseInt(q, 10) || 0) <= 0);

  const handleAddSplit = () => {
    setSplits(prev => [...prev, '0']);
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

  const handleSubmit = () => {
    if (!isInvalid && process) {
      const numericSplits = splits.map(s => parseInt(s, 10) || 0);
      onConfirmSplit(process, numericSplits);
    }
  };

  if (!process || !processInfo || !orderInfo) return null;

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
