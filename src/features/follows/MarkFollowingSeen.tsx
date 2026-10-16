"use client";

import { useEffect } from "react";
import { markFollowingSeen } from "./seen-actions";

// Renders nothing. Opening the Following tab marks it as seen.
export function MarkFollowingSeen() {
  useEffect(() => {
    void markFollowingSeen();
  }, []);
  return null;
}