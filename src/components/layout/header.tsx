
"use client";

import { Factory, PanelLeftOpen, PanelRightOpen, Settings } from 'lucide-react';
import Link from 'next/link';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

type HeaderProps = {
  isOrdersPanelVisible?: boolean;
  setIsOrdersPanelVisible?: (visible: boolean | ((prevState: boolean) => boolean)) => void;
};

export function Header({ 
  isOrdersPanelVisible,
  setIsOrdersPanelVisible,
}: HeaderProps) {
  const pathname = usePathname();
  const isHomePage = pathname === '/';

  const handleToggle = () => {
    if (setIsOrdersPanelVisible) {
      setIsOrdersPanelVisible(prev => !prev);
    }
  };

  return (
    <header className="border-b bg-card shadow-sm">
      <div className="container mx-auto max-w-full px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          <div className="flex items-center gap-3">
            {isHomePage && setIsOrdersPanelVisible && (
              <Button variant="ghost" size="icon" onClick={handleToggle}>
                {isOrdersPanelVisible ? <PanelLeftOpen className="h-5 w-5" /> : <PanelRightOpen className="h-5 w-5" />}
                 <span className="sr-only">Toggle Orders Panel</span>
              </Button>
            )}
            <Link href="/" className={cn("flex items-center gap-3", isHomePage && "hidden sm:flex")}>
              <Factory className="h-8 w-8 text-primary" />
              <h1 className="text-2xl font-bold tracking-tight text-foreground">
                StitchPlan
              </h1>
            </Link>
          </div>
          <div className="flex items-center gap-4">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="ring-offset-background focus-visible:ring-0 focus-visible:ring-offset-0">
                  <Settings className="h-5 w-5" />
                  <span className="sr-only">Settings</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <Link href="/pab">
                  <DropdownMenuItem>PAB Mode</DropdownMenuItem>
                </Link>
                <Link href="/capacity">
                  <DropdownMenuItem>Capacity management</DropdownMenuItem>
                </Link>
                <Link href="/orders">
                  <DropdownMenuItem>Order management</DropdownMenuItem>
                </Link>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
    </header>
  );
}
