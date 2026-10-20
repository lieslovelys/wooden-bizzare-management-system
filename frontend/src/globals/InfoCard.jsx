import React from 'react';

const InfoCard = ({ label, value, sub, variant = 'green' }) => {
  const variantClass = {
    green: 'info-card-green',
    gold: 'info-card-gold',
    blue: 'info-card-blue',
  }[variant];

  // ARCHITECTURE_REVIEW.md item 37 — a worker/project count ("5", "12") reads fine at the
  // card's default 3rem; a formatted currency value ("₱48,230.50") is much longer and was
  // clipping even on desktop. --long shrinks only the values long enough to need it.
  const isLong = String(value).length > 7;

  return (
    <div className={`info-card ${variantClass}`}>
      <h3 className="info-card-label">{label}</h3>
      <span className={`info-card-value${isLong ? ' info-card-value--long' : ''}`}>{value}</span>
      {sub && <span className="info-card-sub">{sub}</span>}
    </div>
  );
};

export default InfoCard;