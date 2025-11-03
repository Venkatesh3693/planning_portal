
"use client";

import { Factory, PanelLeftOpen, PanelRightOpen, Settings, ChevronDown, LayoutDashboard, ShoppingCart, Box, FactoryIcon, LineChart, Scissors, ClipboardList, GanttChartSquare } from 'lucide-react';
import Link from 'next/link';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSub, DropdownMenuSubTrigger, DropdownMenuSubContent, DropdownMenuPortal, DropdownMenuSeparator, DropdownMenuRadioGroup, DropdownMenuRadioItem } from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useSchedule } from '@/context/schedule-provider';


const NavLink = ({ href, children }: { href: string, children: React.ReactNode }) => {
    const pathname = usePathname();
    const isActive = pathname === href;
    return (
        <Link href={href} passHref>
            <Button variant="ghost" size="sm" className={cn("text-sm font-normal", isActive && "font-semibold bg-accent text-accent-foreground")}>
                {children}
            </Button>
        </Link>
    );
};

const NavDropdown = ({ title, children }: { title: string, children: React.ReactNode }) => {
    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="text-sm font-normal">
                    {title}
                    <ChevronDown className="ml-2 h-4 w-4" />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
                {children}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}

export function Header() {
  const pathname = usePathname();
  const { appMode, setAppMode } = useSchedule();

  return (
    <header className="border-b bg-card shadow-sm sticky top-0 z-50">
      <div className="container mx-auto max-w-full px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-3">
              <Factory className="h-8 w-8 text-primary" />
              <h1 className="hidden sm:block text-2xl font-bold tracking-tight text-foreground">
                Planning DB
              </h1>
            </Link>
          </div>
          
          <nav className="hidden md:flex items-center gap-1">
            <NavLink href="/">
                <LayoutDashboard className="mr-2 h-4 w-4" />
                Dashboard
            </NavLink>
            <NavLink href="/orders">
                <ShoppingCart className="mr-2 h-4 w-4" />
                Orders
            </NavLink>
            {appMode === 'gup' ? (
                <NavLink href="/capacity">
                    <FactoryIcon className="mr-2 h-4 w-4" />
                    Capacity
                </NavLink>
            ) : (
                <>
                    <NavDropdown title="Demand">
                        <Link href="/demand-analysis" passHref><DropdownMenuItem>Demand Trend Analysis</DropdownMenuItem></Link>
                        <Link href="/size-wise-demand" passHref><DropdownMenuItem>Size-wise Demand</DropdownMenuItem></Link>
                    </NavDropdown>
                    <NavDropdown title="Material Planning">
                        <Link href="/projection-planning" passHref><DropdownMenuItem>Projection Planning</DropdownMenuItem></Link>
                        <Link href="/frc-planning" passHref><DropdownMenuItem>FRC Planning</DropdownMenuItem></Link>
                    </NavDropdown>
                     <NavDropdown title="Production Planning">
                        <Link href="/cc-plan" passHref><DropdownMenuItem>CC Plan</DropdownMenuItem></Link>
                        <Link href="/capacity-allocation" passHref><DropdownMenuItem>Capacity Allocation</DropdownMenuItem></Link>
                        <Link href="/cut-order-issue" passHref><DropdownMenuItem>Cut Order Details</DropdownMenuItem></Link>
                        <Link href="/line-plan" passHref><DropdownMenuItem>Line Plan</DropdownMenuItem></Link>
                    </NavDropdown>
                </>
            )}
          </nav>

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
                <Button variant="ghost" size="icon" className="ring-offset-background focus-visible:ring-0 focus-visible:ring-offset-0 md:hidden">
                  <Settings className="h-5 w-5" />
                  <span className="sr-only">Settings</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <Link href="/" passHref><DropdownMenuItem>Dashboard</DropdownMenuItem></Link>
                <Link href="/orders" passHref><DropdownMenuItem>Orders</DropdownMenuItem></Link>
                {appMode === 'gup' && <Link href="/capacity" passHref><DropdownMenuItem>Capacity</DropdownMenuItem></Link>}
                
                {appMode === 'gut' && (
                  <>
                    <DropdownMenuSeparator/>
                    <DropdownMenuSub>
                      <DropdownMenuSubTrigger>Demand</DropdownMenuSubTrigger>
                      <DropdownMenuPortal>
                        <DropdownMenuSubContent>
                           <Link href="/demand-analysis" passHref><DropdownMenuItem>Demand Trend Analysis</DropdownMenuItem></Link>
                           <Link href="/size-wise-demand" passHref><DropdownMenuItem>Size-wise Demand</DropdownMenuItem></Link>
                        </DropdownMenuSubContent>
                      </DropdownMenuPortal>
                    </DropdownMenuSub>
                     <DropdownMenuSub>
                      <DropdownMenuSubTrigger>Material Planning</DropdownMenuSubTrigger>
                      <DropdownMenuPortal>
                        <DropdownMenuSubContent>
                           <Link href="/projection-planning" passHref><DropdownMenuItem>Projection Planning</DropdownMenuItem></Link>
                           <Link href="/frc-planning" passHref><DropdownMenuItem>FRC Planning</DropdownMenuItem></Link>
                        </DropdownMenuSubContent>
                      </DropdownMenuPortal>
                    </DropdownMenuSub>
                     <DropdownMenuSub>
                      <DropdownMenuSubTrigger>Production Planning</DropdownMenuSubTrigger>
                      <DropdownMenuPortal>
                        <DropdownMenuSubContent>
                            <Link href="/cc-plan" passHref><DropdownMenuItem>CC Plan</DropdownMenuItem></Link>
                            <Link href="/capacity-allocation" passHref><DropdownMenuItem>Capacity Allocation</DropdownMenuItem></Link>
                            <Link href="/cut-order-issue" passHref><DropdownMenuItem>Cut Order Details</DropdownMenuItem></Link>
                            <Link href="/line-plan" passHref><DropdownMenuItem>Line Plan</DropdownMenuItem></Link>
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
