
'use client';

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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent } from '@/components/ui/card';
import { SIZES } from '@/lib/data';
import { useSchedule } from '@/context/schedule-provider';
import { useMemo, useState, useEffect } from 'react';
import type { Order, FrcRow } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { MessageSquare } from 'lucide-react';


export default function FrcPlanningPage() {
  const { frcData, isScheduleLoaded } = useSchedule();
  
  return (
    <div className="flex h-screen flex-col">
      <Header />
      <main className="flex-1 p-4 sm:p-6 lg:p-8">
        <Breadcrumb className="mb-4">
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link href="/">Home</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>FRC Planning</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
        <div className="space-y-4">
          <h1 className="text-2xl font-bold">FRC Planning</h1>
          <p className="text-muted-foreground">
            View and manage your material FRCs.
          </p>

          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>CC no.</TableHead>
                    <TableHead>Model / Color</TableHead>
                    <TableHead>PRJ #</TableHead>
                    <TableHead>FRC #</TableHead>
                    <TableHead>FRC Week</TableHead>
                    <TableHead>CK Week</TableHead>
                    <TableHead>FRC Coverage Weeks</TableHead>
                    {SIZES.map(size => (
                      <TableHead key={size} className="text-right">{size}</TableHead>
                    ))}
                    <TableHead className="text-right">FRC Qty</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Approve</TableHead>
                    <TableHead className="text-center">Remarks</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isScheduleLoaded && frcData.length > 0 ? (
                    frcData.map(row => (
                      <TableRow key={row.frcNumber}>
                        <TableCell>{row.ccNo}</TableCell>
                        <TableCell>{row.model}</TableCell>
                        <TableCell>{row.prjNumber}</TableCell>
                        <TableCell>{row.frcNumber}</TableCell>
                        <TableCell>{row.frcWeek}</TableCell>
                        <TableCell>{row.ckWeek}</TableCell>
                        <TableCell>{row.frcCoverage}</TableCell>
                        {SIZES.map(size => (
                          <TableCell key={size} className="text-right">
                            {(row.sizes?.[size] || 0) > 0 ? (row.sizes?.[size] || 0).toLocaleString() : '-'}
                          </TableCell>
                        ))}
                        <TableCell className="text-right font-medium">{row.frcQty.toLocaleString()}</TableCell>
                        <TableCell>{row.status}</TableCell>
                        <TableCell>
                          {/* Approve button to be added */}
                        </TableCell>
                         <TableCell className="text-center">
                          <Button variant="ghost" size="icon">
                            <MessageSquare className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={12 + SIZES.length} className="h-24 text-center">
                        {isScheduleLoaded ? 'No FRC data available.' : 'Loading FRC data...'}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
