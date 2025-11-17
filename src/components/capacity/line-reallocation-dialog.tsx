
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { PlusCircle, X, ArrowRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { MACHINE_NAME_ABBREVIATIONS } from '@/lib/data';

type ReallocationEntry = {
  id: number;
  sourceLineId: string;
  machineType: string;
  quantity: number;
};

type LineReallocationDialogProps = {
  targetLine: SewingLine;
  allLines: SewingLine[];
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (targetLineId: string, movedMachines: SewingMachine[]) => void;
};

let nextId = 0;

export default function LineReallocationDialog({
  targetLine,
  allLines,
  isOpen,
  onOpenChange,
  onSave,
}: LineReallocationDialogProps) {
  const [reallocations, setReallocations] = useState<ReallocationEntry[]>([
    { id: nextId++, sourceLineId: '', machineType: '', quantity: 1 },
  ]);

  const sourceLineOptions = useMemo(() => {
    return allLines.filter(l => l.id !== targetLine.id);
  }, [allLines, targetLine]);

  const sourceLineMachineCounts = useMemo(() => {
      const counts: Record<string, Record<string, number>> = {};
      sourceLineOptions.forEach(line => {
          counts[line.id] = {};
          line.machines.forEach(machine => {
              if (machine.isMoveable) {
                  const machineType = MACHINE_NAME_ABBREVIATIONS[machine.name] || machine.name;
                  counts[line.id][machineType] = (counts[line.id][machineType] || 0) + 1;
              }
          });
      });
      return counts;
  }, [sourceLineOptions]);
  
  const handleAddRow = () => {
    setReallocations(prev => [...prev, { id: nextId++, sourceLineId: '', machineType: '', quantity: 1 }]);
  };
  
  const handleRemoveRow = (id: number) => {
      setReallocations(prev => prev.filter(r => r.id !== id));
  };
  
  const handleUpdateRow = (id: number, field: keyof ReallocationEntry, value: string | number) => {
      setReallocations(prev => prev.map(r => {
        if (r.id === id) {
          const updated = { ...r, [field]: value };
          if (field === 'sourceLineId') updated.machineType = ''; // Reset machine type if source line changes
          return updated;
        }
        return r;
      }));
  };
  
  const isSaveDisabled = useMemo(() => {
      return reallocations.some(r => !r.sourceLineId || !r.machineType || r.quantity <= 0) ||
        reallocations.some(r => {
            const originalMachineName = Object.keys(MACHINE_NAME_ABBREVIATIONS).find(key => MACHINE_NAME_ABBREVIATIONS[key] === r.machineType) || r.machineType;
            const available = sourceLineOptions.find(l => l.id === r.sourceLineId)?.machines.filter(m => m.name === originalMachineName).length || 0;
            const requested = reallocations
                .filter(re => re.sourceLineId === r.sourceLineId && re.machineType === r.machineType)
                .reduce((sum, re) => sum + re.quantity, 0);
            return requested > available;
        });
  }, [reallocations, sourceLineOptions]);


  const handleSave = () => {
    const movedMachines: SewingMachine[] = [];
    const availableMachinesPool: Record<string, SewingMachine[]> = {};
    
    sourceLineOptions.forEach(line => {
      availableMachinesPool[line.id] = [...line.machines.filter(m => m.isMoveable)];
    });

    for (const realloc of reallocations) {
        if (!realloc.sourceLineId || !realloc.machineType || realloc.quantity <= 0) continue;

        const originalMachineName = Object.keys(MACHINE_NAME_ABBREVIATIONS).find(key => MACHINE_NAME_ABBREVIATIONS[key] === realloc.machineType) || realloc.machineType;

        for (let i = 0; i < realloc.quantity; i++) {
            const pool = availableMachinesPool[realloc.sourceLineId];
            const machineIndex = pool.findIndex(m => m.name === originalMachineName);
            if (machineIndex > -1) {
                const [machineToMove] = pool.splice(machineIndex, 1);
                movedMachines.push(machineToMove);
            }
        }
    }

    onSave(targetLine.id, movedMachines);
    onOpenChange(false);
  };
  
  useEffect(() => {
    if(isOpen) {
       setReallocations([{ id: nextId++, sourceLineId: '', machineType: '', quantity: 1 }]);
    }
  }, [isOpen]);

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Re-allocate Machines to {targetLine.name}</DialogTitle>
          <DialogDescription>
            Borrow movable machines from other lines and add them to this line.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4 max-h-[40vh] overflow-y-auto">
          {reallocations.map(realloc => {
            const availableTypes = Object.keys(sourceLineMachineCounts[realloc.sourceLineId] || {});
            const originalMachineName = Object.keys(MACHINE_NAME_ABBREVIATIONS).find(key => MACHINE_NAME_ABBREVIATIONS[key] === realloc.machineType) || realloc.machineType;
            const availableCount = sourceLineOptions.find(l => l.id === realloc.sourceLineId)?.machines.filter(m => m.name === originalMachineName).length || 0;

            const currentlyRequested = reallocations
              .filter(r => r.sourceLineId === realloc.sourceLineId && r.machineType === realloc.machineType)
              .reduce((sum, r) => sum + r.quantity, 0);

            return (
                <div key={realloc.id} className="grid grid-cols-[1fr_auto_1fr_80px_40px] items-center gap-x-4 px-4">
                  <Select value={realloc.sourceLineId} onValueChange={(val) => handleUpdateRow(realloc.id, 'sourceLineId', val)}>
                      <SelectTrigger><SelectValue placeholder="Source Line" /></SelectTrigger>
                      <SelectContent>
                          {sourceLineOptions.map(l => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
                      </SelectContent>
                  </Select>

                  <ArrowRight className="h-4 w-4 text-muted-foreground"/>

                  <Select value={realloc.machineType} onValueChange={(val) => handleUpdateRow(realloc.id, 'machineType', val)} disabled={!realloc.sourceLineId}>
                      <SelectTrigger><SelectValue placeholder="Machine Type" /></SelectTrigger>
                      <SelectContent>
                          {availableTypes.map(type => <SelectItem key={type} value={type}>{type}</SelectItem>)}
                      </SelectContent>
                  </Select>

                  <div className="relative">
                     <Input
                        type="number"
                        min="1"
                        max={availableCount}
                        value={realloc.quantity}
                        onChange={(e) => handleUpdateRow(realloc.id, 'quantity', parseInt(e.target.value, 10) || 1)}
                        className="text-right"
                      />
                      {realloc.machineType && (
                        <span className="absolute -bottom-4 right-1 text-xs text-muted-foreground">
                            {availableCount - currentlyRequested} / {availableCount} left
                        </span>
                      )}
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => handleRemoveRow(realloc.id)} className="justify-self-center">
                      <X className="h-4 w-4" />
                  </Button>
                </div>
            );
          })}
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
