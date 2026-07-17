import './microsite.css'

export default function MicrositeShell({ salon, children }) {
  const primary = salon?.primaryHex || '#3b82f6'
  return (
    <div
      className="ms-shell"
      style={{ '--ms-primary': primary }}
      data-template={salon?.templateId || 'sx-book-v1'}
    >
      <div className="ms-shell__inner">{children}</div>
    </div>
  )
}
