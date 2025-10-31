
'use client';

import { useState, useMemo, useEffect } from 'react';
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
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ArrowLeft } from 'lucide-react';
import type { Order, SizeBreakdown } from '@/lib/types';
import { SIZES } from '@/lib/data';


const getAvailableStartWeeks = (orders: Order[], selectedCc: string, selectedColor: string, allWeeks: string[]) => {
    if (!selectedCc || !selectedColor) return allWeeks;

    const relevantOrders = orders.filter(o => o.ocn === selectedCc && o.color === selectedColor);
    if (relevantOrders.length === 0) return allWeeks;

    const orderForPlanning = relevantOrders[0];
    const latestSnapshot = orderForPlanning.fcVsFcDetails
        ?.sort((a,b) => b.snapshotWeek - a.snapshotWeek)[0];

    if (!latestSnapshot) return allWeeks;

    const firstDemandWeek = Object.keys(latestSnapshot.forecasts)
        .map(w => parseInt(w.slice(1)))
        .sort((a,b) => a-b)[0];
    
    const productionStartWeek = firstDemandWeek ? firstDemandWeek - 3 : undefined;

    if (!productionStartWeek) return allWeeks;

    return allWeeks.filter(w => parseInt(w.slice(1)) >= productionStartWeek);
};


export default function NewCutOrderPage() {
    const { orders, isScheduleLoaded, frcData } = useSchedule();
    const [selectedCc, setSelectedCc] = useState('');
    const [selectedColor, setSelectedColor] = useState('');
    const [startWeek, setStartWeek] = useState('');
    const [endWeek, setEndWeek] = useState('');
    const [coNumber, setCoNumber] = useState('');

    useEffect(() => {
        // Generate a random CO number on component mount
        const randomNum = Math.floor(100000 + Math.random() * 900000);
        setCoNumber(`CO-${randomNum}`);
    }, []);

    const ccOptions = useMemo(() => {
        if (!isScheduleLoaded) return [];
        const ccSet = new Set<string>();
        orders.forEach(o => {
            if (o.orderType === 'Forecasted' && o.ocn) {
                ccSet.add(o.ocn);
            }
        });
        return Array.from(ccSet).sort();
    }, [orders, isScheduleLoaded]);

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

    const weekOptions = useMemo(() => {
        return Array.from({ length: 52 }, (_, i) => `W${i + 1}`);
    }, []);
    
    useEffect(() => {
        // Reset color if CC changes and the selected color is no longer valid
        if (!colorOptions.includes(selectedColor)) {
            setSelectedColor('');
        }
    }, [selectedCc, colorOptions, selectedColor]);
    
    const availableStartWeeks = getAvailableStartWeeks(orders, selectedCc, selectedColor, weekOptions);

    const frcAvailability = useMemo(() => {
        if (!selectedCc || !selectedColor || !startWeek) return null;

        const order = orders.find(o => o.ocn === selectedCc && o.color === selectedColor);
        if (!order) return null;

        const startWeekNum = parseInt(startWeek.replace('W', ''));
        const modelString = `${order.style} / ${order.color}`;

        const relevantFrcs = frcData.filter(frc => 
            frc.ccNo === selectedCc && 
            frc.model === modelString &&
            parseInt(frc.ckWeek.replace('W', '')) < startWeekNum
        );

        const totalAvailable: SizeBreakdown = SIZES.reduce((acc, size) => ({...acc, [size]: 0}), { total: 0 });

        relevantFrcs.forEach(frc => {
            SIZES.forEach(size => {
                totalAvailable[size] = (totalAvailable[size] || 0) + (frc.sizes?.[size] || 0);
            });
            totalAvailable.total += frc.frcQty || 0;
        });
        
        return totalAvailable;

    }, [selectedCc, selectedColor, startWeek, frcData, orders]);


    return (
        <div className="flex h-screen flex-col">
            <Header />
            <main className="flex-1 p-4 sm:p-6 lg:p-8 flex flex-col space-y-6">
                <Breadcrumb className="flex-shrink-0">
                    <BreadcrumbList>
                        <BreadcrumbItem>
                            <BreadcrumbLink asChild>
                                <Link href="/">Home</Link>
                            </BreadcrumbLink>
                        </BreadcrumbItem>
                        <BreadcrumbSeparator />
                        <BreadcrumbItem>
                             <BreadcrumbLink asChild>
                                <Link href="/cut-order-details">Cut order details</Link>
                            </BreadcrumbLink>
                        </BreadcrumbItem>
                        <BreadcrumbSeparator />
                        <BreadcrumbItem>
                            <BreadcrumbPage>New Cut Order</BreadcrumbPage>
                        </BreadcrumbItem>
                    </BreadcrumbList>
                </Breadcrumb>
                 <div className="flex justify-between items-center flex-shrink-0">
                    <div>
                        <h1 className="text-2xl font-bold">Create New Cut Order</h1>
                        <p className="text-muted-foreground">
                            Select the criteria for the new cut order.
                        </p>
                    </div>
                     <div className="flex items-center gap-2">
                        <Button variant="outline" asChild>
                           <Link href="/cut-order-details">
                                <ArrowLeft className="mr-2 h-4 w-4" />
                                Back
                            </Link>
                        </Button>
                    </div>
                </div>

                <Card>
                    <CardHeader>
                        <div className="flex justify-between items-center">
                            <CardTitle>Cut Order Criteria</CardTitle>
                            {coNumber && <span className="text-lg font-semibold text-muted-foreground">{coNumber}</span>}
                        </div>
                        <CardDescription>Select the CC, Color and week range to generate the cut order for.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                            <div className="space-y-2">
                                <Label htmlFor="cc-select">CC no.</Label>
                                <Select value={selectedCc} onValueChange={setSelectedCc}>
                                    <SelectTrigger id="cc-select">
                                        <SelectValue placeholder="Select a CC" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {ccOptions.map(cc => (
                                            <SelectItem key={cc} value={cc}>{cc}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                             <div className="space-y-2">
                                <Label htmlFor="color-select">Color</Label>
                                <Select value={selectedColor} onValueChange={setSelectedColor} disabled={!selectedCc}>
                                    <SelectTrigger id="color-select">
                                        <SelectValue placeholder="Select a color" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {colorOptions.map(color => (
                                            <SelectItem key={color} value={color}>{color}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                             <div className="space-y-2">
                                <Label htmlFor="start-week-select">Cut Order Start Week</Label>
                                <Select value={startWeek} onValueChange={setStartWeek}>
                                    <SelectTrigger id="start-week-select">
                                        <SelectValue placeholder="Select start week" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {availableStartWeeks.map(week => (
                                            <SelectItem key={week} value={week}>{week}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                              <div className="space-y-2">
                                <Label htmlFor="end-week-select">Cut Order End Week</Label>
                                <Select value={endWeek} onValueChange={setEndWeek}>
                                    <SelectTrigger id="end-week-select">
                                        <SelectValue placeholder="Select end week" />
                                    </SelectTrigger>
                                    <SelectContent>
                                       {weekOptions.filter(w => parseInt(w.slice(1)) >= parseInt(startWeek.slice(1) || '0')).map(week => (
                                            <SelectItem key={week} value={week}>{week}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {frcAvailability && (
                    <Card>
                        <CardHeader>
                            <CardTitle>FRC Availability</CardTitle>
                            <CardDescription>
                                Total available FRC quantity with a CK week before the selected Cut Order Start Week ({startWeek}).
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                             <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Sizes</TableHead>
                                        {SIZES.map(size => (
                                            <TableHead key={size} className="text-right">{size}</TableHead>
                                        ))}
                                        <TableHead className="text-right font-bold">Total</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    <TableRow>
                                        <TableCell className="font-medium">FRC Qty</TableCell>
                                        {SIZES.map(size => (
                                            <TableCell key={size} className="text-right">
                                                {(frcAvailability[size] || 0).toLocaleString()}
                                            </TableCell>
                                        ))}
                                        <TableCell className="text-right font-bold">
                                            {frcAvailability.total.toLocaleString()}
                                        </TableCell>
                                    </TableRow>
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                )}
            </main>
        </div>
    );
}
