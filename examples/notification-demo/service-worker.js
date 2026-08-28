// information_uuid_v5=2dfe9da6-bd00-5344-b1be-d0b7d0666a28
// event_uuid_v7=01a04872-06a1-7e3b-8f01-c826fd23e961
// machine-contract: notification tag equals UUIDv5 intent ID; readback uses getNotifications with the same tag.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => {
    const current = windows.find((item) => "focus" in item);
    return current ? current.focus() : clients.openWindow("/");
  }));
});
