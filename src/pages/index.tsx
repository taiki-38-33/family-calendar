"use client";

import { useEffect, useState } from "react";
import Calendar from "@/components/Calendar";
import EventForm from "@/components/EventForm";
import type { CalendarEvent } from "@/types";

export default function Home() {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [loading, setLoading] = useState(true);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);

  const fetchEvents = async () => {
    const year = selectedDate.getFullYear();
    const month = String(selectedDate.getMonth() + 1).padStart(2, "0");
    const monthStr = `${year}-${month}`;

    try {
      const response = await fetch(`/api/events?month=${monthStr}`);
      const data = await response.json();
      setEvents(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Failed to fetch events:", error);
      setEvents([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEvents();
  }, [selectedDate]);

  const handleAddEvent = (event: CalendarEvent) => {
    setEvents([...events, event]);
    setEditingEvent(null);
  };

  const handleUpdateEvent = (updatedEvent: CalendarEvent) => {
    setEvents(events.map((e) => (e.id === updatedEvent.id ? updatedEvent : e)));
    setEditingEvent(null);
  };

  const handleDeleteEvent = (id: string) => {
    setEvents(events.filter((e) => e.id !== id));
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-4xl font-bold text-center text-gray-800 mb-8">
          家族の予定
        </h1>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            {loading ? (
              <div className="flex justify-center items-center h-96">
                <div className="text-gray-600">読み込み中...</div>
              </div>
            ) : (
              <Calendar
                selectedDate={selectedDate}
                onSelectDate={setSelectedDate}
                events={events}
                onSelectEvent={setEditingEvent}
                onDeleteEvent={handleDeleteEvent}
              />
            )}
          </div>

          <div className="lg:col-span-1">
            <EventForm
              selectedDate={selectedDate}
              onAddEvent={handleAddEvent}
              onUpdateEvent={handleUpdateEvent}
              editingEvent={editingEvent}
              onCancel={() => setEditingEvent(null)}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
