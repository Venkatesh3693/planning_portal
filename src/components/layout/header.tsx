
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
            <Button variant="ghost" size="sm" className={cn("text-sm font-normal text-white/80 hover:bg-white/10 hover:text-white", isActive && "font-semibold bg-white/20 text-white")}>
                {children}
            </Button>
        </Link>
    );
};

const NavDropdown = ({ title, children }: { title: string, children: React.ReactNode }) => {
    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="text-sm font-normal text-white/80 hover:bg-white/10 hover:text-white">
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
  
  const homeHref = appMode === 'gup' ? '/' : appMode === 'gut' ? '/orders' : '/gut-new';

  return (
    <header className="bg-blue-800 dark:bg-blue-900 shadow-sm sticky top-0 z-50">
      <div className="container mx-auto max-w-full px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href={homeHref} className="flex items-center gap-3">
              <Factory className="h-8 w-8 text-white" />
              <h1 className="hidden sm:block text-2xl font-bold tracking-tight text-white">
                Planning DB
              </h1>
            </Link>
          </div>
          
          <nav className="hidden md:flex items-center gap-1">
             {appMode === 'gup' ? (
                <>
                    <NavLink href="/">
                        <LayoutDashboard className="mr-2 h-4 w-4" />
                        Dashboard
                    </NavLink>
                    <NavLink href="/orders">
                        <ShoppingCart className="mr-2 h-4 w-4" />
                        Orders
                    </NavLink>
                    <NavLink href="/capacity">
                        <FactoryIcon className="mr-2 h-4 w-4" />
                        Capacity
                    </NavLink>
                </>
            ) : appMode === 'gut' ? (
                <>
                    <NavLink href="/orders">
                        <ShoppingCart className="mr-2 h-4 w-4" />
                        Order Management
                    </NavLink>
                    <NavDropdown title="Demand">
                        <Link href="/demand-analysis" passHref><DropdownMenuItem>Demand Trend Analysis</DropdownMenuItem></Link>
                        <Link href="/size-wise-demand" passHref><DropdownMenuItem>Size-wise Demand</DropdownMenuItem></Link>
                        <Link href="/po-status" passHref><DropdownMenuItem>PO Status</DropdownMenuItem></Link>
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
            ) : (
                <>
                 <NavLink href="/gut-new">
                    <GanttChartSquare className="mr-2 h-4 w-4" />
                    Gantt Chart
                </NavLink>
                <NavLink href="/orders-new">
                    <ShoppingCart className="mr-2 h-4 w-4" />
                    Orders
                </NavLink>
                 <NavLink href="/capacity-allocation-new">
                    <FactoryIcon className="mr-2 h-4 w-4" />
                    Capacity
                </NavLink>
                </>
            )}
          </nav>

          <div className="flex items-center gap-4">
             <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="w-[120px] justify-between">
                  <span>
                    {appMode === 'gup' ? 'GUP' : appMode === 'gut' ? 'GUT' : 'GUT (New)'}
                    </span>
                  <ChevronDown/>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuRadioGroup value={appMode} onValueChange={(value) => setAppMode(value as 'gup' | 'gut' | 'gut-new')}>
                  <DropdownMenuRadioItem value="gup">GUP</DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="gut">GUT</DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="gut-new">GUT (New)</DropdownMenuRadioItem>
                </DropdownMenuRadioGroup>
              </DropdownMenuContent>
            </DropdownMenu>
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="ring-offset-background focus-visible:ring-0 focus-visible:ring-offset-0 md:hidden text-white hover:bg-white/10 hover:text-white">
                  <Settings className="h-5 w-5" />
                  <span className="sr-only">Settings</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {appMode === 'gup' ? (
                  <>
                    <Link href="/" passHref><DropdownMenuItem>Dashboard</DropdownMenuItem></Link>
                    <Link href="/orders" passHref><DropdownMenuItem>Orders</DropdownMenuItem></Link>
                    <Link href="/capacity" passHref><DropdownMenuItem>Capacity</DropdownMenuItem></Link>
                  </>
                ) : appMode === 'gut' ? (
                  <>
                    <Link href="/orders" passHref><DropdownMenuItem>Order Management</DropdownMenuItem></Link>
                    <DropdownMenuSeparator/>
                    <DropdownMenuSub>
                      <DropdownMenuSubTrigger>Demand</DropdownMenuSubTrigger>
                      <DropdownMenuPortal>
                        <DropdownMenuSubContent>
                           <Link href="/demand-analysis" passHref><DropdownMenuItem>Demand Trend Analysis</DropdownMenuItem></Link>
                           <Link href="/size-wise-demand" passHref><DropdownMenuItem>Size-wise Demand</DropdownMenuItem></Link>
                           <Link href="/po-status" passHref><DropdownMenuItem>PO Status</DropdownMenuItem></Link>
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
                ) : (
                  <>
                    <Link href="/gut-new" passHref><DropdownMenuItem>Gantt Chart</DropdownMenuItem></Link>
                    <Link href="/orders-new" passHref><DropdownMenuItem>Orders</DropdownMenuItem></Link>
                    <Link href="/capacity-allocation-new" passHref><DropdownMenuItem>Capacity</DropdownMenuItem></Link>
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
