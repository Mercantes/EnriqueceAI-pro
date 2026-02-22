'use client';

import type { TimelineEntry } from '@/features/cadences/cadences.contract';

import type { LeadEnrollmentData } from '../actions/fetch-lead-enrollment';
import type { LeadRow } from '../types';
import { LeadInfoPanel } from './LeadInfoPanel';
import { leadRowToInfoPanelData } from './lead-info-panel.utils';

interface LeadDetailSidebarProps {
  lead: LeadRow;
  enrollmentData: LeadEnrollmentData;
  timeline: TimelineEntry[];
  onEditRequest?: () => void;
}

export function LeadDetailSidebar({ lead, enrollmentData, timeline, onEditRequest }: LeadDetailSidebarProps) {
  const { enrollment, kpis } = enrollmentData;

  return (
    <LeadInfoPanel
      data={leadRowToInfoPanelData(lead)}
      enrollment={enrollment}
      timeline={timeline}
      kpis={kpis}
      onEditRequest={onEditRequest}
    />
  );
}
