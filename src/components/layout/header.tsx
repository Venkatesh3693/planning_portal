
"use client";

import { Factory, PanelLeftOpen, PanelRightOpen, Settings, ChevronDown } from 'lucide-react';
import Link from 'next/link';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSub, DropdownMenuSubTrigger, DropdownMenuSubContent, DropdownMenuPortal, DropdownMenuSeparator, DropdownMenuRadioGroup, DropdownMenuRadioItem } from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useSchedule } from '@/context/schedule-provider';

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
  const { appMode, setAppMode } = useSchedule();

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
            {isHomePage && appMode === 'gup' && setIsOrdersPanelVisible && (
              <Button variant="ghost" size="icon" onClick={handleToggle}>
                {isOrdersPanelVisible ? <PanelLeftOpen className="h-5 w-5" /> : <PanelRightOpen className="h-5 w-5" />}
                 <span className="sr-only">Toggle Orders Panel</span>
              </Button>
            )}
            <Link href="/" className={cn("flex items-center gap-3", isHomePage && "hidden sm:flex")}>
              <Factory className="h-8 w-8 text-primary" />
              <h1 className="text-2xl font-bold tracking-tight text-foreground">
                Planning DB
              </h1>
            </Link>
          </div>
          <div className="flex items-center gap-4">
             <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="w-[100px] justify-between">
                  <span>{appMode.toUpperCase()}</span>
                  <ChevronDown/>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuRadioGroup value={appMode} onValueChange={(value) => setAppMode(value as 'gup' | 'gut')}>
                  <DropdownMenuRadioItem value="gup">GUP</DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="gut">GUT</DropdownMenuRadioItem>
                </DropdownMenuRadioGroup>
              </DropdownMenuContent>
            </DropdownMenu>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="ring-offset-background focus-visible:ring-0 focus-visible:ring-offset-0">
                  <Settings className="h-5 w-5" />
                  <span className="sr-only">Settings</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {appMode === 'gup' && (
                  <Link href="/capacity">
                    <DropdownMenuItem>Capacity management</DropdownMenuItem>
                  </Link>
                )}
                <Link href="/orders">
                  <DropdownMenuItem>Order management</DropdownMenuItem>
                </Link>

                {appMode === 'gut' && (
                  <>
                    <DropdownMenuSub>
                      <DropdownMenuSubTrigger>
                        <span>Demand</span>
                      </DropdownMenuSubTrigger>
                      <DropdownMenuPortal>
                        <DropdownMenuSubContent>
                          <Link href="/demand-analysis">
                            <DropdownMenuItem>Demand Analysis</DropdownMenuItem>
                          </Link>
                          <Link href="/size-wise-demand">
                            <DropdownMenuItem>Size-wise Demand</DropdownMenuItem>
                          </Link>
                        </DropdownMenuSubContent>
                      </DropdownMenuPortal>
                    </DropdownMenuSub>
                    
                    <DropdownMenuSeparator />
                     <DropdownMenuSub>
                      <DropdownMenuSubTrigger>
                        <span>Material Planning</span>
                      </DropdownMenuSubTrigger>
                      <DropdownMenuPortal>
                        <DropdownMenuSubContent>
                          <Link href="/projection-planning">
                            <DropdownMenuItem>Projection Planning</DropdownMenuItem>
                          </Link>
                          <Link href="/frc-planning">
                            <DropdownMenuItem>FRC Planning</DropdownMenuItem>
                          </Link>
                        </DropdownMenuSubContent>
                      </DropdownMenuPortal>
                    </DropdownMenuSub>
                    <DropdownMenuSeparator />
                    <DropdownMenuSub>
                      <DropdownMenuSubTrigger>
                        <span>Production Planning</span>
                      </DropdownMenuSubTrigger>
                      <DropdownMenuPortal>
                        <DropdownMenuSubContent>
                          <Link href="/cc-plan">
                            <DropdownMenuItem>CC Plan</DropdownMenuItem>
                          </Link>
                          <Link href="/cut-order-issue">
                            <DropdownMenuItem>Cut Order details</DropdownMenuItem>
                          </Link>
                          <Link href="/capacity-allocation">
                            <DropdownMenuItem>Capacity Allocation</DropdownMenuItem>
                          </Link>
                          <Link href="/line-plan">
                            <DropdownMenuItem>Line plan</DropdownMenuItem>
                          </Link>
                        </DropdownMenuSubContent>
                      </DropdownMenuPortal>
                    </DropdownMenuSub>
                  </>
                )}

              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
    </header>
  );
}
