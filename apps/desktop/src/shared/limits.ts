/** Bounds shared by Main and the renderer (single source for both sides of the IPC). */

/** REQ-003: upper bound on selected capture patterns (mirrors `capture.processes`). */
export const MAX_CAPTURE_PROCESSES = 32

/** REQ-009: how many debug-log entries are kept (Main ring buffer and the log window). */
export const MAX_DEBUG_LOG_ENTRIES = 200
