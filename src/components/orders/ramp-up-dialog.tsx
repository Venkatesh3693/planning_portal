
'use client';

import { useState, useMemo, useEffect } from 'react';
import type { Order, RampUpEntry } from '@/lib/types';
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

type RampUpDialogProps = {
  order: Order;
  totalProductionDays: number;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (orderId: string, scheme: RampUpEntry[]) => void;
};

export default function RampUpDialog({
  order,
  totalProductionDays,
  isOpen,
  onOpenChange,
  onSave,
}: RampUpDialogProps) {
  const [scheme, setScheme] = useState<RampUpEntry[]>([]);

  useEffect(() => {
    if (order) {
      const initialScheme = order.sewingRampUpScheme || [
        { day: 1, efficiency: order.budgetedEfficiency || 85 },
      ];
      setScheme(initialScheme);
    }
  }, [order]);

  const averageEfficiency = useMemo(() => {
    if (scheme.length === 0 || totalProductionDays === 0) return 0;
    
    let weightedSum = 0;
    const sortedScheme = [...scheme].sort((a,b) => a.day - b.day);
    
    let lastDay = 0;
    let lastEfficiency = 0;
    
    for (const entry of sortedScheme) {
      const daysInThisStep = entry.day - lastDay;
      weightedSum += daysInThisStep * lastEfficiency;
      lastDay = entry.day;
      lastEfficiency = entry.efficiency;
    }
    
    // Add the final peak efficiency for the remaining days
    const remainingDays = totalProductionDays - lastDay + 1;
    if (remainingDays > 0) {
        const peakEfficiency = sortedScheme[sortedScheme.length -1].efficiency;
        weightedSum += remainingDays * peakEfficiency;
    }

    return weightedSum / totalProductionDays;

  }, [scheme, totalProductionDays]);

  const handleAddDay = () => {
    const nextDay = scheme.length > 0 ? Math.max(...scheme.map(s => s.day)) + 1 : 1;
    const lastEfficiency = scheme.length > 0 ? scheme[scheme.length - 1].efficiency : 0;
    setScheme([...scheme, { day: nextDay, efficiency: lastEfficiency }]);
  };

  const handleRemoveDay = (dayToRemove: number) => {
    setScheme(scheme.filter(s => s.day !== dayToRemove).map((s, i) => ({ ...s, day: i + 1 })));
  };

  const handleEfficiencyChange = (dayToChange: number, newEfficiency: number) => {
    setScheme(
      scheme.map(s =>
        s.day === dayToChange ? { ...s, efficiency: newEfficiency } : s
      )
    );
  };
  
  const handleDayChange = (oldDay: number, newDay: number) => {
     setScheme(
      scheme.map(s =>
        s.day === oldDay ? { ...s, day: newDay } : s
      ).sort((a,b) => a.day - b.day)
    );
  }

  const handleSave = () => {
    // Filter out empty/invalid entries before saving
    const validScheme = scheme
      .filter(s => s.efficiency > 0 && s.efficiency <= 100)
      .sort((a, b) => a.day - b.day);
    onSave(order.id, validScheme);
  };

  if (!order) return null;

  return (
    <AlertDialog open={isOpen} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Sewing Ramp-Up Scheme</AlertDialogTitle>
          <AlertDialogDescription>
            For Order {order.id}. Define the efficiency targets for the initial days of the sewing process.
            The last day entered is considered the peak efficiency.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto">
          <div className="grid grid-cols-[1fr_1fr_40px] items-center gap-x-4 gap-y-2 text-sm font-medium text-muted-foreground px-4">
            <span>Day</span>
            <span className="text-left">Target Efficiency (%)</span>
            <span></span>
          </div>

          {scheme.map((entry) => (
            <div
              key={entry.day}
              className="grid grid-cols-[1fr_1fr_40px] items-center gap-x-4 px-4"
            >
              <Input
                id={`day-${entry.day}`}
                type="number"
                min="1"
                value={entry.day}
                onChange={(e) => handleDayChange(entry.day, parseInt(e.target.value, 10) || 1)}
              />
              <Input
                id={`eff-${entry.day}`}
                type="number"
                min="1"
                max="100"
                value={entry.efficiency}
                onChange={(e) => handleEfficiencyChange(entry.day, parseInt(e.target.value, 10) || 0)}
              />
              {scheme.length > 1 && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleRemoveDay(entry.day)}
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
          
          <div className="px-4 pt-4 border-t mt-4">
            <div className="flex justify-between font-medium">
                <span>Weighted Avg. Efficiency:</span>
                <span className="text-primary">
                    {averageEfficiency.toFixed(2)}%
                </span>
            </div>
            <div className="flex justify-between text-sm text-muted-foreground">
                <span>Total Production Days:</span>
                <span>
                    {Math.ceil(totalProductionDays)}
                </span>
            </div>
          </div>
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={handleSave}>
            Save Scheme
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
