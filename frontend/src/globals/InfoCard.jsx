import React from 'react';

const InfoCard = ({ label, value, sub, variant = 'green' }) => {
  const variantClass = {
    green: 'info-card-green',
    gold: 'info-card-gold',
    blue: 'info-card-blue',
  }[variant];

  return (
    <div className={`info-card ${variantClass}`}>
      <h3 className="info-card-label">{label}</h3>
      <span className="info-card-value">{value}</span>
      {sub && <span className="info-card-sub">{sub}</span>}
    </div>
  );
};

export default InfoCard;