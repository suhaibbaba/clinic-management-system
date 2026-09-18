import "@testing-library/jest-dom/vitest";
import "@web/index.css";

// The app is drawn RTL and its tokens hang off `<html>`; index.html is not used here.
document.documentElement.setAttribute("dir", "rtl");
document.documentElement.setAttribute("lang", "ar");
