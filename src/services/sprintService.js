import { createPeriodService } from './periodService.js';

export function createSprintService(options = {}) {
  const periodService = createPeriodService(options);

  return {
    ...periodService,
    getActiveSprint: periodService.getActivePeriod,
    ensureActiveSprint: periodService.ensureActivePeriod,
    closeSprint: periodService.closePeriod,
    getSprintEarnings: periodService.getPeriodEarnings,
    getSprintMoneyProgress: periodService.getPeriodMoneyProgress,
    getSprintHistory: periodService.getPeriodHistory,
    setSprintLength: periodService.setPeriodLength
  };
}
