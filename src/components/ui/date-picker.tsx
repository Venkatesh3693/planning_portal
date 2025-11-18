
"use client"

import * as React from "react"
import { format } from "date-fns"
import { Calendar as CalendarIcon, X } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

type DatePickerProps = {
  date?: Date;
  setDate: (date: Date | undefined) => void;
  className?: string;
};

export function DatePicker({ date, setDate, className }: DatePickerProps) {
  const [isOpen, setIsOpen] = React.useState(false);

  const handleSelect = (selectedDate: Date | undefined) => {
    setDate(selectedDate);
    setIsOpen(false);
  };

  const handleClear = (e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    setDate(undefined);
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          id="date"
          variant={"outline"}
          className={cn(
            "w-full justify-start text-left font-normal relative",
            !date && "text-muted-foreground",
            className
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {date ? (
            format(date, "LLL dd, y")
          ) : (
            <span>Pick a date</span>
          )}
          {date && (
            <div
              role="button"
              aria-label="Clear date"
              className="absolute right-1 h-6 w-6 grid place-items-center rounded-full hover:bg-accent"
              onClick={handleClear}
            >
              <X className="h-4 w-4" />
            </div>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          initialFocus
          mode="single"
          selected={date}
          onSelect={handleSelect}
        />
      </PopoverContent>
    </Popover>
  )
}
