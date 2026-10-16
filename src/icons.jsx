import React from "react";
const paths = {
  grid: "M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z",
  activity: "M3 12h4l3-8 4 16 3-8h4",
  check: "m5 12 4 4L19 6",
  clock: "M12 8v5l3 2 M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0",
  link: "M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-2 2 M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l2-2",
  key: "M15 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0 M11 11v10 M11 17h4 M11 21h3",
  book: "M4 4h6a3 3 0 0 1 3 3v14a4 4 0 0 0-4-3H4z M13 7a3 3 0 0 1 3-3h5v14h-4a4 4 0 0 0-4 3",
  users:
    "M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2 M17 5a4 4 0 0 1 0 8 M22 21v-2a4 4 0 0 0-3-3.87 M12 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0",
  plus: "M12 5v14 M5 12h14",
  arrow: "M4 12h16 m-6-6 6 6-6 6",
  refresh:
    "M20 7v5h-5 M4 17v-5h5 M6 7a7 7 0 0 1 12-2l2 3 M4 16l2 3a7 7 0 0 0 12-2",
  shield: "M12 3 3 7v5c0 5 9 9 9 9s9-4 9-9V7z M8 12l3 3 5-6",
  terminal: "m4 6 6 6-6 6 M13 18h7",
  download: "M12 3v12 m-5-5 5 5 5-5 M4 17v4h16v-4",
  copy: "M9 9h12v12H9z M15 5V3H3v12h2",
  close: "m6 6 12 12 M6 18 18 6",
  search: "M21 21l-6-6 M17 10a7 7 0 1 1-14 0 7 7 0 0 1 14 0",
  menu: "M4 6h16 M4 12h16 M4 18h16",
  out: "M14 3h7v7 M21 3 10 14 M10 3H3v18h18v-7",
  logout: "M9 4H3v16h6 M9 12h12 m-4-4 4 4-4 4",
};
export function Icon({ name, size = 18, ...props }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <path d={paths[name] || paths.activity} />
    </svg>
  );
}
export function Mark() {
  return (
    <span className="mark">
      <svg
        width="26"
        height="26"
        viewBox="0 0 32 32"
        fill="none"
        aria-hidden="true"
      >
        <path d="M5 24 16 5l11 19H5Z" stroke="currentColor" strokeWidth="2.5" />
        <path
          d="m12 19 3 3 6-9"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}
