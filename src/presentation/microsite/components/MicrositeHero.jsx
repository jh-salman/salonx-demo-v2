import { Link } from 'react-router-dom'
import { micrositePublicPath } from '../micrositeApi'
import { normalizeMicrositeTheme } from '../micrositeTheme'

/**
 * Hair Loft–style landing: nav · full-bleed hero · book section · footer.
 * Visual tokens come from salon.theme + primaryHex / logoUrl.
 */
export default function MicrositeHero({ salon }) {
  const theme = normalizeMicrositeTheme(salon?.theme)
  const bookPath = micrositePublicPath(salon.slug, 'book')
  const cta = theme.ctaLabel || 'Book Your Appointment'
  const heroTitle = theme.heroTitle || 'Book Your Appointment'
  const heroSubtitle =
    theme.heroSubtitle ||
    salon.tagline ||
    'How to schedule your visit and find our salon.'
  const about =
    salon.about ||
    'Book online in a few taps. Pick a service, stylist, and time that works for you.'

  return (
    <div className="ms-landing">
      <header className="ms-nav">
        <div className="ms-nav__brand">
          {salon.logoUrl ? (
            <img className="ms-nav__logo" src={salon.logoUrl} alt="" />
          ) : (
            <span className="ms-nav__mark" aria-hidden>
              {(salon.name || 'S').slice(0, 1).toUpperCase()}
            </span>
          )}
          <span className="ms-nav__name">{salon.name}</span>
        </div>
        <nav className="ms-nav__links" aria-label="Microsite">
          <a className="ms-nav__link is-active" href="#book">
            Booking
          </a>
          {salon.phone ? (
            <a className="ms-nav__link" href={`tel:${salon.phone}`}>
              Contact
            </a>
          ) : null}
          <Link className="ms-nav__cta" to={bookPath}>
            Book
          </Link>
        </nav>
      </header>

      <section
        className={`ms-hero-bleed${theme.heroImageUrl ? '' : ' ms-hero-bleed--fallback'}`}
        style={
          theme.heroImageUrl
            ? { backgroundImage: `url(${theme.heroImageUrl})` }
            : undefined
        }
      >
        <div className="ms-hero-bleed__veil" />
        <div className="ms-hero-bleed__copy">
          <h1 className="ms-hero-bleed__title">{heroTitle}</h1>
          <p className="ms-hero-bleed__sub">{heroSubtitle}</p>
        </div>
      </section>

      <section className="ms-section ms-section--book" id="book">
        <div className="ms-section__grid">
          <h2 className="ms-section__heading">{cta}</h2>
          <div className="ms-section__body">
            {salon.tagline ? (
              <p className="ms-section__tag">{salon.tagline}</p>
            ) : null}
            <p className="ms-section__text">{about}</p>
            <Link className="ms-btn ms-btn--primary ms-btn--solid" to={bookPath}>
              {cta}
            </Link>
          </div>
        </div>
      </section>

      <section className="ms-section ms-section--cta">
        <div className="ms-section__cta-inner">
          <h2 className="ms-section__heading ms-section__heading--light">
            Ready to book?
          </h2>
          <p className="ms-section__text ms-section__text--light">
            Choose a service and time — we will confirm your visit.
          </p>
          <Link className="ms-btn ms-btn--ghost-light" to={bookPath}>
            Book online now
          </Link>
        </div>
      </section>

      <footer className="ms-footer">
        <div className="ms-footer__brand">
          {salon.logoUrl ? (
            <img className="ms-footer__logo" src={salon.logoUrl} alt="" />
          ) : (
            <span className="ms-footer__name">{salon.name}</span>
          )}
        </div>
        <div className="ms-footer__cols">
          <div>
            <p className="ms-footer__label">Quick links</p>
            <Link to={bookPath}>Book appointment</Link>
          </div>
          <div>
            <p className="ms-footer__label">Connect</p>
            {salon.phone ? (
              <a href={`tel:${salon.phone}`}>{salon.phone}</a>
            ) : (
              <span className="ms-muted">Add phone in theme</span>
            )}
          </div>
        </div>
      </footer>
    </div>
  )
}
