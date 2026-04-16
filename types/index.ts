export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  isStreaming?: boolean;
}

export interface Chunk {
  id: string;
  text: string;
  source: string;
  index: number;
}

export interface VectorItem {
  chunk: Chunk;
  embedding: number[];
}

export interface UploadResponse {
  success: boolean;
  chunksCount: number;
  message: string;
  fileUrl?: string;
}

export interface ChatRequest {
  message: string;
  history: Array<{ role: 'user' | 'assistant'; content: string }>;
}

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'info';
  message: string;
}
