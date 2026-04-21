"use client";

import { useState, useEffect } from "react";
import { format } from "date-fns";
import type { CalendarEvent, CreateEventInput } from "@/types";

interface EventFormProps {
  selectedDate: Date;
  onAddEvent: (event: CalendarEvent) => void;
  onUpdateEvent: (event: CalendarEvent) => void;
  editingEvent: CalendarEvent | null;
  onCancel: () => void;
}

export default function EventForm({
  selectedDate,
  onAddEvent,
  onUpdateEvent,
  editingEvent,
  onCancel,
}: EventFormProps) {
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(format(selectedDate, "yyyy-MM-dd"));
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (editingEvent) {
      setTitle(editingEvent.title);
      setDate(editingEvent.date);
      setStartTime(editingEvent.startTime || "");
      setEndTime(editingEvent.endTime || "");
    } else {
      setTitle("");
      setDate(format(selectedDate, "yyyy-MM-dd"));
      setStartTime("");
      setEndTime("");
    }
    setError("");
  }, [editingEvent, selectedDate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      if (!title.trim()) {
        setError("予定名を入力してください");
        setLoading(false);
        return;
      }

      const createdBy = "user"; // 実装時は Cloudflare Access から取得

      if (editingEvent) {
        // Update existing event
        const response = await fetch(`/api/events/${editingEvent.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title,
            date,
            startTime,
            endTime,
          }),
        });

        if (!response.ok) throw new Error("更新に失敗しました");

        const updatedEvent: CalendarEvent = {
          ...editingEvent,
          title,
          date,
          startTime,
          endTime,
          updatedAt: new Date().toISOString(),
        };
        onUpdateEvent(updatedEvent);
      } else {
        // Create new event
        const response = await fetch("/api/events", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title,
            date,
            startTime,
            endTime,
            createdBy,
          }),
        });

        if (!response.ok) throw new Error("作成に失敗しました");

        const newEvent = await response.json();
        onAddEvent(newEvent);
      }

      setTitle("");
      setStartTime("");
      setEndTime("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "エラーが発生しました");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!editingEvent) return;

    if (!confirm("この予定を削除してもよろしいですか？")) return;

    setLoading(true);

    try {
      const response = await fetch(`/api/events/${editingEvent.id}`, {
        method: "DELETE",
      });

      if (!response.ok) throw new Error("削除に失敗しました");

      onCancel();
    } catch (err) {
      setError(err instanceof Error ? err.message : "削除に失敗しました");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <h2 className="text-xl font-bold text-gray-800 mb-4">
        {editingEvent ? "予定を編集" : "新しい予定"}
      </h2>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            予定名
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500"
            placeholder="例: 病院の診察"
            disabled={loading}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            日付
          </label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500"
            disabled={loading}
          />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              開始時間
            </label>
            <input
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500"
              disabled={loading}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              終了時間
            </label>
            <input
              type="time"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500"
              disabled={loading}
            />
          </div>
        </div>

        {error && <div className="text-sm text-red-600 bg-red-50 p-2 rounded">{error}</div>}

        <div className="flex gap-2">
          <button
            type="submit"
            className="flex-1 bg-indigo-600 text-white py-2 rounded-md hover:bg-indigo-700 disabled:opacity-50"
            disabled={loading}
          >
            {loading ? "処理中..." : editingEvent ? "更新" : "追加"}
          </button>

          {editingEvent && (
            <button
              type="button"
              onClick={handleDelete}
              className="flex-1 bg-red-600 text-white py-2 rounded-md hover:bg-red-700 disabled:opacity-50"
              disabled={loading}
            >
              削除
            </button>
          )}

          {editingEvent && (
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 bg-gray-300 text-gray-700 py-2 rounded-md hover:bg-gray-400 disabled:opacity-50"
              disabled={loading}
            >
              キャンセル
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
