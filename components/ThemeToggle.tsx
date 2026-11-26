"use client";

import { Moon, Sun } from "lucide-react";
import { flushSync } from "react-dom";
import { useStore } from "@/components/StoreProvider";

interface ThemeToggleProps {
  className?: string;
  showLabel?: boolean;
}

export function ThemeToggle({ className, showLabel = true }: ThemeToggleProps) {
  const { state, updateSettings } = useStore();
  const isDark = state.settings.theme === "dark";

  const toggleTheme = (event: React.MouseEvent<HTMLButtonElement>) => {
    const nextTheme = isDark ? "light" : "dark";

    const isAppearanceTransition =
      typeof document !== "undefined" &&
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      typeof (document as any).startViewTransition === "function" &&
      !window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (!isAppearanceTransition) {
      updateSettings({ theme: nextTheme });
      document.documentElement.dataset.theme = nextTheme;
      try {
        window.localStorage.setItem("getitdone:theme", nextTheme);
      } catch {}
      return;
    }

    const rect = event.currentTarget.getBoundingClientRect();
    const x = event.clientX || rect.left + rect.width / 2;
    const y = event.clientY || rect.top + rect.height / 2;

    const endRadius = Math.hypot(
      Math.max(x, window.innerWidth - x),
      Math.max(y, window.innerHeight - y)
    );

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const transition = (document as any).startViewTransition(() => {
      flushSync(() => {
        updateSettings({ theme: nextTheme });
        document.documentElement.dataset.theme = nextTheme;
        try {
          window.localStorage.setItem("getitdone:theme", nextTheme);
        } catch {}
      });
    });

    transition.ready.then(() => {
      const clipPath = [
        `circle(0px at ${x}px ${y}px)`,
        `circle(${endRadius}px at ${x}px ${y}px)`,
      ];
      document.documentElement.animate(
        {
          clipPath,
        },
        {
          duration: 550,
          easing: "cubic-bezier(0.4, 0, 0.2, 1)",
          pseudoElement: "::view-transition-new(root)",
        }
      );
    });
  };

  const isNav = className?.includes("nav-item");

  return (
    <button
      type="button"
      className={className ?? "btn"}
      onClick={toggleTheme}
      title={isDark ? "Switch to light mode" : "Switch to dark mode"}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
    >
      {isDark ? <Sun /> : <Moon />}
      {showLabel && (
        isNav ? (
          <span>{isDark ? "Light mode" : "Dark mode"}</span>
        ) : (
          <span className="topbar-sub">{isDark ? "Light" : "Dark"}</span>
        )
      )}
    </button>
  );
}
