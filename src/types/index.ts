export interface CalendarEvent {
  id: string;
  title: string;
  date: string; // YYYY-MM-DD
  startTime?: string; // HH:mm
  endTime?: string; // HH:mm
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateEventInput {
  title: string;
  date: string;
  startTime?: string;
  endTime?: string;
  createdBy: string;
}

export interface UpdateEventInput {
  title?: string;
  date?: string;
  startTime?: string;
  endTime?: string;
}

export interface CloudflareEnv {
  DB: D1Database;
}

declare global {
  interface HonoRequest {
    env?: CloudflareEnv;
  }
}
