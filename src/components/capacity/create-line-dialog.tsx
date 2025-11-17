
'use client';

import { useState, useEffect, useMemo } from 'react';
import type { SewingLine, SewingMachineType } from '@/lib/types';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PlusCircle, X } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';

type Transfer = {
  id: string;
  sourceLineId: string;
  machineType: SewingMachineType | '';
  quantity: number;
};

type CreateLineDialogProps = {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  allLines: SewingLine[];
  onSave: (lineName: string, transfers: { sourceLineId: string; machineType: SewingMachineType; quantity: number }[]) => void;
};

export default function CreateLineDialog({ isOpen, onOpenChange, allLines, onSave }: CreateLineDialogProps) {
  const [lineName, setLineName] = useState('');
  const [transfers, setTransfers] = useState<Transfer[]>([]);

  useEffect(() => {
    if (isOpen) {
      const lineNumbers = allLines
        .map(line => {
            const match = line.name.match(/^Line (\d+)$/);
            return match ? parseInt(match[1], 10) : 0;
        })
        .filter(num => num > 0);

      const nextLineNumber = lineNumbers.length > 0 ? Math.max(...lineNumbers) + 1 : allLines.length + 1;
      
      setLineName(`Line ${nextLineNumber}`);
      setTransfers([{ id: crypto.randomUUID(), sourceLineId: '', machineType: '', quantity: 1 }]);
    }
  }, [isOpen, allLines]);

  const sourceLineOptions = useMemo(() => {
    return allLines.filter(l => l.id !== 'buffer');
  }, [allLines]);

  const handleAddTransfer = () => {
    setTransfers(prev => [...prev, { id: crypto.randomUUID(), sourceLineId: '', machineType: '', quantity: 1 }]);
  };

  const handleRemoveTransfer = (id: string) => {
    setTransfers(prev => prev.filter(t => t.id !== id));
  };

  const handleTransferChange = (id: string, field: keyof Transfer, value: string | number) => {
    setTransfers(prev => prev.map(t => {
      if (t.id === id) {
        const updatedTransfer = { ...t, [field]: value };
        if (field === 'sourceLineId') {
            updatedTransfer.machineType = '';
            updatedTransfer.quantity = 1;
        }
        return updatedTransfer;
      }
      return t;
    }));
  };

  const availableMachinesForTransfer = (transfer: Transfer) => {
    const sourceLine = allLines.find(l => l.id === transfer.sourceLineId);
    if (!sourceLine) return [];
    
    // Calculate machines already earmarked for transfer from this source line
    const earmarkedCounts = transfers.reduce((acc, currentTransfer) => {
      if (currentTransfer.sourceLineId === transfer.sourceLineId && currentTransfer.id !== transfer.id) {
        if (currentTransfer.machineType) {
          acc[currentTransfer.machineType] = (acc[currentTransfer.machineType] || 0) + currentTransfer.quantity;
        }
      }
      return acc;
    }, {} as Partial<Record<SewingMachineType, number>>);

    return (Object.keys(sourceLine.machineCounts) as SewingMachineType[]).map(type => {
      const total = sourceLine.machineCounts[type] || 0;
      const earmarked = earmarkedCounts[type] || 0;
      return { type, available: total - earmarked };
    }).filter(m => m.available > 0);
  };
  
  const handleSave = () => {
      const validTransfers = transfers
        .filter(t => t.sourceLineId && t.machineType && t.quantity > 0)
        .map(({ sourceLineId, machineType, quantity }) => ({
            sourceLineId,
            machineType: machineType as SewingMachineType,
            quantity,
        }));
      onSave(lineName, validTransfers);
  }

  const isSaveDisabled = !lineName.trim() || transfers.every(t => !t.sourceLineId || !t.machineType || t.quantity <= 0);

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Create New Sewing Line</DialogTitle>
          <DialogDescription>
            Combine machines from existing lines to form a new, dedicated sewing line.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4 space-y-6">
            <div className="space-y-2">
                <Label htmlFor="line-name">New Line Name</Label>
                <div 
                    id="line-name" 
                    className="flex items-center h-10 w-full rounded-md border border-input bg-muted px-3 py-2 text-sm text-muted-foreground"
                >
                    {lineName}
                </div>
            </div>

            <div>
                <h4 className="text-sm font-medium mb-2">Machine Transfers</h4>
                <ScrollArea className="max-h-[40vh] pr-4">
                    <div className="space-y-4">
                        {transfers.map((transfer) => {
                            const availableMachines = availableMachinesForTransfer(transfer);
                            const selectedMachineInfo = availableMachines.find(m => m.type === transfer.machineType);
                            const maxQuantity = selectedMachineInfo?.available || 0;
                           
                            return (
                                <div key={transfer.id} className="grid grid-cols-[1fr_1fr_120px_auto] gap-x-2 items-end p-3 border rounded-md">
                                    <div className="space-y-1">
                                        <Label className="text-xs">Source Line</Label>
                                        <Select value={transfer.sourceLineId} onValueChange={val => handleTransferChange(transfer.id, 'sourceLineId', val)}>
                                            <SelectTrigger><SelectValue placeholder="Select Source"/></SelectTrigger>
                                            <SelectContent>
                                                {sourceLineOptions.map(l => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                     <div className="space-y-1">
                                        <Label className="text-xs">Machine Type</Label>
                                        <Select value={transfer.machineType} onValueChange={val => handleTransferChange(transfer.id, 'machineType', val)} disabled={!transfer.sourceLineId}>
                                            <SelectTrigger><SelectValue placeholder="Select Type"/></SelectTrigger>
                                            <SelectContent>
                                                {availableMachines.map(m => <SelectItem key={m.type} value={m.type}>{m.type} (Av: {m.available})</SelectItem>)}
                                            </SelectContent>
                                        </Select>
                                     </div>
                                      <div className="space-y-1">
                                        <Label className="text-xs">Quantity</Label>
                                        <Input
                                            type="number"
                                            min="1"
                                            max={maxQuantity}
                                            value={transfer.quantity}
                                            onChange={e => handleTransferChange(transfer.id, 'quantity', Math.min(maxQuantity, parseInt(e.target.value, 10) || 1))}
                                            disabled={!transfer.machineType}
                                        />
                                      </div>
                                    <Button variant="ghost" size="icon" onClick={() => handleRemoveTransfer(transfer.id)} className="text-destructive">
                                        <X className="h-4 w-4" />
                                    </Button>
                                </div>
                            );
                        })}
                    </div>
                </ScrollArea>
                <Button variant="link" size="sm" onClick={handleAddTransfer} className="mt-2 p-0 h-auto">
                    <PlusCircle className="mr-2 h-4 w-4" /> Add Source
                </Button>
            </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={isSaveDisabled}>Create Line</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
