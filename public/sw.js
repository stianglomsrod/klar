/// <reference lib="webworker" />

// ── Push Event — Show Notification with Action Buttons ──

self.addEventListener("push", (event) => {
  console.log("[SW PUSH TRACE] Push event received!", event.data?.text());

  if (!event.data) {
    console.log("[SW PUSH TRACE] ✗ No event.data — aborting");
    return;
  }

  let payload;
  try {
    payload = event.data.json();
    console.log("[SW PUSH TRACE] Parsed payload:", JSON.stringify(payload));
  } catch (err) {
    console.error("[SW PUSH TRACE] ✗ JSON parse failed:", err);
    return;
  }

  const { title, body, taskId, studentId, reactionToken } = payload;

  const options = {
    body: body || "",
    icon: "/icon.svg",
    badge: "/badge.svg",
    tag: "task-" + (taskId || "unknown"),
    renotify: true,
    data: { taskId, studentId, reactionToken },
    actions: [
      { action: "👍", title: "👍" },
      { action: "🌟", title: "🌟" },
      { action: "💪", title: "💪" },
      { action: "🎉", title: "🎉" },
    ],
  };

  event.waitUntil(
    self.registration.showNotification(title || "Klar", options)
      .then(() => console.log("[SW PUSH TRACE] ✓ showNotification succeeded"))
      .catch((err) => console.error("[SW PUSH TRACE] ✗ showNotification FAILED:", err))
  );
});

// ── Notification Click — Emoji React or Open App ──

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const { taskId, studentId, reactionToken } = event.notification.data || {};
  const reaction = event.action; // one of "👍", "🌟", "💪", "🎉" or "" (body tap)

  if (reaction && taskId && studentId) {
    // Teacher tapped an emoji action — send reaction with HMAC token
    event.waitUntil(
      fetch("/api/push/react", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Reaction-Token": reactionToken || "",
        },
        body: JSON.stringify({ taskId, studentId, reaction }),
      }).catch(() => {
        // Silent — network may be unavailable
      }),
    );
  } else {
    // Teacher tapped the notification body — open / focus the student page
    const targetPath = studentId
      ? "/teacher/students/" + studentId
      : "/teacher";

    event.waitUntil(
      self.clients
        .matchAll({ type: "window", includeUncontrolled: true })
        .then((clientList) => {
          for (const client of clientList) {
            if (client.url.includes("/teacher") && "focus" in client) {
              client.navigate(targetPath);
              return client.focus();
            }
          }
          return self.clients.openWindow(targetPath);
        }),
    );
  }
});
