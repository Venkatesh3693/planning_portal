import { Factory } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { Process } from '@/lib/types';

type HeaderProps = {
  processes: Process[];
  selectedProcessId: string;
  onProcessChange: (processId: string) => void;
};

export function Header({ processes, selectedProcessId, onProcessChange }: HeaderProps) {
  return (
    <header className="border-b bg-card shadow-sm">
      <div className="container mx-auto max-w-full px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          <div className="flex items-center gap-3">
            <Factory className="h-8 w-8 text-primary" />
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              StitchPlan
            </h1>
          </div>
          <div className="flex items-center gap-4">
            <label htmlFor="process-selector" className="text-sm font-medium text-muted-foreground">
              Process
            </label>
            <Select value={selectedProcessId} onValueChange={onProcessChange}>
              <SelectTrigger id="process-selector" className="w-[180px]">
                <SelectValue placeholder="Select a process" />
              </SelectTrigger>
              <SelectContent>
                {processes.map((process) => (
                  <SelectItem key={process.id} value={process.id}>
                    {process.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>
    </header>
  );
}
