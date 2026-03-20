/**
 * Settings hook — reads/writes to localStorage.
 * Returns the current settings and an update function.
 * The update function is called explicitly (Save button), not on every input change.
 */

import { useState, useCallback } from 'react'
import { z } from 'zod'
import type { UserSettings } from '../types'
import { DEFAULT_SETTINGS } from '../constants'

const STORAGE_KEY = 'arbRadar_settings'

// Zod schema to validate data coming from localStorage
const settingsSchema = z.object({
  fees: z.object({
    makerFeePercent: z.number().min(0).max(10),
    takerFeePercent: z.number().min(0).max(10),
    withdrawalFeeUsd: z.number().min(0),
  }),
  thresholds: z.object({
    minBasisPercent: z.number().min(0),
    minAnnualizedPercent: z.number().min(0),
    minSpreadPercent: z.number().min(0),
  }),
  exchanges: z.object({
    Binance: z.boolean(),
    Bybit: z.boolean(),
    OKX: z.boolean(),
    Deribit: z.boolean(),
  }),
})

function loadSettings(): UserSettings {
  if (typeof window === 'undefined') return { ...DEFAULT_SETTINGS }
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { ...DEFAULT_SETTINGS }
    const parsed = JSON.parse(raw)
    const validated = settingsSchema.parse(parsed)
    return validated as UserSettings
  } catch {
    // Corrupted or outdated data — reset to defaults
    return { ...DEFAULT_SETTINGS }
  }
}

function saveSettings(settings: UserSettings) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
  } catch {
    console.error('Failed to save settings to localStorage')
  }
}

export interface UseSettingsReturn {
  settings: UserSettings
  /** Call this with a complete new settings object to persist and apply. */
  applySettings: (next: UserSettings) => void
  resetToDefaults: () => void
}

export function useSettings(): UseSettingsReturn {
  const [settings, setSettings] = useState<UserSettings>(loadSettings)

  const applySettings = useCallback((next: UserSettings) => {
    saveSettings(next)
    setSettings(next)
  }, [])

  const resetToDefaults = useCallback(() => {
    const defaults = { ...DEFAULT_SETTINGS }
    saveSettings(defaults)
    setSettings(defaults)
  }, [])

  return { settings, applySettings, resetToDefaults }
}
