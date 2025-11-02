
'use client';

import { useState, useEffect, useMemo } from 'react';
import type { SewingLine, SewingMachine } from '@/lib/types';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { PlusCircle, X, ArrowRight } from 'lucide-react';
import { MACHINE_NAME_ABBREVIATIONS } from '@/lib/data';

type ReallocationEntry = {
  id: number;
  machineType: string;
  quantity: number;
  targetLineId: string;
};

type LineReallocationDialogProps = {
  line: SewingLine;
  allLines: SewingLine[];
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (sourceLineId: string, movedMachines: SewingMachine[]) => void;
};

let nextId = 0;

export default function LineReallocationDialog({
  line,
  allLines,
  isOpen,
  onOpenChange,
  onSave,
}: LineReallocationDialogProps) {
  const [reallocations, setReallocations] = useState<ReallocationEntry[]>([
    { id: nextId++, machineType: '', quantity: 1, targetLineId: '' },
  ]);

  const sourceMachineCounts = useMemo(() => {
    return line.machines.reduce((acc, machine) => {
        if(machine.isMoveable) {
            acc[machine.name] = (acc[machine.name] || 0) + 1;
        }
        return acc;
    }, {} as Record<string, number>);
  }, [line]);

  const remainingMachineCounts = useMemo(() => {
      const remaining = { ...sourceMachineCounts };
      reallocations.forEach(r => {
          if (r.machineType && remaining[r.machineType]) {
              remaining[r.machineType] -= r.quantity;
          }
      });
      return remaining;
  }, [sourceMachineCounts, reallocations]);
  
  const moveableMachineTypes = Object.keys(sourceMachineCounts);

  const handleAddRow = () => {
    setReallocations(prev => [...prev, { id: nextId++, machineType: '', quantity: 1, targetLineId: '' }]);
  };
  
  const handleRemoveRow = (id: number) => {
      setReallocations(prev => prev.filter(r => r.id !== id));
  };
  
  const handleUpdateRow = (id: number, field: keyof ReallocationEntry, value: string | number) => {
      setReallocations(prev => prev.map(r => r.id === id ? {...r, [field]: value} : r));
  };

  const isSaveDisabled = useMemo(() => {
    return Object.values(remainingMachineCounts).some(v => v < 0) || reallocations.some(r => !r.machineType || !r.targetLineId || r.quantity <= 0);
  }, [remainingMachineCounts, reallocations]);

  const handleSave = () => {
    const movedMachines: SewingMachine[] = [];
    const sourceMachinesPool = [...line.machines.filter(m => m.isMoveable)];

    reallocations.forEach(realloc => {
        if (!realloc.machineType || !realloc.targetLineId || realloc.quantity <= 0) return;

        for (let i = 0; i < realloc.quantity; i++) {
            const machineIndex = sourceMachinesPool.findIndex(m => m.name === realloc.machineType);
            if (machineIndex > -1) {
                const [machineToMove] = sourceMachinesPool.splice(machineIndex, 1);
                movedMachines.push({
                    ...machineToMove,
                    lineId: realloc.targetLineId,
                });
            }
        }
    });

    onSave(line.id, movedMachines);
    onOpenChange(false);
  };
  
  useEffect(() => {
    if(isOpen) {
       setReallocations([{ id: nextId++, machineType: '', quantity: 1, targetLineId: '' }]);
    }
  }, [isOpen]);
  
  const otherLines = allLines.filter(l => l.id !== line.id);

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Re-allocate Machines from {line.name}</DialogTitle>
          <DialogDescription>
            Borrow movable machines from this line and move them to other lines.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap gap-2 p-4 border rounded-lg bg-muted/50">
            <span className="text-sm font-semibold">Available to move:</span>
            {moveableMachineTypes.map(type => (
                <Badge key={type} variant={remainingMachineCounts[type] < 0 ? 'destructive': 'secondary'}>
                    {MACHINE_NAME_ABBREVIATIONS[type] || type}: {remainingMachineCounts[type] || 0} / {sourceMachineCounts[type]}
                </Badge>
            ))}
        </div>

        <div className="space-y-4 py-4 max-h-[40vh] overflow-y-auto">
          {reallocations.map(realloc => (
            <div key={realloc.id} className="grid grid-cols-[1fr_80px_auto_1fr_40px] items-center gap-x-4 px-4">
              <Select value={realloc.machineType} onValueChange={(val) => handleUpdateRow(realloc.id, 'machineType', val)}>
                <SelectTrigger><SelectValue placeholder="Machine Type" /></SelectTrigger>
                <SelectContent>
                    {moveableMachineTypes.map(type => <SelectItem key={type} value={type}>{type}</SelectItem>)}
                </SelectContent>
              </Select>
              <Input
                type="number"
                min="1"
                value={realloc.quantity}
                onChange={(e) => handleUpdateRow(realloc.id, 'quantity', parseInt(e.target.value, 10) || 1)}
                className="text-right"
              />
              <ArrowRight className="h-4 w-4 text-muted-foreground"/>
              <Select value={realloc.targetLineId} onValueChange={(val) => handleUpdateRow(realloc.id, 'targetLineId', val)}>
                <SelectTrigger><SelectValue placeholder="Target Line" /></SelectTrigger>
                <SelectContent>
                  {otherLines.map(l => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
                </SelectContent>
              </Select>
              <Button variant="ghost" size="icon" onClick={() => handleRemoveRow(realloc.id)} className="justify-self-center">
                  <X className="h-4 w-4" />
              </Button>
            </div>
          ))}
          <div className="px-4">
            <Button variant="link" size="sm" onClick={handleAddRow} className="p-0 h-auto">
              <PlusCircle className="mr-2 h-4 w-4" />
              Add Move
            </Button>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={isSaveDisabled}>Confirm & Move Machines</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

