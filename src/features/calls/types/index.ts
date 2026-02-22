// Call status and type enums matching database
export type CallStatus = 'significant' | 'not_significant' | 'no_contact' | 'busy' | 'not_connected';
export type CallType = 'inbound' | 'outbound' | 'manual';

// Call row matching database table
export interface CallRow {
  id: string;
  org_id: string;
  user_id: string;
  lead_id: string | null;
  origin: string;
  destination: string;
  started_at: string;
  duration_seconds: number;
  status: CallStatus;
  type: CallType;
  cost: number | null;
  recording_url: string | null;
  notes: string | null;
  is_important: boolean;
  created_at: string;
  updated_at: string;
}

// Call feedback row matching database table
export interface CallFeedbackRow {
  id: string;
  call_id: string;
  user_id: string;
  content: string;
  created_at: string;
}

// Insert types
export interface CallInsert {
  org_id: string;
  user_id: string;
  lead_id?: string | null;
  origin: string;
  destination: string;
  started_at?: string;
  duration_seconds?: number;
  status?: CallStatus;
  type?: CallType;
  cost?: number | null;
  recording_url?: string | null;
  notes?: string | null;
  is_important?: boolean;
}

// Call with detail (for modal)
export interface CallDetail extends CallRow {
  feedback: CallFeedbackRow[];
}
