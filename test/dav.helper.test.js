const assert = require("node:assert/strict");
const test = require("node:test");

const { parseIcalEvents } = require("../dist/nodes/ICloud/helpers/dav.helper");

test("parses every expanded occurrence in a recurring CalDAV response", () => {
  const events = parseIcalEvents(
    [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "BEGIN:VEVENT",
      "UID:daily-meeting",
      "RECURRENCE-ID:20260505T090000Z",
      "DTSTART:20260505T090000Z",
      "DTEND:20260505T093000Z",
      "SUMMARY:Daily meeting",
      "END:VEVENT",
      "BEGIN:VEVENT",
      "UID:daily-meeting",
      "RECURRENCE-ID:20260506T090000Z",
      "DTSTART:20260506T090000Z",
      "DTEND:20260506T093000Z",
      "SUMMARY:Daily meeting",
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\r\n"),
  );

  assert.equal(events.length, 2);
  assert.deepEqual(
    events.map(({ start, end }) => ({ start, end })),
    [
      { start: "2026-05-05T09:00:00Z", end: "2026-05-05T09:30:00Z" },
      { start: "2026-05-06T09:00:00Z", end: "2026-05-06T09:30:00Z" },
    ],
  );
});

test("does not confuse VTIMEZONE dates with the event occurrence", () => {
  const [event] = parseIcalEvents(
    [
      "BEGIN:VCALENDAR",
      "BEGIN:VTIMEZONE",
      "TZID:Europe/Berlin",
      "BEGIN:STANDARD",
      "DTSTART:19701025T030000",
      "END:STANDARD",
      "END:VTIMEZONE",
      "BEGIN:VEVENT",
      "UID:timezone-event",
      "DTSTART;TZID=Europe/Berlin:20260505T090000",
      "DTEND;TZID=Europe/Berlin:20260505T100000",
      "SUMMARY:Local meeting",
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\r\n"),
  );

  assert.equal(event.start, "2026-05-05T09:00:00");
  assert.equal(event.end, "2026-05-05T10:00:00");
  assert.equal(event.timezone, "Europe/Berlin");
});
