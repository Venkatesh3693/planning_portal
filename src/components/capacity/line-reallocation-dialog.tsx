
'use client';

import { useState, useEffect, useMemo } from 'react';
import type { SewingLine, SewingMachineType } from '@/lib/types';
import { sewingMachineTypes } from '@/lib/data';
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
import { ArrowRight } from 'lucide-react';

type LineReallocationDialogProps = {
  targetLine: SewingLine;
  allLines: SewingLine[];
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (sourceLineId: string, targetLineId: string, machineType: SewingMachineType, quantity: number) => void;
};

export default function LineReallocationDialog({
  targetLine,
  allLines,
  isOpen,
  onOpenChange,
  onSave,
}: LineReallocationDialogProps) {
  const [sourceLineId, setSourceLineId] = useState<string>('');
  const [machineType, setMachineType] = useState<SewingMachineType | ''>('');
  const [quantity, setQuantity] = useState<number>(1);

  const sourceLineOptions = useMemo(() => {
    return allLines.filter(l => l.id !== targetLine.id);
  }, [allLines, targetLine]);

  const sourceLine = useMemo(() => {
    return allLines.find(l => l.id === sourceLineId);
  }, [allLines, sourceLineId]);
  
  const availableMachineTypes = useMemo(() => {
    if (!sourceLine) return [];
    return (Object.keys(sourceLine.machineCounts) as SewingMachineType[]).filter(
      type => (sourceLine.machineCounts[type] || 0) > 0
    );
  }, [sourceLine]);
  
  const maxQuantity = useMemo(() => {
    if (!sourceLine || !machineType) return 0;
    return sourceLine.machineCounts[machineType] || 0;
  }, [sourceLine, machineType]);


  useEffect(() => {
    if (isOpen) {
      setSourceLineId('');
      setMachineType('');
      setQuantity(1);
    }
  }, [isOpen]);
  
  useEffect(() => {
    if (!availableMachineTypes.includes(machineType as any)) {
      setMachineType('');
    }
    setQuantity(1);
  }, [sourceLineId, availableMachineTypes, machineType]);
  
  useEffect(() => {
    if(quantity > maxQuantity) {
      setQuantity(maxQuantity);
    }
  }, [machineType, quantity, maxQuantity])

  const handleSave = () => {
    if (sourceLineId && machineType && quantity > 0) {
      onSave(sourceLineId, targetLine.id, machineType, quantity);
    }
  };

  const isSaveDisabled = !sourceLineId || !machineType || quantity <= 0 || quantity > maxQuantity;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Re-allocate Machines to {targetLine.name}</DialogTitle>
          <DialogDescription>
            Move machines from a source line to this target line.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-x-4 py-8">
            <div className="space-y-2">
              <Label>Source Line</Label>
              <Select value={sourceLineId} onValueChange={setSourceLineId}>
                  <SelectTrigger><SelectValue placeholder="Select Source" /></SelectTrigger>
                  <SelectContent>
                      {sourceLineOptions.map(l => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
                  </SelectContent>
              </Select>
            </div>
             <ArrowRight className="h-5 w-5 text-muted-foreground mb-2" />
             <div className="space-y-2">
                <Label>Target Line</Label>
                <Input readOnly value={targetLine.name} className="bg-muted" />
            </div>
        </div>
        
        <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
                <Label>Machine Type</Label>
                <Select value={machineType} onValueChange={(val) => setMachineType(val as SewingMachineType)} disabled={!sourceLineId}>
                    <SelectTrigger><SelectValue placeholder="Select Type" /></SelectTrigger>
                    <SelectContent>
                        {availableMachineTypes.map(type => (
                           <SelectItem key={type} value={type}>
                                {type} (Available: {sourceLine?.machineCounts[type] || 0})
                           </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
            <div className="space-y-2">
                <Label>Quantity to Move</Label>
                 <Input
                    type="number"
                    min="1"
                    max={maxQuantity}
                    value={quantity}
                    onChange={(e) => setQuantity(parseInt(e.target.value, 10) || 1)}
                    disabled={!machineType}
                  />
            </div>
        </div>
        

        <DialogFooter className="mt-8">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={isSaveDisabled}>Confirm & Move</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
