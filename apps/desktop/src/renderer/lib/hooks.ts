/**
 * Renderer state hooks. Main stays the single source of truth (SC2-005): every hook
 * fetches once on mount and then only follows IPC events, and windows never read each
 * other's state.
 */

import { useCallback, useEffect, useRef, useState } from 'react'

import { MAX_DEBUG_LOG_ENTRIES } from '../../shared/limits'
import type {
  AllowlistConfig,
  AppSettingsView,
  BridgeStatus,
  CaStatus,
  CaptureCandidate,
  DebugLogEvent,
} from '../../shared/types'
import { bridge } from './bridge-api'
import { createLogBatcher, type LogBatcher } from './log-batch'

export function useBridgeStatus(): BridgeStatus | null {
  const [status, setStatus] = useState<BridgeStatus | null>(null)

  useEffect(() => {
    let cancelled = false
    void bridge()
      .getStatus()
      .then((next) => {
        if (!cancelled) setStatus(next)
      })
      .catch((error: unknown) => console.error('swufe-ui 读取桥状态失败', error))
    const unsubscribe = bridge().onStatus((next) => setStatus(next))
    return () => {
      cancelled = true
      unsubscribe()
    }
  }, [])

  return status
}

export function useSettings(): { settings: AppSettingsView | null; reload: () => Promise<void> } {
  const [settings, setSettings] = useState<AppSettingsView | null>(null)

  const reload = useCallback(async () => {
    setSettings(await bridge().getSettings())
  }, [])

  useEffect(() => {
    let cancelled = false
    void bridge()
      .getSettings()
      .then((next) => {
        if (!cancelled) setSettings(next)
      })
      .catch((error: unknown) => console.error('swufe-ui 读取设置失败', error))
    // Capture mode/selection can be edited in the other window; Main announces every
    // config change as a status event, so both windows converge on its authority.
    const unsubscribe = bridge().onStatus(() => {
      void reload().catch((error: unknown) => console.error('swufe-ui 刷新设置失败', error))
    })
    return () => {
      cancelled = true
      unsubscribe()
    }
  }, [reload])

  return { settings, reload }
}

export function useAllowlistConfig(): {
  config: AllowlistConfig | null
  save: (next: AllowlistConfig) => Promise<void>
} {
  const [config, setConfig] = useState<AllowlistConfig | null>(null)

  const reload = useCallback(async () => {
    setConfig(await bridge().getAllowlist())
  }, [])

  const save = useCallback(
    async (next: AllowlistConfig) => {
      await bridge().setAllowlist(next)
      await reload()
    },
    [reload],
  )

  useEffect(() => {
    let cancelled = false
    void bridge()
      .getAllowlist()
      .then((next) => {
        if (!cancelled) setConfig(next)
      })
      .catch((error: unknown) => console.error('swufe-ui 读取 allowlist 失败', error))
    // Edits happen in the allowlist window; Main re-broadcasts status after a change
    // so the summary in the main window follows along (AC2-007).
    const unsubscribe = bridge().onStatus(() => {
      void reload().catch((error: unknown) => console.error('swufe-ui 刷新 allowlist 失败', error))
    })
    return () => {
      cancelled = true
      unsubscribe()
    }
  }, [reload])

  return { config, save }
}

export function useCaStatus(): { status: CaStatus | null; reload: () => Promise<void> } {
  const [status, setStatus] = useState<CaStatus | null>(null)

  const reload = useCallback(async () => {
    setStatus(await bridge().getCaStatus())
  }, [])

  useEffect(() => {
    let cancelled = false
    void bridge()
      .getCaStatus()
      .then((next) => {
        if (!cancelled) setStatus(next)
      })
      .catch((error: unknown) => console.error('swufe-ui 读取 CA 状态失败', error))
    return () => {
      cancelled = true
    }
  }, [])

  return { status, reload }
}

export function useCandidates(): {
  candidates: CaptureCandidate[]
  loaded: boolean
  refresh: () => Promise<void>
} {
  const [candidates, setCandidates] = useState<CaptureCandidate[]>([])
  const [loaded, setLoaded] = useState(false)

  const refresh = useCallback(async () => {
    setCandidates(await bridge().listCaptureCandidates())
    setLoaded(true)
  }, [])

  useEffect(() => {
    let cancelled = false
    void bridge()
      .listCaptureCandidates()
      .then((next) => {
        if (cancelled) return
        setCandidates(next)
        setLoaded(true)
      })
      .catch((error: unknown) => {
        console.error('swufe-ui 读取候选应用失败', error)
        if (!cancelled) setLoaded(true)
      })
    return () => {
      cancelled = true
    }
  }, [])

  return { candidates, loaded, refresh }
}

export function useDebugLogs(enabled: boolean): {
  rows: DebugLogEvent[]
  clear: () => Promise<void>
} {
  const [rows, setRows] = useState<DebugLogEvent[]>([])
  const rowsRef = useRef<DebugLogEvent[]>([])
  const batcherRef = useRef<LogBatcher | null>(null)

  useEffect(() => {
    rowsRef.current = rows
  }, [rows])

  useEffect(() => {
    const batcher = createLogBatcher(
      (events) => {
        // Newest first, capped at the buffer size the table is documented to show.
        setRows((previous) =>
          [...events.slice().reverse(), ...previous].slice(0, MAX_DEBUG_LOG_ENTRIES),
        )
      },
      { isSaturated: () => rowsRef.current.length >= MAX_DEBUG_LOG_ENTRIES },
    )
    batcherRef.current = batcher
    let cancelled = false
    void bridge()
      .getDebugLogs()
      .then((restored) => {
        if (!cancelled) setRows(restored.slice(0, MAX_DEBUG_LOG_ENTRIES))
      })
      .catch((error: unknown) => console.error('swufe-ui 读取调试日志失败', error))
    const unsubscribe = bridge().onDebugLog((event) => batcher.push(event))
    return () => {
      cancelled = true
      unsubscribe()
      batcher.dispose()
      batcherRef.current = null
    }
  }, [])

  useEffect(() => {
    if (!enabled) setRows([])
  }, [enabled])

  const clear = useCallback(async () => {
    await bridge().clearDebugLogs()
    // Events already queued would otherwise reappear right after the clear.
    batcherRef.current?.flush()
    setRows([])
  }, [])

  return { rows, clear }
}
