"use client";

import { useEffect } from "react";
import { markNotificationsSeen } from "./actions";

// Renders nothing. Opening the notifications page marks everything as seen.
export function MarkSeen() {
  useEffect(() => {
    void markNotificationsSeen();
  }, []);
  return null;
}