export function localDateValue(date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

export function startOfLocalDay(value) {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
}

export function addLocalDays(value, days) {
  const date = new Date(value);
  date.setDate(date.getDate() + days);
  return date;
}

export function localWeekStart(value) {
  const date = new Date(value);
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() - ((date.getDay() || 7) - 1));
  return localDateValue(date);
}

export function fixtureSessionPlans(now = new Date()) {
  const todayStart = startOfLocalDay(now);
  const tomorrowStart = addLocalDays(todayStart, 1);
  const dayAfterStart = addLocalDays(todayStart, 2);
  const currentStart = new Date(
    Math.max(todayStart.getTime(), now.getTime() - 30 * 60_000),
  );
  const currentEnd = new Date(
    Math.min(
      tomorrowStart.getTime() - 1,
      Math.max(
        now.getTime() + 45 * 60_000,
        currentStart.getTime() + 30 * 60_000,
      ),
    ),
  );
  const windows = [];
  const previousStart = new Date(currentStart.getTime() - 60 * 60_000);
  const previousEnd = new Date(currentStart.getTime() - 15 * 60_000);
  if (
    previousStart.getTime() >= todayStart.getTime() &&
    previousEnd.getTime() > previousStart.getTime()
  ) {
    windows.push({
      key: "previous",
      presentationKey: "previous",
      startsAt: previousStart.toISOString(),
      endsAt: previousEnd.toISOString(),
    });
  }

  windows.push({
    key: "current",
    presentationKey: "current",
    startsAt: currentStart.toISOString(),
    endsAt: currentEnd.toISOString(),
  });

  const nextStart = new Date(currentEnd.getTime() + 15 * 60_000);
  const nextEnd = new Date(currentEnd.getTime() + 60 * 60_000);
  if (
    nextStart.getTime() < tomorrowStart.getTime() &&
    nextEnd.getTime() < tomorrowStart.getTime()
  ) {
    windows.push({
      key: "next",
      presentationKey: "next",
      startsAt: nextStart.toISOString(),
      endsAt: nextEnd.toISOString(),
    });
  }

  // A full local day makes an E2E run deterministic if it crosses midnight.
  // The plan projection is day-scoped, so this guard is invisible beforehand.
  windows.push({
    key: "rollover",
    presentationKey: "current",
    startsAt: tomorrowStart.toISOString(),
    endsAt: new Date(dayAfterStart.getTime() - 1).toISOString(),
  });

  const grouped = new Map();
  for (const window of windows) {
    const weekStartDate = localWeekStart(new Date(window.startsAt));
    const group = grouped.get(weekStartDate) ?? [];
    group.push(window);
    grouped.set(weekStartDate, group);
  }

  return [...grouped.entries()].map(([weekStartDate, groupedWindows]) => ({
    weekStartDate,
    windows: groupedWindows,
  }));
}
