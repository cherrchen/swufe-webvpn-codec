/** Message row: the last operation's result, kept at a stable height so layout never shifts. */

export function MessageRow({ text }: { text: string }) {
  return (
    <p role="status" aria-live="polite" style={{ margin: 0, minHeight: 18 }}>
      {text}
    </p>
  )
}
