
"use client";

import { Factory, Settings } from 'lucide-react';
import Link from 'next/link';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { Process } from '@/lib/types';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { usePathname } from 'next/navigation';

type HeaderProps = {
  processes?: Process[];
  selectedProcessId?: string;
  onProcessChange?: (processId: string) => void;
};

export function Header({ processes, selectedProcessId, onProcessChange }: HeaderProps) {
  const pathname = usePathname();
  const isHomePage = pathname === '/';

  return (
    <header className="border-b bg-card shadow-sm">
      <div className="container mx-auto max-w-full px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-3">
              <Factory className="h-8 w-8 text-primary" />
              <h1 className="text-2xl font-bold tracking-tight text-foreground">
                StitchPlan
              </h1>
            </Link>
          </div>
          <div className="flex items-center gap-4">
            {isHomePage && processes && selectedProcessId && onProcessChange && (
              <>
                <label htmlFor="process-selector" className="text-sm font-medium text-muted-foreground">
                  Process
                </label>
                <Select value={selectedProcessId} onValueChange={onProcessChange}>
                  <SelectTrigger id="process-selector" className="w-[180px] ring-offset-background focus:ring-0 focus:ring-offset-0">
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
              </>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="ring-offset-background focus-visible:ring-0 focus-visible:ring-offset-0">
                  <Settings className="h-5 w-5" />
                  <span className="sr-only">Settings</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <Link href="/capacity">
                  <DropdownMenuItem>Capacity management</DropdownMenuItem>
                </Link>
                <DropdownMenuItem>Order management</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
    </header>
  );
}
