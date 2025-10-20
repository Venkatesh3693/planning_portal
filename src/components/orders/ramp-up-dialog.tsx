
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
import { PlusCircle, X } from 'lucide-react';

type RampUpDialogProps = {
  order: Order;
  singleLineMinDays: number;
  numLines: number;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (orderId: string, scheme: RampUpEntry[]) => void;
  calculateAverageEfficiency: (scheme: RampUpEntry[], totalProductionDays: number) => number;
};

// Use a local state type that can handle string for efficiency and has a unique id
type EditableRampUpEntry = {
  id: number;
  day: number | string;
  efficiency: number | string;
};

let nextId = 0;

export default function RampUpDialog({
  order,
  singleLineMinDays,
  numLines,
  isOpen,
  onOpenChange,
  onSave,
  calculateAverageEfficiency,
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
    onOpenChange(false);
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

          <div className="px-4 pt-4 border-t mt-4">
             <div className="flex justify-between text-sm text-muted-foreground">
                <span>Number of Lines:</span>
                <span>{numLines}</span>
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

        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={handleSave} disabled={hasDuplicateDays}>
            Save Scheme
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
