
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

// Use a local state type that can handle string for efficiency and has a unique id
type EditableRampUpEntry = {
  id: number;
  day: number;
  efficiency: number | string;
};

let nextId = 0;

export default function RampUpDialog({
  order,
  totalProductionDays,
  isOpen,
  onOpenChange,
  onSave,
}: RampUpDialogProps) {
  const [scheme, setScheme] = useState<EditableRampUpEntry[]>([]);

  useEffect(() => {
    if (order) {
      const initialScheme = (order.sewingRampUpScheme || [
        { day: 1, efficiency: order.budgetedEfficiency || 85 },
      ]).map(s => ({ ...s, id: nextId++ }));
      setScheme(initialScheme);
    }
  }, [order]);

  const averageEfficiency = useMemo(() => {
    if (scheme.length === 0 || totalProductionDays === 0 || totalProductionDays === Infinity) return 0;
    
    let weightedSum = 0;
    const sortedScheme = [...scheme]
      .map(s => ({ ...s, efficiency: Number(s.efficiency) || 0}))
      .filter(s => s.efficiency > 0)
      .sort((a,b) => a.day - b.day);
    
    let lastDay = 0;
    let lastEfficiency = 0;
    
    // Iterate through the defined ramp-up points
    for (const entry of sortedScheme) {
      // Days at the previous efficiency level
      const daysInThisStep = entry.day - lastDay;
      if (daysInThisStep > 0) {
        weightedSum += daysInThisStep * lastEfficiency;
      }
      lastDay = entry.day;
      lastEfficiency = entry.efficiency;
    }
    
    // Add the final peak efficiency for the remaining days
    const daysAtPeak = Math.ceil(totalProductionDays) - lastDay + 1;
    if (daysAtPeak > 0) {
        weightedSum += daysAtPeak * lastEfficiency;
    }

    return weightedSum / Math.ceil(totalProductionDays);

  }, [scheme, totalProductionDays]);

  const handleAddDay = () => {
    const nextDay = scheme.length > 0 ? Math.max(...scheme.map(s => s.day)) + 1 : 1;
    const lastEfficiency = scheme.length > 0 ? scheme[scheme.length - 1].efficiency : 0;
    setScheme([...scheme, { id: nextId++, day: nextDay, efficiency: lastEfficiency }]);
  };

  const handleRemoveDay = (idToRemove: number) => {
    setScheme(prevScheme => {
      const newScheme = prevScheme.filter(s => s.id !== idToRemove);
      return newScheme.sort((a,b) => a.day - b.day);
    });
  };

  const handleEfficiencyChange = (idToChange: number, newEfficiency: string) => {
    setScheme(
      scheme.map(s =>
        s.id === idToChange ? { ...s, efficiency: newEfficiency } : s
      )
    );
  };
  
  const handleDayChange = (idToChange: number, newDay: number) => {
     setScheme(
      scheme.map(s =>
        s.id === idToChange ? { ...s, day: newDay } : s
      ).sort((a,b) => a.day - b.day)
    );
  }

  const handleSave = () => {
    // Filter out empty/invalid entries and convert to number before saving
    const validScheme: RampUpEntry[] = scheme
      .map(s => ({
          day: s.day,
          efficiency: Number(s.efficiency) || 0
      }))
      .filter(s => s.efficiency > 0 && s.efficiency <= 100 && s.day > 0)
      .sort((a, b) => a.day - b.day);
      
    // Remove duplicate day entries, keeping the one with higher efficiency
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
              key={entry.id}
              className="grid grid-cols-[1fr_1fr_40px] items-center gap-x-4 px-4"
            >
              <Input
                id={`day-${entry.id}`}
                type="number"
                min="1"
                value={entry.day}
                onChange={(e) => handleDayChange(entry.id, parseInt(e.target.value, 10) || 1)}
              />
              <Input
                id={`eff-${entry.id}`}
                type="number"
                min="1"
                max="100"
                value={entry.efficiency}
                onChange={(e) => handleEfficiencyChange(entry.id, e.target.value)}
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
