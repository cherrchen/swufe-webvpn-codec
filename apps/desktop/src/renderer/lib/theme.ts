/** Compact Ant Design tokens: 12px text and 24px controls keep the main window inside 720×560. */

import type { ThemeConfig } from 'antd'

export const COMPACT_THEME: ThemeConfig = {
  token: {
    fontSize: 12,
    controlHeight: 24,
    borderRadius: 4,
    padding: 8,
    margin: 8,
  },
}
