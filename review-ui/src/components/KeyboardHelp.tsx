import { Kbd } from './ui'

export const KEYS: [string, string][] = [
  ['J / K', 'Next / previous row'],
  ['A', 'Accept the selected row'],
  ['R', 'Reject the selected row (then 1-4 picks the reason)'],
  ['E', 'Edit the selected row’s quote'],
  ['N', 'Next page (when no flagged row is pending)'],
  ['B', 'Back one page'],
  ['?', 'Show or hide this list'],
  ['Esc', 'Close a dialog, stop editing, or leave a text field'],
]

export function KeyboardHelp({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-40 flex items-start justify-center bg-stone-900/30 pt-24" onMouseDown={onClose}>
      <div role="dialog" aria-label="Keyboard shortcuts" className="w-96 rounded-lg bg-white p-4 shadow-xl" onMouseDown={e => e.stopPropagation()}>
        <h2 className="mb-2 text-sm font-semibold">Keyboard</h2>
        <table className="w-full text-sm">
          <tbody>
            {KEYS.map(([k, d]) => (
              <tr key={k} className="border-t border-stone-100">
                <td className="py-1 pr-3 whitespace-nowrap"><Kbd>{k}</Kbd></td>
                <td className="py-1 text-stone-700">{d}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
