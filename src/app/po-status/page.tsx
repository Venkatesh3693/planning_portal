
'use client';

import { Suspense, useMemo, useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { useSchedule } from '@/context/schedule-provider';
import { Header } from '@/components/layout/header';
import Link from 'next/link';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { Button } from '@/components/ui/button';
import { ArrowLeft, ChevronsRight, ChevronDown } from 'lucide-react';
import type { SyntheticPoRecord, Size, SizeBreakdown, Order, CutOrderRecord } from '@/lib/types';
import { SIZES } from '@/lib/data';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';


const PoDetailsTable = ({ records, orders, cutOrderRecords }: { records: SyntheticPoRecord[], orders: Order[], cutOrderRecords: CutOrderRecord[] }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const [isDfqcExpanded, setIsDfqcExpanded] = useState(false);

    const productionStatuses = useMemo(() => {
        const statuses: Record<string, { status: string, coNumber: string | null }> = {};
        const cutOrderProgress = new Map<string, number>();

        cutOrderRecords.forEach(co => {
            if (co.status === 'In Progress' && co.producedQuantities) {
                cutOrderProgress.set(co.coNumber, co.producedQuantities.total);
            }
        });

        for (const co of cutOrderRecords) {
            const posInCo = records
                .filter(rec => co.poNumbers.includes(rec.poNumber))
                .sort((a, b) => parseInt(a.originalEhdWeek.slice(1)) - parseInt(b.originalEhdWeek.slice(1)));

            if (co.status === 'Produced') {
                posInCo.forEach(po => {
                    statuses[`${po.poNumber}-${po.destination}`] = { status: 'Produced', coNumber: co.coNumber };
                });
            } else if (co.status === 'In Progress') {
                let producedSoFar = cutOrderProgress.get(co.coNumber) || 0;
                for (const po of posInCo) {
                    if (producedSoFar >= po.quantities.total) {
                        statuses[`${po.poNumber}-${po.destination}`] = { status: 'Produced', coNumber: co.coNumber };
                        producedSoFar -= po.quantities.total;
                    } else {
                        statuses[`${po.poNumber}-${po.destination}`] = { status: 'CO Issued', coNumber: co.coNumber };
                    }
                }
            }
        }
        
        records.forEach(record => {
            const key = `${record.poNumber}-${record.destination}`;
            if (!statuses[key]) {
                statuses[key] = { status: 'Not Planned', coNumber: null };
            }
        });
        
        return statuses;
    }, [records, cutOrderRecords]);


    const poInspectionStatuses = useMemo(() => {
        const statuses = ["TBD", "Under Inspection", "Passed", "Failed"];
        const statusMap = new Map<string, string>();
        records.forEach(record => {
            const key = `${record.poNumber}-${record.destination}`;
            // Simple hash to get a pseudo-random status
            const hash = key.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
            statusMap.set(key, statuses[hash % statuses.length]);
        });
        return statusMap;
    }, [records]);

    const getStatusVariant = (status: string): { variant: "default" | "secondary" | "destructive" | "outline", className?: string } => {
        switch (status) {
            case "Passed":
                return { variant: "default", className: "bg-green-600 hover:bg-green-700" };
            case "Failed":
                return { variant: "destructive" };
            case "Under Inspection":
                return { variant: "default", className: "bg-yellow-500 hover:bg-yellow-600" };
            default: // TBD
                return { variant: "outline" };
        }
    };
    
    const shipStatuses = useMemo(() => {
        const statuses = ["On-time", "Delay", "Not Shipped"];
        const statusMap = new Map<string, string>();
        records.forEach(record => {
            const key = `${record.poNumber}-${record.destination}`;
            const hash = key.split('').reduce((acc, char) => acc + char.charCodeAt(0) + 1, 0); // Offset hash
            statusMap.set(key, statuses[hash % statuses.length]);
        });
        return statusMap;
    }, [records]);

    const getShipStatusVariant = (status: string) => {
        switch (status) {
            case "On-time":
                return { variant: "default", className: "bg-green-600 hover:bg-green-700" };
            case "Delay":
                return { variant: "destructive" };
            default: // Not Shipped
                return { variant: "outline" };
        }
    };

    const getProductionStatusVariant = (status: string): { variant: "default" | "secondary" | "destructive" | "outline", className?: string } => {
        switch (status) {
            case "Produced":
                return { variant: "default", className: "bg-green-600 hover:bg-green-700" };
            case "CO Issued":
                return { variant: "default", className: "bg-yellow-500 hover:bg-yellow-600" };
            default: // Not Planned
                return { variant: "outline" };
        }
    };


    const totals = useMemo(() => {
        const sizeTotals = SIZES.reduce((acc, size) => {
            acc[size] = 0;
            return acc;
        }, {} as Record<Size, number>);

        let grandTotal = 0;

        records.forEach(record => {
            grandTotal += record.quantities.total || 0;
            SIZES.forEach(size => {
                sizeTotals[size] += record.quantities[size] || 0;
            });
        });

        return { sizeTotals, grandTotal };
    }, [records]);


    if (records.length === 0) {
        return (
            <div className="flex items-center justify-center h-48 text-muted-foreground border rounded-lg">
                No released POs found for the selected criteria.
            </div>
        );
    }

    const getOrderInfo = (orderId: string) => {
        return orders.find(o => o.id === orderId);
    };
    
    return (
        <Table>
            <TableHeader>
                <TableRow>
                    <TableHead>CC</TableHead>
                    <TableHead>Color</TableHead>
                    <TableHead>PO #</TableHead>
                    <TableHead>Destination</TableHead>
                    <TableHead>Snapshot Week</TableHead>
                    <TableHead>EHD Week</TableHead>
                    <TableHead>CHD Week</TableHead>
                    {isExpanded && SIZES.map(size => (
                        <TableHead key={size} className="text-right">{size}</TableHead>
                    ))}
                    <TableHead 
                        className="text-right font-bold cursor-pointer"
                        onClick={() => setIsExpanded(!isExpanded)}
                    >
                        <div className="flex items-center justify-end gap-2">
                           {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronsRight className="h-4 w-4" />}
                           PO Qty
                        </div>
                    </TableHead>
                    <TableHead>Production</TableHead>
                    <TableHead
                        className="cursor-pointer"
                        onClick={() => setIsDfqcExpanded(!isDfqcExpanded)}
                    >
                         <div className="flex items-center gap-2">
                           {isDfqcExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronsRight className="h-4 w-4" />}
                           DFQC Inspection
                        </div>
                    </TableHead>
                    {isDfqcExpanded && (
                        <>
                            <TableHead>DFQC Name</TableHead>
                            <TableHead>DFQC receive Date time</TableHead>
                            <TableHead>DFQC inspection duration</TableHead>
                        </>
                    )}
                    <TableHead>Ship Status</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {records.map(record => {
                    const orderInfo = getOrderInfo(record.orderId);
                    const key = `${record.poNumber}-${record.destination}`;
                    const inspectionStatus = poInspectionStatuses.get(key) || "TBD";
                    const { variant, className } = getStatusVariant(inspectionStatus);
                    const shippingStatus = shipStatuses.get(key) || "Not Shipped";
                    const shipStatusStyle = getShipStatusVariant(shippingStatus);
                    
                    const prodInfo = productionStatuses[key] || { status: 'Not Planned', coNumber: null };
                    const prodStatusStyle = getProductionStatusVariant(prodInfo.status);
                    
                    let productionContent: React.ReactNode = prodInfo.coNumber || prodInfo.status;
                    if (prodInfo.status === 'Not Planned') {
                        productionContent = 'Not Planned';
                    }

                    return (
                        <TableRow key={key}>
                            <TableCell>{orderInfo?.ocn || 'N/A'}</TableCell>
                            <TableCell>{orderInfo?.color || 'N/A'}</TableCell>
                            <TableCell className="font-medium whitespace-nowrap">{record.poNumber}</TableCell>
                            <TableCell>{record.destination}</TableCell>
                            <TableCell>{record.issueWeek}</TableCell>
                            <TableCell>{record.originalEhdWeek}</TableCell>
                            <TableCell>{record.originalEhdWeek}</TableCell>
                            {isExpanded && SIZES.map(size => (
                                 <TableCell key={size} className="text-right">
                                    {(record.quantities[size] || 0) > 0 ? (record.quantities[size] || 0).toLocaleString() : '-'}
                                </TableCell>
                            ))}
                            <TableCell className="text-right font-bold">
                                {(record.quantities.total || 0).toLocaleString()}
                            </TableCell>
                            <TableCell>
                                <Badge variant={prodStatusStyle.variant} className={prodStatusStyle.className}>
                                    {productionContent}
                                </Badge>
                            </TableCell>
                            <TableCell>
                                <Badge variant={variant} className={className}>{inspectionStatus}</Badge>
                            </TableCell>
                             {isDfqcExpanded && (
                                <>
                                    <TableCell>John Doe</TableCell>
                                    <TableCell>2024-07-29 10:00</TableCell>
                                    <TableCell>45 mins</TableCell>
                                </>
                            )}
                            <TableCell>
                                <Badge variant={shipStatusStyle.variant} className={shipStatusStyle.className}>{shippingStatus}</Badge>
                            </TableCell>
                        </TableRow>
                    );
                })}
            </TableBody>
            <TableFooter>
                <TableRow>
                    <TableCell colSpan={7} className="font-bold text-right">Total</TableCell>
                    {isExpanded && SIZES.map(size => (
                        <TableCell key={`total-${size}`} className="text-right font-bold">
                            {(totals.sizeTotals[size] || 0).toLocaleString()}
                        </TableCell>
                    ))}
                    <TableCell className="text-right font-bold">
                        <div className="flex items-center justify-end">
                            {totals.grandTotal.toLocaleString()}
                        </div>
                    </TableCell>
                    <TableCell colSpan={isDfqcExpanded ? 6 : 3}></TableCell>
                </TableRow>
            </TableFooter>
        </Table>
    )
}


function PoStatusPageContent() {
    const searchParams = useSearchParams();
    const orderIdFromUrl = searchParams.get('orderId');
    
    const { orders, isScheduleLoaded, syntheticPoRecords, cutOrderRecords } = useSchedule();
    
    const [selectedCc, setSelectedCc] = useState('');
    const [selectedColor, setSelectedColor] = useState('');

    const ccOptions = useMemo(() => {
        const ccSet = new Set<string>();
        orders.forEach(o => {
            if (o.orderType === 'Forecasted' && o.ocn) {
                ccSet.add(o.ocn);
            }
        });
        return Array.from(ccSet).sort();
    }, [orders]);

    const colorOptions = useMemo(() => {
        if (!selectedCc) return [];
        const colorSet = new Set<string>();
        orders.forEach(o => {
            if (o.ocn === selectedCc) {
                colorSet.add(o.color);
            }
        });
        return Array.from(colorSet).sort();
    }, [selectedCc, orders]);

    useEffect(() => {
        if (orderIdFromUrl) {
            const initialOrder = orders.find(o => o.id === orderIdFromUrl);
            if (initialOrder) {
                setSelectedCc(initialOrder.ocn);
                setSelectedColor(initialOrder.color);
            }
        }
    }, [orderIdFromUrl, orders]);

    useEffect(() => {
        // Reset color if CC changes and the selected color is no longer valid
        if (selectedCc && !colorOptions.includes(selectedColor)) {
            setSelectedColor('');
        }
    }, [selectedCc, colorOptions, selectedColor]);

    const filteredRecords = useMemo(() => {
        if (!selectedCc) return syntheticPoRecords;

        const filteredOrderIds = new Set(
            orders
                .filter(o => o.ocn === selectedCc && (!selectedColor || o.color === selectedColor))
                .map(o => o.id)
        );

        return syntheticPoRecords.filter(r => filteredOrderIds.has(r.orderId));
    }, [selectedCc, selectedColor, syntheticPoRecords, orders]);


    if (!isScheduleLoaded) {
        return <div className="flex items-center justify-center h-full">Loading data...</div>;
    }

    return (
        <div className="flex h-screen flex-col">
            <Header />
            <main className="flex-1 p-4 sm:p-6 lg:p-8 flex flex-col">
                <Breadcrumb className="mb-4 flex-shrink-0">
                    <BreadcrumbList>
                        <BreadcrumbItem>
                            <BreadcrumbLink asChild>
                                <Link href="/orders">Order Management</Link>
                            </BreadcrumbLink>
                        </BreadcrumbItem>
                        <BreadcrumbSeparator />
                        <BreadcrumbItem>
                            <BreadcrumbPage>PO Status</BreadcrumbPage>
                        </BreadcrumbItem>
                    </BreadcrumbList>
                </Breadcrumb>

                 <div className="flex justify-between items-center mb-4 flex-shrink-0">
                    <div>
                        <h1 className="text-2xl font-bold">PO Status</h1>
                        <p className="text-muted-foreground">
                            View released purchase orders for forecasted styles.
                        </p>
                    </div>
                     <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                           <Label htmlFor="cc-select">CC No.</Label>
                           <Select value={selectedCc} onValueChange={(value) => setSelectedCc(value === 'all' ? '' : value)}>
                             <SelectTrigger id="cc-select" className="w-[180px]">
                               <SelectValue placeholder="All CCs" />
                             </SelectTrigger>
                             <SelectContent>
                               <SelectItem value="all">All CCs</SelectItem>
                               {ccOptions.map(cc => <SelectItem key={cc} value={cc}>{cc}</SelectItem>)}
                             </SelectContent>
                           </Select>
                        </div>
                         <div className="flex items-center gap-2">
                           <Label htmlFor="color-select">Color</Label>
                           <Select value={selectedColor} onValueChange={(value) => setSelectedColor(value === 'all' ? '' : value)} disabled={!selectedCc}>
                             <SelectTrigger id="color-select" className="w-[180px]">
                               <SelectValue placeholder="All Colors" />
                             </SelectTrigger>
                             <SelectContent>
                               <SelectItem value="all">All Colors</SelectItem>
                               {colorOptions.map(color => <SelectItem key={color} value={color}>{color}</SelectItem>)}
                             </SelectContent>
                           </Select>
                        </div>
                    </div>
                </div>
                
                <div className="border rounded-lg overflow-auto flex-1">
                   <PoDetailsTable records={filteredRecords} orders={orders} cutOrderRecords={cutOrderRecords} />
                </div>
            </main>
        </div>
    );
}

export default function PoStatusPage() {
    return (
        <Suspense fallback={<div>Loading...</div>}>
            <PoStatusPageContent />
        </Suspense>
    );
}
