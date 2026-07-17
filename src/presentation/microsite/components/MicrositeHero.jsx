import { Link } from 'react-router-dom'
import { micrositePublicPath } from '../micrositeApi'

export default function MicrositeHero({ salon }) {
  return (
    <header className="ms-hero">
      {salon.logoUrl ? (
        <img className="ms-hero__logo" src={salon.logoUrl} alt="" />
      ) : (
        <div className="ms-hero__mark" aria-hidden>
          {(salon.name || 'S').slice(0, 1).toUpperCase()}
        </div>
      )}
      <h1 className="ms-hero__name">{salon.name}</h1>
      {salon.tagline ? <p className="ms-hero__tag">{salon.tagline}</p> : null}
      {salon.about ? <p className="ms-hero__about">{salon.about}</p> : null}
      <Link className="ms-btn ms-btn--primary" to={micrositePublicPath(salon.slug, 'book')}>
        Book now
      </Link>
    </header>
  )
}
