const dateTimeFormatter = new Intl.DateTimeFormat(undefined, {
  year: 'numeric',
  month: 'short',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit'
});

export function nowIsoTimestamp() {
  return new Date().toISOString();
}

export function parseIsoToDate(value) {
  if (typeof value !== 'string' || value.length === 0) {
    return null;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed;
}

export function isValidIsoTimestamp(value) {
  return parseIsoToDate(value) !== null;
}

export function toDateTimeLabel(value) {
  const parsed = parseIsoToDate(value);
  if (!parsed) {
    return 'Ugyldig dato';
  }

  return dateTimeFormatter.format(parsed);
}

export function isOnOrAfter(leftIso, rightIso) {
  const leftDate = parseIsoToDate(leftIso);
  const rightDate = parseIsoToDate(rightIso);
  if (!leftDate || !rightDate) {
    return false;
  }

  return leftDate.getTime() >= rightDate.getTime();
}

export function isSameLocalDay(leftIso, rightDate = new Date()) {
  const leftDate = parseIsoToDate(leftIso);
  if (!leftDate) {
    return false;
  }

  return (
    leftDate.getFullYear() === rightDate.getFullYear() &&
    leftDate.getMonth() === rightDate.getMonth() &&
    leftDate.getDate() === rightDate.getDate()
  );
}
