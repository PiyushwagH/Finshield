export const mapRiskBand = (rawBand) => {
  if (!rawBand) return 'Low';
  const band = rawBand.trim().toLowerCase();
  if (band === 'very low' || band === 'low') return 'Low';
  if (band === 'moderate' || band === 'medium') return 'Medium';
  if (band === 'high' || band === 'very high') return 'High';
  return 'Low';
};

export const getRiskBandColor = (mappedBand) => {
  switch (mappedBand) {
    case 'Low':
      return 'var(--risk-low)';
    case 'Medium':
      return 'var(--risk-medium)';
    case 'High':
      return 'var(--risk-high)';
    default:
      return 'var(--risk-low)';
  }
};
