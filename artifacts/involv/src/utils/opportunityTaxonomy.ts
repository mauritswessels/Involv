import type { ServiceProgram, ServiceType } from '../types';

export function matchesOpportunityTaxonomy(
  opportunity: { serviceType: ServiceType; servicePrograms: ServiceProgram[] },
  selectedServiceType: ServiceType | '',
  selectedPrograms: ServiceProgram[],
): boolean {
  if (selectedServiceType && opportunity.serviceType !== selectedServiceType) return false;
  if (selectedPrograms.length > 0 &&
    !selectedPrograms.some(program => opportunity.servicePrograms.includes(program))) return false;
  return true;
}
