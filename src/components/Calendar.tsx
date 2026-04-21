import { useState } from "react";
import type { CalendarEvent } from "@/types";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay } from "date-fns";
import { ja } from "date-fns/locale";

interface CalendarProps {
  selectedDate: Date;
  onSelectDate: (date: Date) => void;
  events: CalendarEvent[];
  onSelectEvent: (event: CalendarEvent) => void;
  onDeleteEvent: (id: string) => void;
}

export default function Calendar({
  selectedDate,
  onSelectDate,
  events,
  onSelectEvent,
  onDeleteEvent,
}: CalendarProps) {
  const [currentMonth, setCurrentMonth] = useState(selectedDate);

  const firstDay = startOfMonth(currentMonth);
  const lastDay = endOfMonth(currentMonth);
  const daysInMonth = eachDayOfInterval({ start: firstDay, end: lastDay });

  const handlePrevMonth = () => {
    const newDate = new Date(currentMonth);
    newDate.setMonth(newDate.getMonth() - 1);
    setCurrentMonth(newDate);
    onSelectDate(newDate);
  };

  const handleNextMonth = () => {
    const newDate = new Date(currentMonth);
    newDate.setMonth(newDate.getMonth() + 1);
    setCurrentMonth(newDate);
    onSelectDate(newDate);
  };

  const getEventsForDate = (date: Date) => {
    const dateStr = format(date, "yyyy-MM-dd");
    return events.filter((event) => event.date === dateStr);
  };

  const weekDays = ["日", "月", "火", "水", "木", "金", "土"];

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <div className="flex items-center justify-between mb-6">
        <button
          onClick={handlePrevMonth}
          className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700"
        >
          ← 前月
        </button>
        <h2 className="text-2xl font-bold text-gray-800">
          {format(currentMonth, "yyyy年 M月", { locale: ja })}
        </h2>
        <button
          onClick={handleNextMonth}
          className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700"
        >
          翌月 →
        </button>
      </div>

      <div className="grid grid-cols-7 gap-2 mb-4">
        {weekDays.map((day) => (
          <div
            key={day}
            className="text-center font-bold text-gray-700 py-2 bg-gray-100 rounded"
          >
            {day}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-2">
        {daysInMonth.map((day) => {
          const dayEvents = getEventsForDate(day);
          const isCurrentMonth = isSameMonth(day, currentMonth);
          const isSelected = isSameDay(day, selectedDate);

          return (
            <div
              key={day.toString()}
              onClick={() => isCurrentMonth && onSelectDate(day)}
              className={`min-h-24 p-2 rounded border-2 cursor-pointer transition ${
                isCurrentMonth
                  ? "bg-white border-gray-200 hover:border-indigo-400"
                  : "bg-gray-100 border-gray-200"
              } ${
                isSelected
                  ? "border-indigo-600 bg-indigo-50"
                  : "border-gray-200"
              }`}
            >
              <div
                className={`font-semibold text-sm mb-1 ${
                  isCurrentMonth ? "text-gray-800" : "text-gray-400"
                }`}
              >
                {format(day, "d")}
              </div>
              <div className="space-y-1">
                {dayEvents.slice(0, 2).map((event) => (
                  <div
                    key={event.id}
                    className="text-xs bg-indigo-100 text-indigo-800 p-1 rounded truncate cursor-pointer hover:bg-indigo-200"
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectEvent(event);
                    }}
                  >
                    {event.title}
                  </div>
                ))}
                {dayEvents.length > 2 && (
                  <div className="text-xs text-gray-500">
                    +{dayEvents.length - 2}件
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
