import { hr } from "../src/i18n/hr.js";
import "./globals.css";

export const metadata = {
  title: hr.app.name,
  description: hr.app.description,
};

export default function RootLayout({ children }) {
  return (
    <html lang="hr">
      <body>{children}</body>
    </html>
  );
}
